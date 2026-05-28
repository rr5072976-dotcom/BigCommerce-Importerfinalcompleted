import { Router, type IRouter } from "express";
import { db, storeSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { validateStore } from "../lib/bigcommerce.js";

const router: IRouter = Router();

const SETTINGS_ID = "default";

function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 4) return "••••";
  return "••••••••••••" + value.slice(-4);
}

interface BCWebhook {
  id: number;
  client_id: string;
  store_hash: string;
  created_at: number;
  updated_at: number;
  scope: string;
  destination: string;
  is_active: boolean;
  headers: Record<string, string> | null;
}

async function bcRequest(
  storeHash: string,
  accessToken: string,
  method: string,
  path: string,
  body?: unknown
): Promise<Response> {
  return fetch(`https://api.bigcommerce.com/stores/${storeHash}/v2${path}`, {
    method,
    headers: {
      "X-Auth-Token": accessToken,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

// GET /settings
router.get("/settings", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(storeSettingsTable)
    .where(eq(storeSettingsTable.id, SETTINGS_ID))
    .limit(1);

  if (rows.length === 0) {
    res.json({
      configured: false,
      storeHash: null,
      clientId: null,
      storeName: null,
      storeUrl: null,
      updatedAt: null,
    });
    return;
  }

  const row = rows[0];
  res.json({
    configured: true,
    storeHash: row.storeHash,
    clientId: row.clientId ?? null,
    accessTokenMasked: maskSecret(row.accessToken),
    clientSecretConfigured: row.clientSecret != null && row.clientSecret.length > 0,
    storeName: row.storeName ?? null,
    storeUrl: row.storeUrl ?? null,
    updatedAt: row.updatedAt,
  });
});

// PUT /settings
router.put("/settings", async (req, res): Promise<void> => {
  const { storeHash, accessToken, clientId, clientSecret } = req.body as {
    storeHash?: string;
    accessToken?: string;
    clientId?: string;
    clientSecret?: string;
  };

  if (!storeHash || !accessToken) {
    res.status(400).json({ error: "storeHash and accessToken are required" });
    return;
  }

  // Validate and fetch store details
  const validation = await validateStore({ storeHash, accessToken });
  if (!validation.valid) {
    res.status(422).json({ error: validation.error ?? "Invalid credentials" });
    return;
  }

  // Fetch store URL
  let storeUrl: string | null = null;
  try {
    const infoRes = await bcRequest(storeHash, accessToken, "GET", "/store");
    if (infoRes.ok) {
      const info = (await infoRes.json()) as { domain?: string; secure_url?: string };
      storeUrl = info.secure_url ?? info.domain ?? null;
    }
  } catch {
    // best-effort
  }

  await db
    .insert(storeSettingsTable)
    .values({
      id: SETTINGS_ID,
      storeHash,
      accessToken,
      clientId: clientId ?? null,
      clientSecret: clientSecret ?? null,
      storeName: validation.storeName ?? null,
      storeUrl,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: storeSettingsTable.id,
      set: {
        storeHash,
        accessToken,
        clientId: clientId ?? null,
        clientSecret: clientSecret ?? null,
        storeName: validation.storeName ?? null,
        storeUrl,
        updatedAt: new Date(),
      },
    });

  res.json({
    configured: true,
    storeHash,
    storeName: validation.storeName ?? null,
    storeUrl,
  });
});

// GET /settings/webhooks
router.get("/settings/webhooks", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(storeSettingsTable)
    .where(eq(storeSettingsTable.id, SETTINGS_ID))
    .limit(1);

  if (rows.length === 0) {
    res.status(422).json({ error: "Store not configured. Save settings first." });
    return;
  }

  const { storeHash, accessToken } = rows[0];
  const bcRes = await bcRequest(storeHash, accessToken, "GET", "/hooks");

  if (!bcRes.ok) {
    const text = await bcRes.text();
    res.status(502).json({ error: `BigCommerce error: ${bcRes.status} ${text}` });
    return;
  }

  const webhooks = (await bcRes.json()) as BCWebhook[];
  res.json({ webhooks: Array.isArray(webhooks) ? webhooks : [] });
});

// POST /settings/webhooks
router.post("/settings/webhooks", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(storeSettingsTable)
    .where(eq(storeSettingsTable.id, SETTINGS_ID))
    .limit(1);

  if (rows.length === 0) {
    res.status(422).json({ error: "Store not configured. Save settings first." });
    return;
  }

  const { storeHash, accessToken } = rows[0];
  const { scope, destination } = req.body as { scope?: string; destination?: string };

  if (!scope || !destination) {
    res.status(400).json({ error: "scope and destination are required" });
    return;
  }

  const bcRes = await bcRequest(storeHash, accessToken, "POST", "/hooks", {
    scope,
    destination,
    is_active: true,
    headers: {},
  });

  if (!bcRes.ok) {
    const text = await bcRes.text();
    res.status(502).json({ error: `BigCommerce error: ${bcRes.status} ${text}` });
    return;
  }

  const webhook = (await bcRes.json()) as BCWebhook;
  res.status(201).json(webhook);
});

// DELETE /settings/webhooks/:webhookId
router.delete("/settings/webhooks/:webhookId", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(storeSettingsTable)
    .where(eq(storeSettingsTable.id, SETTINGS_ID))
    .limit(1);

  if (rows.length === 0) {
    res.status(422).json({ error: "Store not configured." });
    return;
  }

  const { storeHash, accessToken } = rows[0];
  const { webhookId } = req.params;

  const bcRes = await bcRequest(
    storeHash,
    accessToken,
    "DELETE",
    `/hooks/${webhookId}`
  );

  if (!bcRes.ok && bcRes.status !== 204) {
    const text = await bcRes.text();
    res.status(502).json({ error: `BigCommerce error: ${bcRes.status} ${text}` });
    return;
  }

  res.status(204).send();
});

export default router;
