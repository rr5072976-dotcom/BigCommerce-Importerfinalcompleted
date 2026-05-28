import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Store,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Plus,
  Loader2,
  Eye,
  EyeOff,
  Link as LinkIcon,
  Pencil,
  X,
  DollarSign,
} from "lucide-react";

interface StoreRecord {
  id: string;
  label: string | null;
  storeHash: string;
  storeName: string | null;
  storeUrl: string | null;
  clientId: string | null;
  clientSecretConfigured: boolean;
  accessTokenMasked: string | null;
  updatedAt: string;
}

interface StoresResponse {
  stores: StoreRecord[];
  count: number;
  maxStores: number;
}

const BASE = "/api";

function useStores() {
  return useQuery<StoresResponse>({
    queryKey: ["stores"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/stores`);
      if (!res.ok) throw new Error("Failed to load stores");
      return res.json();
    },
  });
}

function useAddStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { label?: string; storeHash: string; accessToken: string; clientId?: string; clientSecret?: string }) => {
      const res = await fetch(`${BASE}/stores`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error ?? "Failed to add store");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stores"] }),
  });
}

function useUpdateStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; label?: string; storeHash?: string; accessToken?: string; clientId?: string; clientSecret?: string }) => {
      const res = await fetch(`${BASE}/stores/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error ?? "Failed to update store");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stores"] }),
  });
}

function useDeleteStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${BASE}/stores/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete store");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stores"] }),
  });
}

function useSetDefaultCurrency() {
  return useMutation({
    mutationFn: async ({ id, currencyCode = "USD" }: { id: string; currencyCode?: string }) => {
      const res = await fetch(`${BASE}/stores/${id}/set-default-currency`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currencyCode }),
      });
      const data = await res.json().catch(() => ({ error: "Request failed" }));
      if (!res.ok) throw new Error(data.error ?? "Failed to set default currency");
      return data as { message: string };
    },
  });
}

interface StoreFormState {
  label: string;
  storeHash: string;
  accessToken: string;
  clientId: string;
  clientSecret: string;
}

const EMPTY_FORM: StoreFormState = { label: "", storeHash: "", accessToken: "", clientId: "", clientSecret: "" };

function extractStoreHash(apiPath: string): string {
  const match = apiPath.match(/\/stores\/([^/]+)/);
  return match ? match[1] : "";
}

function StoreForm({
  initial,
  onSave,
  onCancel,
  isPending,
  isEdit,
}: {
  initial?: Partial<StoreFormState>;
  onSave: (data: StoreFormState) => void;
  onCancel: () => void;
  isPending: boolean;
  isEdit?: boolean;
}) {
  const [form, setForm] = useState<StoreFormState>({ ...EMPTY_FORM, ...initial });
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [apiPath, setApiPath] = useState("");

  const set = (key: keyof StoreFormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleApiPath = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setApiPath(val);
    const hash = extractStoreHash(val);
    if (hash) setForm((f) => ({ ...f, storeHash: hash }));
  };

  return (
    <div className="space-y-4">
      {/* Quick-fill banner */}
      <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2">
        <p className="text-xs font-medium text-primary">Quick fill from API Path</p>
        <Input
          placeholder="https://api.bigcommerce.com/stores/abc123/v3/"
          value={apiPath}
          onChange={handleApiPath}
          className="font-mono text-xs h-8"
        />
        <p className="text-xs text-muted-foreground">
          Paste your API Path and the Store Hash will be filled in automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="label">Name / Nickname <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
          <Input id="label" placeholder="e.g. Hello, Main Store, EU Store" value={form.label} onChange={set("label")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="storeHash">Store Hash <span className="text-destructive">*</span></Label>
          <Input id="storeHash" placeholder="e.g. gqbioat4ak" value={form.storeHash} onChange={set("storeHash")} className="font-mono" />
          <p className="text-xs text-muted-foreground">Auto-filled from API Path, or paste manually</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="accessToken">Access Token <span className="text-destructive">*</span></Label>
          <div className="relative">
            <Input
              id="accessToken"
              type={showToken ? "text" : "password"}
              placeholder={isEdit ? "Leave blank to keep current" : "Your API access token"}
              value={form.accessToken}
              onChange={set("accessToken")}
              className="font-mono pr-10"
            />
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowToken((v) => !v)}>
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="clientId">Client ID <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
          <Input id="clientId" placeholder="Your app client ID" value={form.clientId} onChange={set("clientId")} className="font-mono" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="clientSecret">Client Secret <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
          <div className="relative">
            <Input
              id="clientSecret"
              type={showSecret ? "text" : "password"}
              placeholder={isEdit ? "Leave blank to keep current" : "Your app client secret"}
              value={form.clientSecret}
              onChange={set("clientSecret")}
              className="font-mono pr-10"
            />
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowSecret((v) => !v)}>
              {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => onSave(form)} disabled={isPending || !form.storeHash.trim() || (!isEdit && !form.accessToken.trim())}>
          {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Validating...</> : isEdit ? "Save Changes" : "Add Store"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function StoreCard({ store, onEdit, onDelete, isDeleting, onSetCurrency, isSettingCurrency }: {
  store: StoreRecord;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  onSetCurrency: () => void;
  isSettingCurrency: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-start justify-between p-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 rounded-md bg-primary/10 shrink-0 mt-0.5">
            <Store className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold truncate">
                {store.label ?? store.storeName ?? store.storeHash}
              </p>
              {store.storeName && store.label && (
                <span className="text-xs text-muted-foreground">({store.storeName})</span>
              )}
              <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 gap-1 text-xs shrink-0">
                <CheckCircle2 className="w-2.5 h-2.5" /> Connected
              </Badge>
            </div>
            {store.storeUrl && (
              <a href={store.storeUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5">
                <LinkIcon className="w-3 h-3" /> {store.storeUrl}
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-1 shrink-0 ml-2">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onDelete} disabled={isDeleting}>
            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>
      <Separator />
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Store Hash</p>
          <p className="text-xs font-mono text-foreground/80">{store.storeHash}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Access Token</p>
          <p className="text-xs font-mono text-foreground/80">{store.accessTokenMasked ?? "—"}</p>
        </div>
        {store.clientId && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Client ID</p>
            <p className="text-xs font-mono text-foreground/80 truncate">{store.clientId}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Client Secret</p>
          <p className="text-xs text-foreground/80">{store.clientSecretConfigured ? "Configured" : "—"}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground">Last updated {new Date(store.updatedAt).toLocaleString()}</p>
        </div>
      </div>
      <Separator />
      <div className="px-4 py-3">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={onSetCurrency}
          disabled={isSettingCurrency}
        >
          {isSettingCurrency
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Setting currency…</>
            : <><DollarSign className="w-3.5 h-3.5" /> Set Default Currency to USD</>
          }
        </Button>
      </div>
    </div>
  );
}

export default function Settings() {
  const { toast } = useToast();
  const { data, isLoading } = useStores();
  const addStore = useAddStore();
  const updateStore = useUpdateStore();
  const deleteStore = useDeleteStore();
  const setDefaultCurrency = useSetDefaultCurrency();

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingCurrencyId, setSettingCurrencyId] = useState<string | null>(null);

  const stores = data?.stores ?? [];
  const maxStores = data?.maxStores ?? 5;
  const canAddMore = stores.length < maxStores;

  const handleAdd = async (form: StoreFormState) => {
    try {
      await addStore.mutateAsync({
        label: form.label.trim() || undefined,
        storeHash: form.storeHash.trim(),
        accessToken: form.accessToken.trim(),
        clientId: form.clientId.trim() || undefined,
        clientSecret: form.clientSecret.trim() || undefined,
      });
      toast({ title: "Store added", description: "Credentials validated and saved." });
      setShowAddForm(false);
    } catch (e) {
      toast({ title: "Failed to add store", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    }
  };

  const handleUpdate = async (id: string, form: StoreFormState) => {
    try {
      await updateStore.mutateAsync({
        id,
        label: form.label.trim() || undefined,
        storeHash: form.storeHash.trim() || undefined,
        accessToken: form.accessToken.trim() || undefined,
        clientId: form.clientId.trim() || undefined,
        clientSecret: form.clientSecret.trim() || undefined,
      });
      toast({ title: "Store updated", description: "Credentials saved." });
      setEditingId(null);
    } catch (e) {
      toast({ title: "Failed to update store", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteStore.mutateAsync(id);
      toast({ title: "Store removed" });
    } catch {
      toast({ title: "Failed to remove store", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetCurrency = async (id: string) => {
    setSettingCurrencyId(id);
    try {
      const result = await setDefaultCurrency.mutateAsync({ id });
      toast({ title: "Currency updated", description: result.message });
    } catch (e) {
      toast({ title: "Failed to set currency", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSettingCurrencyId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">Manage your BigCommerce stores — add up to {maxStores} stores and run imports on each independently</p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Store className="w-4 h-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Connected Stores</CardTitle>
                <CardDescription>
                  {isLoading ? "Loading…" : `${stores.length} of ${maxStores} stores configured`}
                </CardDescription>
              </div>
            </div>
            {!isLoading && canAddMore && !showAddForm && (
              <Button size="sm" onClick={() => setShowAddForm(true)}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Store
              </Button>
            )}
            {!isLoading && !canAddMore && (
              <Badge variant="outline" className="text-muted-foreground text-xs gap-1">
                <AlertCircle className="w-3 h-3" /> Max {maxStores} stores
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading stores…
            </div>
          ) : (
            <>
              {/* Add form */}
              {showAddForm && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Add New Store</p>
                    <button onClick={() => setShowAddForm(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <StoreForm
                    onSave={handleAdd}
                    onCancel={() => setShowAddForm(false)}
                    isPending={addStore.isPending}
                  />
                </div>
              )}

              {/* Store list */}
              {stores.length === 0 && !showAddForm ? (
                <div className="text-center py-12 border border-dashed border-border rounded-lg">
                  <Store className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No stores configured yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1 mb-4">Add up to {maxStores} BigCommerce stores to manage imports independently</p>
                  <Button size="sm" onClick={() => setShowAddForm(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Your First Store
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {stores.map((store) => (
                    editingId === store.id ? (
                      <div key={store.id} className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">Edit Store</p>
                          <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <StoreForm
                          isEdit
                          initial={{
                            label: store.label ?? "",
                            storeHash: store.storeHash,
                            clientId: store.clientId ?? "",
                          }}
                          onSave={(form) => handleUpdate(store.id, form)}
                          onCancel={() => setEditingId(null)}
                          isPending={updateStore.isPending}
                        />
                      </div>
                    ) : (
                      <StoreCard
                        key={store.id}
                        store={store}
                        onEdit={() => setEditingId(store.id)}
                        onDelete={() => handleDelete(store.id)}
                        isDeleting={deletingId === store.id}
                        onSetCurrency={() => handleSetCurrency(store.id)}
                        isSettingCurrency={settingCurrencyId === store.id}
                      />
                    )
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
