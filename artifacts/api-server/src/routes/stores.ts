import { Router, type IRouter, type Request } from "express";
import { db, storeSettingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { validateStore } from "../lib/bigcommerce.js";
import { randomUUID } from "crypto";

const router: IRouter = Router();
const MAX_STORES = 5;

function uid(req: Request): string {
  return (req as Request & { userId: string }).userId;
}

function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 4) return "••••";
  return "••••••••••••" + value.slice(-4);
}

async function bcGetStore(storeHash: string, accessToken: string): Promise<{ domain?: string; secure_url?: string } | null> {
  try {
    const res = await fetch(`https://api.bigcommerce.com/stores/${storeHash}/v2/store`, {
      headers: { "X-Auth-Token": accessToken, "Content-Type": "application/json", Accept: "application/json" },
    });
    if (res.ok) return res.json() as Promise<{ domain?: string; secure_url?: string }>;
  } catch { /* best-effort */ }
  return null;
}

function formatStore(row: typeof storeSettingsTable.$inferSelect) {
  return {
    id: row.id,
    label: row.label ?? null,
    storeHash: row.storeHash,
    storeName: row.storeName ?? null,
    storeUrl: row.storeUrl ?? null,
    clientId: row.clientId ?? null,
    clientSecretConfigured: row.clientSecret != null && row.clientSecret.length > 0,
    accessTokenMasked: maskSecret(row.accessToken),
    updatedAt: row.updatedAt,
  };
}

// GET /stores
router.get("/stores", async (req, res): Promise<void> => {
  const userId = uid(req);
  const rows = await db.select().from(storeSettingsTable)
    .where(eq(storeSettingsTable.userId, userId))
    .orderBy(storeSettingsTable.updatedAt);
  res.json({ stores: rows.map(formatStore), count: rows.length, maxStores: MAX_STORES });
});

// POST /stores
router.post("/stores", async (req, res): Promise<void> => {
  const userId = uid(req);
  const { storeHash, accessToken, clientId, clientSecret, label } = req.body as {
    storeHash?: string; accessToken?: string; clientId?: string; clientSecret?: string; label?: string;
  };

  if (!storeHash || !accessToken) {
    res.status(400).json({ error: "storeHash and accessToken are required" });
    return;
  }

  const existing = await db.select().from(storeSettingsTable).where(eq(storeSettingsTable.userId, userId));
  if (existing.length >= MAX_STORES) {
    res.status(422).json({ error: `Maximum of ${MAX_STORES} stores allowed. Remove one to add another.` });
    return;
  }

  const validation = await validateStore({ storeHash, accessToken });
  if (!validation.valid) {
    res.status(422).json({ error: validation.error ?? "Invalid credentials" });
    return;
  }

  const info = await bcGetStore(storeHash, accessToken);
  const storeUrl = info?.secure_url ?? info?.domain ?? null;
  const id = randomUUID();

  await db.insert(storeSettingsTable).values({
    id, userId, label: label?.trim() || null, storeHash, accessToken,
    clientId: clientId ?? null, clientSecret: clientSecret ?? null,
    storeName: validation.storeName ?? null, storeUrl, updatedAt: new Date(),
  });

  const [row] = await db.select().from(storeSettingsTable).where(eq(storeSettingsTable.id, id));
  res.status(201).json(formatStore(row));
});

// PUT /stores/:id
router.put("/stores/:id", async (req, res): Promise<void> => {
  const userId = uid(req);
  const { id } = req.params;
  const { storeHash, accessToken, clientId, clientSecret, label } = req.body as {
    storeHash?: string; accessToken?: string; clientId?: string; clientSecret?: string; label?: string;
  };

  const [existing] = await db.select().from(storeSettingsTable)
    .where(and(eq(storeSettingsTable.id, id), eq(storeSettingsTable.userId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Store not found" });
    return;
  }

  const resolvedHash = storeHash?.trim() || existing.storeHash;
  const resolvedToken = accessToken?.trim() || existing.accessToken;

  let storeName = existing.storeName;
  let storeUrl = existing.storeUrl;
  if (storeHash || accessToken) {
    const validation = await validateStore({ storeHash: resolvedHash, accessToken: resolvedToken });
    if (!validation.valid) {
      res.status(422).json({ error: validation.error ?? "Invalid credentials" });
      return;
    }
    storeName = validation.storeName ?? storeName;
    const info = await bcGetStore(resolvedHash, resolvedToken);
    storeUrl = info?.secure_url ?? info?.domain ?? storeUrl;
  }

  await db.update(storeSettingsTable).set({
    label: label !== undefined ? (label.trim() || null) : existing.label,
    storeHash: resolvedHash, accessToken: resolvedToken,
    clientId: clientId !== undefined ? (clientId || null) : existing.clientId,
    clientSecret: clientSecret !== undefined ? (clientSecret || null) : existing.clientSecret,
    storeName, storeUrl, updatedAt: new Date(),
  }).where(and(eq(storeSettingsTable.id, id), eq(storeSettingsTable.userId, userId)));

  const [row] = await db.select().from(storeSettingsTable).where(eq(storeSettingsTable.id, id));
  res.json(formatStore(row));
});

// POST /stores/:id/set-default-currency
router.post("/stores/:id/set-default-currency", async (req, res): Promise<void> => {
  const userId = uid(req);
  const { id } = req.params;
  const { currencyCode = "USD" } = req.body as { currencyCode?: string };

  const [store] = await db.select().from(storeSettingsTable)
    .where(and(eq(storeSettingsTable.id, id), eq(storeSettingsTable.userId, userId)));
  if (!store) {
    res.status(404).json({ error: "Store not found" });
    return;
  }

  const { storeHash, accessToken } = store;
  const bcHeaders = { "X-Auth-Token": accessToken, "Content-Type": "application/json", Accept: "application/json" };
  const v2 = `https://api.bigcommerce.com/stores/${storeHash}/v2`;

  // List existing currencies
  const listRes = await fetch(`${v2}/currencies`, { headers: bcHeaders });
  if (!listRes.ok) {
    const text = await listRes.text();
    res.status(502).json({ error: `BigCommerce error listing currencies: ${listRes.status} ${text}` });
    return;
  }
  const currencies = (await listRes.json()) as Array<{ id: number; code: string; is_default: boolean }>;
  const existing = currencies.find((c) => c.code.toUpperCase() === currencyCode.toUpperCase());

  if (existing) {
    if (existing.is_default) {
      res.json({ message: `${currencyCode} is already the default currency.` });
      return;
    }
    // Set existing currency as default
    const putRes = await fetch(`${v2}/currencies/${existing.id}`, {
      method: "PUT",
      headers: bcHeaders,
      body: JSON.stringify({ is_default: true }),
    });
    if (!putRes.ok) {
      const text = await putRes.text();
      res.status(502).json({ error: `BigCommerce error updating currency: ${putRes.status} ${text}` });
      return;
    }
    res.json({ message: `${currencyCode} is now the default currency.` });
    return;
  }

  // Currency doesn't exist — create it as default
  const createRes = await fetch(`${v2}/currencies`, {
    method: "POST",
    headers: bcHeaders,
    body: JSON.stringify({
      country_iso2: "US",
      currency_code: currencyCode,
      currency_exchange_rate: "1.0000000",
      name: "US Dollar",
      token: "$",
      token_location: "left",
      decimal_token: ".",
      thousands_token: ",",
      decimal_places: 2,
      is_default: true,
      is_enabled: true,
    }),
  });
  if (!createRes.ok) {
    const text = await createRes.text();
    res.status(502).json({ error: `BigCommerce error creating currency: ${createRes.status} ${text}` });
    return;
  }
  res.status(201).json({ message: `${currencyCode} created and set as the default currency.` });
});

// DELETE /stores/:id
router.delete("/stores/:id", async (req, res): Promise<void> => {
  const userId = uid(req);
  const { id } = req.params;
  const [existing] = await db.select().from(storeSettingsTable)
    .where(and(eq(storeSettingsTable.id, id), eq(storeSettingsTable.userId, userId)));
  if (!existing) {
    res.status(404).json({ error: "Store not found" });
    return;
  }
  await db.delete(storeSettingsTable).where(and(eq(storeSettingsTable.id, id), eq(storeSettingsTable.userId, userId)));
  res.status(204).send();
});

export default router;
