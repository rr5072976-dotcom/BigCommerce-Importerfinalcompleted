import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, XCircle, Loader2, Store, Plus, ShoppingCart, Truck,
} from "lucide-react";

const BC_ORDER_STATUSES = [
  { id: 1,  label: "Pending" },
  { id: 7,  label: "Awaiting Payment" },
  { id: 11, label: "Awaiting Fulfillment" },
  { id: 2,  label: "Shipped" },
  { id: 3,  label: "Partially Shipped" },
  { id: 5,  label: "Cancelled" },
  { id: 8,  label: "Awaiting Pickup" },
  { id: 10, label: "Completed" },
  { id: 9,  label: "Awaiting Shipment" },
];

interface SavedStore {
  id: string;
  label: string | null;
  storeHash: string;
  storeName: string | null;
  accessTokenMasked: string | null;
}

function useSavedStores() {
  return useQuery<{ stores: SavedStore[] }>({
    queryKey: ["stores"],
    queryFn: async () => {
      const res = await fetch("/api/stores");
      if (!res.ok) throw new Error("Failed to load stores");
      return res.json();
    },
  });
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label} {required && <span className="text-destructive">*</span>}</Label>
      {children}
    </div>
  );
}

export default function ManualOrder() {
  const [, setLocation] = useLocation();

  const { data: storesData, isLoading: storesLoading } = useSavedStores();
  const savedStores = storesData?.stores ?? [];

  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [storeHash, setStoreHash] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const [autoSelected, setAutoSelected] = useState(false);
  if (!storesLoading && !autoSelected && savedStores.length > 0 && selectedStoreId === null) {
    setSelectedStoreId(savedStores[0].id);
    setAutoSelected(true);
  }
  if (!storesLoading && !autoSelected && savedStores.length === 0 && selectedStoreId === null) {
    setAutoSelected(true);
    setShowManualEntry(true);
  }

  const usingManual = showManualEntry || savedStores.length === 0;
  const isValidStore = usingManual ? (storeHash && accessToken) : selectedStoreId !== null;

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [sku, setSku] = useState("");
  const [quantity, setQuantity] = useState("1");

  const [street1, setStreet1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("United States");
  const [countryIso2, setCountryIso2] = useState("US");

  const [statusId, setStatusId] = useState<number | null>(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingCarrier, setTrackingCarrier] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ orderId: string } | null>(null);

  const handleSubmit = async () => {
    if (!isValidStore || !email || !sku || !street1 || !city || !zip || !country) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const body: Record<string, string> = {
        email, first_name: firstName, last_name: lastName,
        sku, quantity,
        street_1: street1, city, state, zip, country, country_iso2: countryIso2,
      };
      if (!usingManual && selectedStoreId) body.storeId = selectedStoreId;
      else { body.storeHash = storeHash; body.accessToken = accessToken; }
      if (statusId !== null) body.status_id = String(statusId);
      if (trackingNumber) body.tracking_number = trackingNumber;
      if (trackingCarrier) body.tracking_carrier = trackingCarrier;

      const res = await fetch("/api/orders/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { orderId?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSuccess({ orderId: data.orderId ?? "?" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = isValidStore && email && sku && street1 && city && zip && country && !submitting;
  const selectedStore = savedStores.find((s) => s.id === selectedStoreId) ?? null;

  return (
    <div className="space-y-6 max-w-3xl animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Create Order</h2>
        <p className="text-muted-foreground mt-1">Manually create a single order in your BigCommerce store</p>
      </div>

      {success ? (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <div>
                <p className="font-semibold text-lg">Order Created!</p>
                <p className="text-sm text-muted-foreground">BigCommerce Order ID: <span className="font-mono font-semibold">{success.orderId}</span></p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => {
                setSuccess(null);
                setEmail(""); setFirstName(""); setLastName(""); setSku(""); setQuantity("1");
                setStreet1(""); setCity(""); setState(""); setZip(""); setCountry("United States"); setCountryIso2("US");
                setStatusId(null); setTrackingNumber(""); setTrackingCarrier("");
              }}>Create Another</Button>
              <Button variant="outline" onClick={() => setLocation("/")}>Back to Dashboard</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Step 1: Store */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">1</span>
                Select Store
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {storesLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
              ) : !usingManual && savedStores.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid gap-2">
                    {savedStores.map((store) => (
                      <button key={store.id} onClick={() => setSelectedStoreId(store.id)}
                        className={`w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-all ${selectedStoreId === store.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <Store className={`w-4 h-4 shrink-0 ${selectedStoreId === store.id ? "text-primary" : "text-muted-foreground"}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{store.label ?? store.storeName ?? store.storeHash}</p>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">{store.storeHash} · {store.accessTokenMasked}</p>
                          </div>
                        </div>
                        {selectedStoreId === store.id && (
                          <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 gap-1 shrink-0 ml-3">
                            <CheckCircle2 className="w-3 h-3" /> Selected
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => setShowManualEntry(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Plus className="w-3 h-3" /> Use different credentials
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {savedStores.length > 0 && (
                    <button type="button" onClick={() => setShowManualEntry(false)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                      ← Back to saved stores
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Store Hash" required>
                      <Input placeholder="abc123xyz" value={storeHash} onChange={(e) => setStoreHash(e.target.value)} />
                    </Field>
                    <Field label="Access Token" required>
                      <Input type="password" placeholder="••••••••••••••••" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
                    </Field>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Customer */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">2</span>
                Customer
              </CardTitle>
              <CardDescription>The customer will be found by email, or created if they don't exist</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Email" required>
                  <Input type="email" placeholder="customer@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="col-span-2" />
                </Field>
                <Field label="First Name">
                  <Input placeholder="John" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </Field>
                <Field label="Last Name">
                  <Input placeholder="Smith" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </Field>
              </div>
            </CardContent>
          </Card>

          {/* Step 3: Product */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">3</span>
                Product
              </CardTitle>
              <CardDescription>The product will be looked up by SKU to get pricing and variant info</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Product SKU" required>
                  <Input placeholder="IPH17PM-256-BLK" value={sku} onChange={(e) => setSku(e.target.value)} />
                </Field>
                <Field label="Quantity">
                  <Input type="number" min="1" step="1" placeholder="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                </Field>
              </div>
            </CardContent>
          </Card>

          {/* Step 4: Address */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">4</span>
                Billing & Shipping Address
              </CardTitle>
              <CardDescription>Used for both billing and shipping addresses on this order</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label="Street Address" required>
                    <Input placeholder="123 Main St" value={street1} onChange={(e) => setStreet1(e.target.value)} />
                  </Field>
                </div>
                <Field label="City" required>
                  <Input placeholder="New York" value={city} onChange={(e) => setCity(e.target.value)} />
                </Field>
                <Field label="State / Province">
                  <Input placeholder="NY" value={state} onChange={(e) => setState(e.target.value)} />
                </Field>
                <Field label="ZIP / Postal Code" required>
                  <Input placeholder="10001" value={zip} onChange={(e) => setZip(e.target.value)} />
                </Field>
                <Field label="Country ISO2">
                  <Input placeholder="US" maxLength={2} value={countryIso2} onChange={(e) => setCountryIso2(e.target.value.toUpperCase())} />
                </Field>
                <div className="col-span-2">
                  <Field label="Country" required>
                    <Input placeholder="United States" value={country} onChange={(e) => setCountry(e.target.value)} />
                  </Field>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 5: Order Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">5</span>
                Order Status
                <Badge variant="outline" className="text-xs font-normal ml-1">Optional</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                <button onClick={() => setStatusId(null)}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center text-xs transition-all gap-1 ${statusId === null ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-muted-foreground/40"}`}>
                  <span className="text-base">—</span>
                  <span className="font-medium">Default</span>
                </button>
                {BC_ORDER_STATUSES.map((s) => (
                  <button key={s.id} onClick={() => setStatusId(s.id)}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center text-xs transition-all gap-1 ${statusId === s.id ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-muted-foreground/40"}`}>
                    <ShoppingCart className={`w-3.5 h-3.5 ${statusId === s.id ? "text-primary" : ""}`} />
                    <span className="font-medium leading-tight">{s.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Step 6: Tracking */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">6</span>
                Tracking Info
                <Badge variant="outline" className="text-xs font-normal ml-1">Optional</Badge>
              </CardTitle>
              <CardDescription>Add a shipment with tracking number to this order</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Tracking Number">
                  <Input placeholder="1Z999AA10123456784" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
                </Field>
                <Field label="Carrier">
                  <Input placeholder="ups, fedex, usps…" value={trackingCarrier} onChange={(e) => setTrackingCarrier(e.target.value)} />
                </Field>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              {error && (
                <p className="text-sm text-destructive flex items-center gap-2">
                  <XCircle className="w-4 h-4 shrink-0" /> {error}
                </p>
              )}
              {isValidStore && selectedStore && !usingManual && (
                <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2 text-xs">
                  <Store className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  <span className="text-muted-foreground">Creating in:</span>
                  <span className="font-medium">{selectedStore.label ?? selectedStore.storeName ?? selectedStore.storeHash}</span>
                </div>
              )}
              <div className="flex gap-3">
                <Button size="lg" className="flex-1" onClick={handleSubmit} disabled={!canSubmit}>
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating Order...</>
                  ) : (
                    <><Truck className="w-4 h-4 mr-2" /> Create Order</>
                  )}
                </Button>
                <Button size="lg" variant="outline" onClick={() => setLocation("/import")}>
                  Bulk Import Instead
                </Button>
              </div>
              {!isValidStore && (
                <p className="text-xs text-muted-foreground text-center">Select a store to enable order creation</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
