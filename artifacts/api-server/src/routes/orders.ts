import { Router, type IRouter, type Request } from "express";
import { db, storeSettingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { updateOrderStatus, createManualOrder } from "../lib/bigcommerce.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

function uid(req: Request): string {
  return (req as Request & { userId: string }).userId;
}

async function resolveCredentials(body: Record<string, unknown>, userId: string): Promise<{ storeHash: string; accessToken: string } | null> {
  if (typeof body.storeId === "string" && body.storeId) {
    const rows = await db.select().from(storeSettingsTable)
      .where(and(eq(storeSettingsTable.id, body.storeId), eq(storeSettingsTable.userId, userId)))
      .limit(1);
    if (rows.length === 0) return null;
    return { storeHash: rows[0].storeHash, accessToken: rows[0].accessToken };
  }
  const storeHash = typeof body.storeHash === "string" ? body.storeHash : null;
  const accessToken = typeof body.accessToken === "string" ? body.accessToken : null;
  if (!storeHash || !accessToken) return null;
  return { storeHash, accessToken };
}

const BC_STATUS_LABELS: Record<number, string> = {
  1: "Pending", 2: "Awaiting Payment", 3: "Awaiting Fulfillment", 4: "Shipped",
  5: "Partially Shipped", 7: "Cancelled", 9: "Awaiting Pickup", 10: "Completed", 11: "Awaiting Shipment",
};

// POST /orders/manual
router.post("/orders/manual", async (req, res): Promise<void> => {
  const userId = uid(req);
  const creds = await resolveCredentials(req.body, userId);
  if (!creds) { res.status(400).json({ error: "Store credentials are required." }); return; }

  const { email, first_name, last_name, sku, quantity, street_1, city, state, zip, country, country_iso2, status_id, tracking_number, tracking_carrier } = req.body as Record<string, string>;

  if (!email || !sku) { res.status(400).json({ error: "email and sku are required" }); return; }
  if (!street_1 || !city || !zip || !country) { res.status(400).json({ error: "street_1, city, zip, and country are required" }); return; }

  const result = await createManualOrder(creds, {
    email, first_name: first_name || "", last_name: last_name || "", sku,
    quantity: parseInt(quantity, 10) || 1, street_1, city, state: state || "",
    zip, country, country_iso2: country_iso2 || "",
    status_id: status_id ? parseInt(status_id, 10) : undefined,
    tracking_number: tracking_number || undefined, tracking_carrier: tracking_carrier || undefined,
  });

  if (!result.success) { res.status(422).json({ error: result.error }); return; }
  logger.info({ orderId: result.orderId }, "Manual order created");
  res.status(201).json({ orderId: result.orderId });
});

// POST /orders/status
router.post("/orders/status", async (req, res): Promise<void> => {
  const userId = uid(req);
  const { orderIds, statusId } = req.body as { orderIds?: unknown; statusId?: unknown };

  if (!Array.isArray(orderIds) || orderIds.length === 0) { res.status(400).json({ error: "orderIds must be a non-empty array of integers" }); return; }

  const parsedStatus = typeof statusId === "number" ? statusId : parseInt(String(statusId), 10);
  if (isNaN(parsedStatus)) { res.status(400).json({ error: "statusId must be a valid integer" }); return; }
  if (!BC_STATUS_LABELS[parsedStatus]) { res.status(400).json({ error: `Unknown statusId ${parsedStatus}` }); return; }

  const parsedIds = (orderIds as unknown[]).map((id) => {
    const n = typeof id === "number" ? id : parseInt(String(id), 10);
    return isNaN(n) ? null : n;
  });
  if (parsedIds.some((id) => id === null)) { res.status(400).json({ error: "All orderIds must be valid integers" }); return; }

  const rows = await db.select().from(storeSettingsTable)
    .where(eq(storeSettingsTable.userId, userId)).limit(1);
  if (rows.length === 0) { res.status(422).json({ error: "Store not configured." }); return; }

  const { storeHash, accessToken } = rows[0];
  const results: Array<{ orderId: number; success: boolean; error?: string | null }> = [];
  for (const orderId of parsedIds as number[]) {
    const result = await updateOrderStatus({ storeHash, accessToken }, String(orderId), parsedStatus);
    results.push({ orderId, success: result.success, error: result.success ? null : (result.error ?? "Unknown error") });
  }
  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;
  res.json({ results, successCount, failedCount });
});

export default router;
