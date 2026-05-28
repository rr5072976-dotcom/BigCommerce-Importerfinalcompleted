import FormData from "form-data";

export interface BigCommerceCredentials {
  storeHash: string;
  accessToken: string;
}

const baseUrl = (storeHash: string) =>
  `https://api.bigcommerce.com/stores/${storeHash}/v2`;
const v3Url = (storeHash: string) =>
  `https://api.bigcommerce.com/stores/${storeHash}/v3`;

async function safeJson<T>(res: Response, fallback: T): Promise<T> {
  const text = await res.text();
  if (!text || !text.trim()) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function headers(accessToken: string) {
  return {
    "X-Auth-Token": accessToken,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function validateStore(creds: BigCommerceCredentials): Promise<{ valid: boolean; storeName?: string; error?: string }> {
  try {
    const res = await fetch(`${baseUrl(creds.storeHash)}/store`, {
      headers: headers(creds.accessToken),
    });
    if (!res.ok) {
      const err = await res.text();
      return { valid: false, error: `HTTP ${res.status}: ${err}` };
    }
    const data = await safeJson<{ name?: string }>(res, {});
    return { valid: true, storeName: data.name };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function createCustomer(
  creds: BigCommerceCredentials,
  row: Record<string, string>
): Promise<{ success: boolean; entityId?: string; error?: string }> {
  const payload = {
    first_name: row.first_name || "",
    last_name: row.last_name || "",
    email: row.email || "",
    phone: row.phone || "",
    company: row.company || "",
  };
  const res = await fetch(`${v3Url(creds.storeHash)}/customers`, {
    method: "POST",
    headers: headers(creds.accessToken),
    body: JSON.stringify([payload]),
  });
  if (res.status === 429) return { success: false, error: "Rate limit exceeded (429)" };
  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: `HTTP ${res.status}: ${err}` };
  }
  const data = await safeJson<{ data?: Array<{ id: number }> }>(res, {});
  const entityId = data.data?.[0]?.id?.toString();
  return { success: true, entityId };
}

export async function createProduct(
  creds: BigCommerceCredentials,
  row: Record<string, string>
): Promise<{ success: boolean; entityId?: string; error?: string }> {
  const payload = {
    name: row.name || "",
    type: row.type || "physical",
    price: parseFloat(row.price) || 0,
    sku: row.sku || "",
    weight: parseFloat(row.weight) || 0,
    description: row.description || "",
    inventory_level: parseInt(row.inventory_level, 10) || 0,
  };
  const res = await fetch(`${v3Url(creds.storeHash)}/catalog/products`, {
    method: "POST",
    headers: headers(creds.accessToken),
    body: JSON.stringify(payload),
  });
  if (res.status === 429) return { success: false, error: "Rate limit exceeded (429)" };
  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: `HTTP ${res.status}: ${err}` };
  }
  const data = await safeJson<{ data?: { id: number } }>(res, {});
  const productId = data.data?.id;
  const entityId = productId?.toString();

  // Upload product image if image_url is provided
  const imageUrl = row.image_url?.trim();
  if (productId && imageUrl) {
    try {
      await fetch(`${v3Url(creds.storeHash)}/catalog/products/${productId}/images`, {
        method: "POST",
        headers: headers(creds.accessToken),
        body: JSON.stringify({ image_url: imageUrl, is_thumbnail: true, sort_order: 0 }),
      });
    } catch {
      // Image upload failure is non-fatal — product was still created
    }
  }

  return { success: true, entityId };
}

export async function findOrCreateCustomerByEmail(
  creds: BigCommerceCredentials,
  email: string,
  firstName: string,
  lastName: string
): Promise<{ customerId?: number; error?: string }> {
  const searchRes = await fetch(
    `${v3Url(creds.storeHash)}/customers?email:in=${encodeURIComponent(email)}`,
    { headers: headers(creds.accessToken) }
  );
  if (searchRes.ok) {
    const data = await safeJson<{ data?: Array<{ id: number }> }>(searchRes, {});
    if (data.data && data.data.length > 0) {
      return { customerId: data.data[0].id };
    }
  }
  const createRes = await fetch(`${v3Url(creds.storeHash)}/customers`, {
    method: "POST",
    headers: headers(creds.accessToken),
    body: JSON.stringify([{ email, first_name: firstName, last_name: lastName }]),
  });
  if (!createRes.ok) {
    const err = await createRes.text();
    return { error: `Failed to create customer: HTTP ${createRes.status}: ${err}` };
  }
  const created = await safeJson<{ data?: Array<{ id: number }> }>(createRes, {});
  if (!created.data || created.data.length === 0) {
    return { error: "Customer creation returned no data" };
  }
  return { customerId: created.data[0].id };
}

export async function findProductBySku(
  creds: BigCommerceCredentials,
  sku: string
): Promise<{ productId?: number; variantId?: number; price?: number; error?: string }> {
  const res = await fetch(
    `${v3Url(creds.storeHash)}/catalog/products?sku=${encodeURIComponent(sku)}&include=variants`,
    { headers: headers(creds.accessToken) }
  );
  if (!res.ok) {
    return { error: `SKU lookup failed: HTTP ${res.status}` };
  }
  const data = await safeJson<{ data?: Array<{ id: number; price: number; variants?: Array<{ id: number }> }> }>(res, {});
  if (!data.data || data.data.length === 0) {
    return { error: `Product with SKU "${sku}" not found` };
  }
  const product = data.data[0];
  const variantId = product.variants?.[0]?.id;
  return { productId: product.id, variantId, price: product.price };
}

export async function createOrder(
  creds: BigCommerceCredentials,
  row: Record<string, string>,
  customerId: number,
  productId: number,
  variantId: number | undefined,
  price: number
): Promise<{ success: boolean; entityId?: string; error?: string }> {
  const qty = parseInt(row.quantity, 10) || 1;
  const addr = {
    first_name: row.first_name || "",
    last_name: row.last_name || "",
    street_1: row.street_1 || row.street || "",
    city: row.city || "",
    country: row.country || "",
    country_iso2: row.country_iso2 || "",
    state: row.state || "",
    zip: row.zip || "",
    email: row.email || "",
  };
  const currencyCode = row.currency_code?.trim().toUpperCase();
  const payload: Record<string, unknown> = {
    customer_id: customerId,
    billing_address: addr,
    shipping_addresses: [addr],
    products: [
      {
        product_id: productId,
        quantity: qty,
        price_inc_tax: price,
        price_ex_tax: price,
        ...(variantId ? { variant_id: variantId } : {}),
      },
    ],
    ...(currencyCode ? { currency_code: currencyCode } : {}),
  };
  const res = await fetch(`${baseUrl(creds.storeHash)}/orders`, {
    method: "POST",
    headers: headers(creds.accessToken),
    body: JSON.stringify(payload),
  });
  if (res.status === 429) return { success: false, error: "Rate limit exceeded (429)" };
  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: `HTTP ${res.status}: ${err}` };
  }
  const data = await safeJson<{ id?: number }>(res, {});
  const entityId = data.id?.toString();
  return { success: true, entityId };
}

export async function addShipment(
  creds: BigCommerceCredentials,
  orderId: string,
  trackingNumber: string,
  trackingCarrier: string,
  comments: string
): Promise<{ success: boolean; error?: string }> {
  const shipAddrRes = await fetch(`${baseUrl(creds.storeHash)}/orders/${orderId}/shipping_addresses`, {
    headers: headers(creds.accessToken),
  });
  if (!shipAddrRes.ok) {
    return { success: false, error: `Could not fetch shipping addresses: HTTP ${shipAddrRes.status}` };
  }
  const shipAddrs = await safeJson<Array<{ id: number }>>(shipAddrRes, []);
  if (!shipAddrs || shipAddrs.length === 0) {
    return { success: false, error: "No shipping address found on order" };
  }

  const productsRes = await fetch(`${baseUrl(creds.storeHash)}/orders/${orderId}/products`, {
    headers: headers(creds.accessToken),
  });
  if (!productsRes.ok) {
    return { success: false, error: `Could not fetch order products: HTTP ${productsRes.status}` };
  }
  const orderProducts = await safeJson<Array<{ id: number; quantity: number }>>(productsRes, []);

  const carrier = trackingCarrier.toLowerCase().trim();
  const payload = {
    order_address_id: shipAddrs[0].id,
    tracking_number: trackingNumber,
    shipping_provider: carrier || "",
    tracking_carrier: carrier || "",
    comments: comments || "",
    items: orderProducts.map((p) => ({ order_product_id: p.id, quantity: p.quantity })),
  };

  const res = await fetch(`${baseUrl(creds.storeHash)}/orders/${orderId}/shipments`, {
    method: "POST",
    headers: headers(creds.accessToken),
    body: JSON.stringify(payload),
  });
  if (res.status === 429) return { success: false, error: "Rate limit exceeded (429)" };
  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: `Shipment creation failed: HTTP ${res.status}: ${err}` };
  }
  return { success: true };
}

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp",
]);

export async function uploadProductImageFile(
  creds: BigCommerceCredentials,
  productId: number,
  imageBuffer: Buffer,
  imageName: string,
  imageMime: string
): Promise<{ success: boolean; error?: string }> {
  const mime = imageMime.toLowerCase();
  if (!SUPPORTED_IMAGE_TYPES.has(mime)) {
    return {
      success: false,
      error: `Unsupported image format "${imageMime}". BigCommerce accepts JPEG, PNG, GIF, or WebP. iPhone HEIC photos must be converted before uploading.`,
    };
  }

  const form = new FormData();
  form.append("image_file", imageBuffer, {
    filename: imageName,
    contentType: mime,
    knownLength: imageBuffer.length,
  });
  form.append("is_thumbnail", "true");
  form.append("sort_order", "0");

  const res = await fetch(`${v3Url(creds.storeHash)}/catalog/products/${productId}/images`, {
    method: "POST",
    headers: {
      "X-Auth-Token": creds.accessToken,
      Accept: "application/json",
      ...form.getHeaders(),
    },
    body: form as unknown as BodyInit,
  });

  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: `Image upload failed (HTTP ${res.status}): ${err}` };
  }
  return { success: true };
}

export async function createManualProduct(
  creds: BigCommerceCredentials,
  data: {
    name: string;
    sku: string;
    price: number;
    type: string;
    weight: number;
    description: string;
    inventory_level: number;
    image_url?: string;
  }
): Promise<{ success: boolean; productId?: number; entityId?: string; error?: string }> {
  const payload = {
    name: data.name,
    type: data.type || "physical",
    price: data.price,
    sku: data.sku,
    weight: data.weight || 0,
    description: data.description || "",
    inventory_level: data.inventory_level || 0,
  };
  const res = await fetch(`${v3Url(creds.storeHash)}/catalog/products`, {
    method: "POST",
    headers: headers(creds.accessToken),
    body: JSON.stringify(payload),
  });
  if (res.status === 429) return { success: false, error: "Rate limit exceeded (429)" };
  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: `HTTP ${res.status}: ${err}` };
  }
  const result = await safeJson<{ data?: { id: number } }>(res, {});
  const productId = result.data?.id;
  if (!productId) return { success: false, error: "Product creation returned no ID" };

  if (data.image_url) {
    try {
      await fetch(`${v3Url(creds.storeHash)}/catalog/products/${productId}/images`, {
        method: "POST",
        headers: headers(creds.accessToken),
        body: JSON.stringify({ image_url: data.image_url, is_thumbnail: true, sort_order: 0 }),
      });
    } catch {
      // non-fatal
    }
  }

  return { success: true, productId, entityId: String(productId) };
}

export async function createManualOrder(
  creds: BigCommerceCredentials,
  data: {
    email: string;
    first_name: string;
    last_name: string;
    sku: string;
    quantity: number;
    street_1: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    country_iso2: string;
    status_id?: number;
    tracking_number?: string;
    tracking_carrier?: string;
  }
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  const { customerId, error: custErr } = await findOrCreateCustomerByEmail(
    creds, data.email, data.first_name, data.last_name
  );
  if (!customerId) return { success: false, error: custErr ?? "Could not find/create customer" };

  const { productId, variantId, price, error: skuErr } = await findProductBySku(creds, data.sku);
  if (!productId) return { success: false, error: skuErr ?? "Product SKU not found" };

  const addr = {
    first_name: data.first_name,
    last_name: data.last_name,
    street_1: data.street_1,
    city: data.city,
    state: data.state,
    zip: data.zip,
    country: data.country,
    country_iso2: data.country_iso2,
    email: data.email,
  };

  const payload: Record<string, unknown> = {
    customer_id: customerId,
    billing_address: addr,
    shipping_addresses: [addr],
    products: [
      {
        product_id: productId,
        quantity: data.quantity,
        price_inc_tax: price ?? 0,
        price_ex_tax: price ?? 0,
        ...(variantId ? { variant_id: variantId } : {}),
      },
    ],
  };
  if (data.status_id) payload.status_id = data.status_id;

  const res = await fetch(`${baseUrl(creds.storeHash)}/orders`, {
    method: "POST",
    headers: headers(creds.accessToken),
    body: JSON.stringify(payload),
  });
  if (res.status === 429) return { success: false, error: "Rate limit exceeded (429)" };
  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: `HTTP ${res.status}: ${err}` };
  }
  const orderData = await safeJson<{ id?: number }>(res, {});
  const orderId = orderData.id?.toString();

  if (orderId && data.tracking_number) {
    await addShipment(creds, orderId, data.tracking_number, data.tracking_carrier ?? "", "");
  }

  return { success: true, orderId };
}

export async function updateOrderStatus(
  creds: BigCommerceCredentials,
  orderId: string,
  statusId: number
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${baseUrl(creds.storeHash)}/orders/${orderId}`, {
    method: "PUT",
    headers: headers(creds.accessToken),
    body: JSON.stringify({ status_id: statusId }),
  });
  if (res.status === 429) return { success: false, error: "Rate limit exceeded (429)" };
  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: `HTTP ${res.status}: ${err}` };
  }
  return { success: true };
}
