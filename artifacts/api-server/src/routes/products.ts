import { Router, type IRouter, type Request } from "express";
import multer from "multer";
import { db, storeSettingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { createManualProduct, uploadProductImageFile } from "../lib/bigcommerce.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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

// POST /products/manual
router.post("/products/manual", upload.single("image_file"), async (req, res): Promise<void> => {
  const userId = uid(req);
  const creds = await resolveCredentials(req.body, userId);
  if (!creds) { res.status(400).json({ error: "Store credentials are required." }); return; }

  const { name, sku, price, type, weight, description, inventory_level, image_url } = req.body as Record<string, string>;

  if (!name || !sku || !price) { res.status(400).json({ error: "name, sku, and price are required" }); return; }

  const parsedPrice = parseFloat(price);
  if (isNaN(parsedPrice) || parsedPrice < 0) { res.status(400).json({ error: "price must be a valid positive number" }); return; }

  const result = await createManualProduct(creds, {
    name, sku, price: parsedPrice, type: type || "physical",
    weight: parseFloat(weight) || 0, description: description || "",
    inventory_level: parseInt(inventory_level, 10) || 0,
    image_url: image_url || undefined,
  });

  if (!result.success) { res.status(422).json({ error: result.error }); return; }

  if (result.productId && req.file) {
    const imgResult = await uploadProductImageFile(creds, result.productId, req.file.buffer, req.file.originalname, req.file.mimetype);
    if (!imgResult.success) {
      logger.warn({ productId: result.productId, error: imgResult.error }, "Product image upload failed (non-fatal)");
      res.status(201).json({ productId: result.productId, entityId: result.entityId, imageWarning: imgResult.error });
      return;
    }
  }

  res.status(201).json({ productId: result.productId, entityId: result.entityId });
});

export default router;
