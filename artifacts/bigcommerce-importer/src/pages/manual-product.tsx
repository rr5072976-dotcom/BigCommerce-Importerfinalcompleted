import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, XCircle, Loader2, Store, Plus, ImageIcon, Upload, Box, ExternalLink,
} from "lucide-react";

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

export default function ManualProduct() {
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

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [type, setType] = useState<"physical" | "digital">("physical");
  const [weight, setWeight] = useState("");
  const [description, setDescription] = useState("");
  const [inventoryLevel, setInventoryLevel] = useState("");

  const [imageMode, setImageMode] = useState<"file" | "url">("file");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ productId: string; imageWarning?: string } | null>(null);

  const SUPPORTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];

  const handleImageFile = (file: File) => {
    setImageError(null);
    const mime = file.type.toLowerCase();
    if (!SUPPORTED_TYPES.includes(mime)) {
      const isHeic = mime.includes("heic") || mime.includes("heif") || file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif");
      setImageError(
        isHeic
          ? "iPhone HEIC photos aren't supported by BigCommerce. Open the photo in your Photos app, share it, and choose 'Most Compatible' (JPEG) format before uploading."
          : `"${file.type}" is not supported. Please use JPEG, PNG, GIF, or WebP.`
      );
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setImageError("Image is too large (max 8 MB). Please resize or compress it before uploading.");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  };

  const handleSubmit = async () => {
    if (!isValidStore || !name || !sku || !price) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      if (!usingManual && selectedStoreId) {
        formData.append("storeId", selectedStoreId);
      } else {
        formData.append("storeHash", storeHash);
        formData.append("accessToken", accessToken);
      }
      formData.append("name", name);
      formData.append("sku", sku);
      formData.append("price", price);
      formData.append("type", type);
      if (weight) formData.append("weight", weight);
      if (description) formData.append("description", description);
      if (inventoryLevel) formData.append("inventory_level", inventoryLevel);
      if (imageMode === "file" && imageFile) {
        formData.append("image_file", imageFile);
      } else if (imageMode === "url" && imageUrl) {
        formData.append("image_url", imageUrl);
      }

      const res = await fetch("/api/products/manual", { method: "POST", body: formData });
      const data = await res.json() as { productId?: string; entityId?: string; imageWarning?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSuccess({ productId: data.productId ?? data.entityId ?? "?", imageWarning: data.imageWarning });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create product");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = isValidStore && name && sku && price && !submitting;
  const selectedStore = savedStores.find((s) => s.id === selectedStoreId) ?? null;

  return (
    <div className="space-y-6 max-w-3xl animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Create Product</h2>
        <p className="text-muted-foreground mt-1">Manually add a single product to your BigCommerce store</p>
      </div>

      {success ? (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <div>
                <p className="font-semibold text-lg">Product Created!</p>
                <p className="text-sm text-muted-foreground">BigCommerce Product ID: <span className="font-mono">{success.productId}</span></p>
              </div>
            </div>
            {success.imageWarning && (
              <p className="text-sm text-yellow-500 flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" />
                Image upload note: {success.imageWarning}
              </p>
            )}
            <div className="flex gap-3">
              <Button onClick={() => {
                setSuccess(null);
                setName(""); setSku(""); setPrice(""); setWeight(""); setDescription(""); setInventoryLevel("");
                setImageFile(null); setImageUrl(""); setImagePreview(null);
              }}>Create Another</Button>
              <Button variant="outline" onClick={() => setLocation("/")}>Back to Dashboard</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Store Selection */}
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
                    <div className="space-y-1.5">
                      <Label>Store Hash <span className="text-destructive">*</span></Label>
                      <Input placeholder="abc123xyz" value={storeHash} onChange={(e) => setStoreHash(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Access Token <span className="text-destructive">*</span></Label>
                      <Input type="password" placeholder="••••••••••••••••" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Product Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">2</span>
                Product Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <Label>Product Name <span className="text-destructive">*</span></Label>
                  <Input placeholder="iPhone 17 Pro Max" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>SKU <span className="text-destructive">*</span></Label>
                  <Input placeholder="IPH17PM-256-BLK" value={sku} onChange={(e) => setSku(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Price (USD) <span className="text-destructive">*</span></Label>
                  <Input type="number" min="0" step="0.01" placeholder="799.99" value={price} onChange={(e) => setPrice(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <div className="flex gap-2">
                    {(["physical", "digital"] as const).map((t) => (
                      <button key={t} onClick={() => setType(t)}
                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${type === t ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-muted-foreground/50"}`}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Weight (lbs)</Label>
                  <Input type="number" min="0" step="0.01" placeholder="0.5" value={weight} onChange={(e) => setWeight(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Inventory Level</Label>
                  <Input type="number" min="0" step="1" placeholder="100" value={inventoryLevel} onChange={(e) => setInventoryLevel(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea placeholder="Product description..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
            </CardContent>
          </Card>

          {/* Product Image */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">3</span>
                Product Image
                <Badge variant="outline" className="text-xs font-normal ml-1">Optional</Badge>
              </CardTitle>
              <CardDescription>Add an image from your computer or paste a URL</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
                <button onClick={() => setImageMode("file")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${imageMode === "file" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  <Upload className="w-3.5 h-3.5" /> Upload File
                </button>
                <button onClick={() => setImageMode("url")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${imageMode === "url" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  <ExternalLink className="w-3.5 h-3.5" /> Image URL
                </button>
              </div>

              {imageMode === "file" ? (
                <div className="space-y-3">
                  <div
                    className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors hover:border-primary/50 hover:bg-muted/20"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => imageInputRef.current?.click()}
                  >
                    <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }} />
                    {imagePreview ? (
                      <div className="flex flex-col items-center gap-3">
                        <img src={imagePreview} alt="Preview" className="max-h-40 max-w-full object-contain rounded-lg border" />
                        <p className="text-sm font-medium">{imageFile?.name}</p>
                        <button type="button" onClick={(e) => { e.stopPropagation(); setImageFile(null); setImagePreview(null); setImageError(null); }}
                          className="text-xs text-muted-foreground underline hover:text-destructive">Remove image</button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <ImageIcon className="w-10 h-10 text-muted-foreground" />
                        <p className="font-medium text-sm">Drop image here or click to browse</p>
                        <p className="text-xs text-muted-foreground">JPEG, PNG, GIF, WebP — max 8 MB</p>
                      </div>
                    )}
                  </div>
                  {imageError && (
                    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                      <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{imageError}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Image URL</Label>
                  <Input placeholder="https://example.com/product.jpg" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
                  {imageUrl && (
                    <div className="mt-3 border rounded-lg overflow-hidden w-fit">
                      <img src={imageUrl} alt="Preview" className="max-h-40 object-contain" onError={() => {}} />
                    </div>
                  )}
                </div>
              )}
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
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating Product...</>
                  ) : (
                    <><Box className="w-4 h-4 mr-2" /> Create Product</>
                  )}
                </Button>
                <Button size="lg" variant="outline" onClick={() => setLocation("/import")}>
                  Bulk Import Instead
                </Button>
              </div>
              {!isValidStore && (
                <p className="text-xs text-muted-foreground text-center">Select a store to enable product creation</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
