import { eq, and } from "drizzle-orm";
import { db, importJobsTable, importLogsTable } from "@workspace/db";
import { randomUUID } from "crypto";
import { parseCsvBuffer } from "./csvParser.js";
import {
  createCustomer,
  createProduct,
  findOrCreateCustomerByEmail,
  findProductBySku,
  createOrder,
  addShipment,
  updateOrderStatus,
  type BigCommerceCredentials,
} from "./bigcommerce.js";
import { logger } from "./logger.js";

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function getJobStatus(jobId: string): Promise<string> {
  const [job] = await db.select({ status: importJobsTable.status }).from(importJobsTable).where(eq(importJobsTable.id, jobId));
  return job?.status ?? "failed";
}

export async function runImportJob(jobId: string): Promise<void> {
  const [job] = await db.select().from(importJobsTable).where(eq(importJobsTable.id, jobId));
  if (!job) {
    logger.error({ jobId }, "Import job not found");
    return;
  }

  await db.update(importJobsTable).set({ status: "running" }).where(eq(importJobsTable.id, jobId));

  const creds: BigCommerceCredentials = {
    storeHash: job.storeHash,
    accessToken: job.accessToken,
  };

  let rows: Record<string, string>[];
  try {
    rows = parseCsvBuffer(Buffer.from(job.csvData, "base64"));
  } catch (e) {
    await db.update(importJobsTable).set({ status: "failed" }).where(eq(importJobsTable.id, jobId));
    logger.error({ jobId, err: e }, "Failed to parse CSV");
    return;
  }

  const total = rows.length;
  await db.update(importJobsTable).set({ totalRows: total }).where(eq(importJobsTable.id, jobId));

  let processed = 0;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    // Check if paused or cancelled
    const currentStatus = await getJobStatus(jobId);
    if (currentStatus === "paused") {
      while (true) {
        await sleep(1000);
        const s = await getJobStatus(jobId);
        if (s === "running") break;
        if (s === "failed" || s === "completed") return;
      }
    }

    const logId = randomUUID();
    let result: { success: boolean; entityId?: string; error?: string };

    try {
      if (job.type === "customers") {
        result = await createCustomer(creds, row);
      } else if (job.type === "products") {
        result = await createProduct(creds, row);
      } else {
        // orders
        const { customerId, error: custErr } = await findOrCreateCustomerByEmail(
          creds,
          row.email || "",
          row.first_name || "",
          row.last_name || ""
        );
        if (custErr || !customerId) {
          result = { success: false, error: custErr || "Could not find/create customer" };
        } else {
          const { productId, variantId, price, error: prodErr } = await findProductBySku(creds, row.product_sku || "");
          if (prodErr || !productId) {
            result = { success: false, error: prodErr || "Could not find product by SKU" };
          } else {
            result = await createOrder(creds, row, customerId, productId, variantId, price ?? 0);
            if (result.success && result.entityId && row.tracking_number?.trim()) {
              const shipResult = await addShipment(
                creds,
                result.entityId,
                row.tracking_number.trim(),
                row.tracking_carrier?.trim() ?? "",
                row.tracking_comments?.trim() ?? ""
              );
              if (!shipResult.success) {
                logger.warn({ orderId: result.entityId, error: shipResult.error }, "Tracking info could not be added to order");
              }
            }
          }
        }
      }
    } catch (e) {
      result = { success: false, error: e instanceof Error ? e.message : String(e) };
    }

    processed++;
    if (result.success) {
      success++;
    } else {
      failed++;
    }

    await db.insert(importLogsTable).values({
      id: logId,
      jobId,
      rowNumber: rowNum,
      status: result.success ? "success" : "error",
      message: result.success
        ? `Row ${rowNum} imported successfully${result.entityId ? ` (ID: ${result.entityId})` : ""}`
        : result.error ?? "Unknown error",
      payload: result.success ? null : JSON.stringify(row),
      entityId: result.entityId ?? null,
    });

    await db
      .update(importJobsTable)
      .set({ processedRows: processed, successRows: success, failedRows: failed })
      .where(eq(importJobsTable.id, jobId));

    if (job.delayMs > 0) {
      await sleep(job.delayMs);
    }
  }

  await db
    .update(importJobsTable)
    .set({
      status: "completed",
      processedRows: processed,
      successRows: success,
      failedRows: failed,
      completedAt: new Date(),
    })
    .where(eq(importJobsTable.id, jobId));

  // Auto-apply BC order status if configured
  if (job.type === "orders" && job.autoCompleteStatusId) {
    const successLogs = await db
      .select()
      .from(importLogsTable)
      .where(and(eq(importLogsTable.jobId, jobId), eq(importLogsTable.status, "success")));
    const orderLogs = successLogs.filter((l) => l.entityId);
    logger.info({ jobId, statusId: job.autoCompleteStatusId, count: orderLogs.length }, "Auto-updating order statuses");
    for (const log of orderLogs) {
      const result = await updateOrderStatus(creds, log.entityId!, job.autoCompleteStatusId);
      if (!result.success) {
        logger.warn({ orderId: log.entityId, error: result.error }, "Auto-status update failed for order");
      }
    }
  }

  logger.info({ jobId, processed, success, failed }, "Import job completed");
}

export async function retryFailedRowsForJob(originalJobId: string, userId: string): Promise<string> {
  const [originalJob] = await db.select().from(importJobsTable).where(eq(importJobsTable.id, originalJobId));
  if (!originalJob) throw new Error("Job not found");

  const failedLogs = await db
    .select()
    .from(importLogsTable)
    .where(and(eq(importLogsTable.jobId, originalJobId), eq(importLogsTable.status, "error")));

  if (failedLogs.length === 0) throw new Error("No failed rows to retry");

  const originalRows = parseCsvBuffer(Buffer.from(originalJob.csvData, "base64"));
  const failedRowNums = new Set(failedLogs.map((l) => l.rowNumber));
  const retryRows = originalRows.filter((_, i) => failedRowNums.has(i + 1));

  const headers = Object.keys(retryRows[0] || {}).join(",");
  const csvContent = [headers, ...retryRows.map((r) => Object.values(r).map((v) => `"${v}"`).join(","))].join("\n");
  const newCsvBase64 = Buffer.from(csvContent).toString("base64");

  const newJobId = randomUUID();
  await db.insert(importJobsTable).values({
    id: newJobId,
    userId,
    type: originalJob.type,
    status: "pending",
    totalRows: retryRows.length,
    processedRows: 0,
    successRows: 0,
    failedRows: 0,
    delayMs: originalJob.delayMs,
    storeHash: originalJob.storeHash,
    accessToken: originalJob.accessToken,
    csvData: newCsvBase64,
  });

  runImportJob(newJobId).catch((err) => logger.error({ err, jobId: newJobId }, "Retry job failed"));

  return newJobId;
}
