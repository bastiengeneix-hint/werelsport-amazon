"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  Upload,
  RefreshCw,
  Save,
  Plus,
  LogIn,
  LogOut,
  Check,
  Globe,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id?: string;
  asin: string;
  title: string;
  purchasePrice: number;
  supplier: string;
  leadTime: number;
  reorderBuffer: number;
}

interface SyncResult {
  success: boolean;
  message: string;
  details?: string;
}

interface AmazonAccount {
  sellerId: string;
  region: string;
  connectedAt: string | null;
}

interface ConnectedMarketplace {
  marketplace_id: string;
  country_code: string;
  name: string;
  is_active: boolean;
}

interface AlertSettings {
  defaultLeadTime: number;
  defaultReorderBuffer: number;
  emailNotifications: boolean;
  marginAlertThreshold: number;
}

const FLAGS: Record<string, string> = {
  FR: "\u{1F1EB}\u{1F1F7}", DE: "\u{1F1E9}\u{1F1EA}", ES: "\u{1F1EA}\u{1F1F8}",
  IT: "\u{1F1EE}\u{1F1F9}", UK: "\u{1F1EC}\u{1F1E7}", NL: "\u{1F1F3}\u{1F1F1}",
  SE: "\u{1F1F8}\u{1F1EA}", PL: "\u{1F1F5}\u{1F1F1}", BE: "\u{1F1E7}\u{1F1EA}",
  EG: "\u{1F1EA}\u{1F1EC}", TR: "\u{1F1F9}\u{1F1F7}", SA: "\u{1F1F8}\u{1F1E6}",
  AE: "\u{1F1E6}\u{1F1EA}", IN: "\u{1F1EE}\u{1F1F3}",
  US: "\u{1F1FA}\u{1F1F8}", CA: "\u{1F1E8}\u{1F1E6}", MX: "\u{1F1F2}\u{1F1FD}",
  BR: "\u{1F1E7}\u{1F1F7}", JP: "\u{1F1EF}\u{1F1F5}", AU: "\u{1F1E6}\u{1F1FA}",
  SG: "\u{1F1F8}\u{1F1EC}",
};

// ─── Settings Page ────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="container mx-auto py-8 px-4">Chargement...</div>}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const searchParams = useSearchParams();

  // ── Amazon account state ────────────────────────────────────────────────
  const [account, setAccount] = useState<AmazonAccount | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedMarketplaces, setConnectedMarketplaces] = useState<ConnectedMarketplace[]>([]);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncResult | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);

  // ── Couts d'achat tab state ───────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const [editedProducts, setEditedProducts] = useState<Record<string, Product>>({});
  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});
  const [newProduct, setNewProduct] = useState<Product>({
    asin: "",
    title: "",
    purchasePrice: 0,
    supplier: "",
    leadTime: 0,
    reorderBuffer: 0,
  });
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Seuils & Alertes tab state ────────────────────────────────────────────
  const [alertSettings, setAlertSettings] = useState<AlertSettings>({
    defaultLeadTime: 14,
    defaultReorderBuffer: 7,
    emailNotifications: false,
    marginAlertThreshold: 20,
  });
  const [isSavingAlerts, setIsSavingAlerts] = useState(false);

  // ── Load account + products on mount ────────────────────────────────────
  useEffect(() => {
    loadAccount();
    fetchProducts();
  }, []);

  // ── Show success banner if redirected from OAuth ────────────────────────
  useEffect(() => {
    if (searchParams.get("connected") === "true") {
      setSyncStatus({
        success: true,
        message: "Compte Amazon connect\u00e9 avec succ\u00e8s ! Vos marketplaces ont \u00e9t\u00e9 d\u00e9couvertes automatiquement.",
      });
    }
    if (searchParams.get("error")) {
      setSyncStatus({
        success: false,
        message: `Erreur de connexion : ${searchParams.get("error")}`,
      });
    }
  }, [searchParams]);

  async function loadAccount() {
    setLoadingAccount(true);
    try {
      const res = await fetch("/api/amazon/account");
      if (res.ok) {
        const data = await res.json();
        setIsConnected(data.connected);
        setAccount(data.account);
        setConnectedMarketplaces(data.marketplaces || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingAccount(false);
    }
  }

  async function handleConnectAmazon() {
    window.location.href = "/api/amazon/auth";
  }

  async function handleDisconnect() {
    if (!confirm("D\u00e9connecter votre compte Amazon ? Les donn\u00e9es sync\u00e9es seront conserv\u00e9es.")) return;
    try {
      await fetch("/api/amazon/account", { method: "DELETE" });
      setIsConnected(false);
      setAccount(null);
      setConnectedMarketplaces([]);
      setConnectionOk(null);
    } catch {
      // silently fail
    }
  }

  async function handleTestConnection() {
    setTestingConnection(true);
    setConnectionOk(null);
    try {
      const res = await fetch("/api/amazon/test-connection", { method: "POST" });
      const data = await res.json();
      setConnectionOk(data.connected ?? res.ok);
    } catch {
      setConnectionOk(false);
    } finally {
      setTestingConnection(false);
    }
  }

  async function handleToggleMarketplace(mpId: string, currentActive: boolean) {
    setConnectedMarketplaces((prev) =>
      prev.map((m) =>
        m.marketplace_id === mpId ? { ...m, is_active: !currentActive } : m
      )
    );
    try {
      await fetch("/api/amazon/marketplaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketplaceId: mpId, isActive: !currentActive }),
      });
    } catch {
      // revert
      setConnectedMarketplaces((prev) =>
        prev.map((m) =>
          m.marketplace_id === mpId ? { ...m, is_active: currentActive } : m
        )
      );
    }
  }

  async function handleManualSync() {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const res = await fetch("/api/amazon/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullSync: true }),
      });
      const data = await res.json();
      setSyncStatus({
        success: res.ok,
        message: res.ok
          ? data.message ?? "Synchronisation termin\u00e9e avec succ\u00e8s."
          : data.error ?? "Erreur lors de la synchronisation.",
        details: data.details,
      });
    } catch {
      setSyncStatus({
        success: false,
        message: "Impossible de contacter l\u2019API de synchronisation.",
      });
    } finally {
      setIsSyncing(false);
    }
  }

  // ── Products actions ────────────────────────────────────────────────────

  async function fetchProducts() {
    try {
      const res = await fetch("/api/products");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.products ?? []);
        setProducts(
          list.map((p: Record<string, unknown>) => ({
            asin: p.asin as string,
            title: (p.title as string) || "",
            purchasePrice: Number(p.purchase_price ?? p.purchasePrice ?? 0),
            supplier: (p.supplier as string) || "",
            leadTime: Number(p.lead_time_days ?? p.leadTime ?? 0),
            reorderBuffer: Number(p.reorder_buffer_days ?? p.reorderBuffer ?? 0),
          }))
        );
      }
    } catch {
      // silently fail
    }
  }

  function getEditedProduct(product: Product): Product {
    return editedProducts[product.asin] ?? product;
  }

  function handleProductFieldChange(
    asin: string,
    field: keyof Product,
    value: string | number
  ) {
    setEditedProducts((prev) => {
      const base = prev[asin] ?? products.find((p) => p.asin === asin)!;
      return { ...prev, [asin]: { ...base, [field]: value } };
    });
  }

  async function handleSaveRow(asin: string) {
    const updated = editedProducts[asin];
    if (!updated) return;
    setSavingRows((prev) => ({ ...prev, [asin]: true }));
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asin: updated.asin,
          title: updated.title,
          purchase_price: updated.purchasePrice,
          supplier: updated.supplier,
          lead_time_days: updated.leadTime,
          reorder_buffer_days: updated.reorderBuffer,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const raw = data.product ?? data;
        const saved: Product = {
          asin: raw.asin,
          title: raw.title || "",
          purchasePrice: Number(raw.purchase_price ?? raw.purchasePrice ?? 0),
          supplier: raw.supplier || "",
          leadTime: Number(raw.lead_time_days ?? raw.leadTime ?? 0),
          reorderBuffer: Number(raw.reorder_buffer_days ?? raw.reorderBuffer ?? 0),
        };
        setProducts((prev) => prev.map((p) => (p.asin === asin ? saved : p)));
        setEditedProducts((prev) => {
          const next = { ...prev };
          delete next[asin];
          return next;
        });
      }
    } catch {
      // handle silently
    } finally {
      setSavingRows((prev) => ({ ...prev, [asin]: false }));
    }
  }

  async function handleAddProduct() {
    if (!newProduct.asin || !newProduct.title) return;
    setIsAddingProduct(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asin: newProduct.asin,
          title: newProduct.title,
          purchase_price: newProduct.purchasePrice,
          supplier: newProduct.supplier,
          lead_time_days: newProduct.leadTime,
          reorder_buffer_days: newProduct.reorderBuffer,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const raw = data.product ?? data;
        const saved: Product = {
          asin: raw.asin,
          title: raw.title || "",
          purchasePrice: Number(raw.purchase_price ?? raw.purchasePrice ?? 0),
          supplier: raw.supplier || "",
          leadTime: Number(raw.lead_time_days ?? raw.leadTime ?? 0),
          reorderBuffer: Number(raw.reorder_buffer_days ?? raw.reorderBuffer ?? 0),
        };
        setProducts((prev) => [...prev, saved]);
        setNewProduct({
          asin: "",
          title: "",
          purchasePrice: 0,
          supplier: "",
          leadTime: 0,
          reorderBuffer: 0,
        });
      }
    } catch {
      // handle silently
    } finally {
      setIsAddingProduct(false);
    }
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      const lines = text.trim().split("\n");
      const rows = lines.slice(1).map((line) => {
        const [asin, title, purchasePrice, supplier, leadTime, reorderBuffer] =
          line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        return {
          asin,
          title,
          purchasePrice: parseFloat(purchasePrice) || 0,
          supplier,
          leadTime: parseInt(leadTime) || 0,
          reorderBuffer: parseInt(reorderBuffer) || 0,
        } as Product;
      });
      for (const row of rows) {
        if (!row.asin) continue;
        try {
          await fetch("/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              asin: row.asin,
              title: row.title,
              purchase_price: row.purchasePrice,
              supplier: row.supplier,
              lead_time_days: row.leadTime,
              reorder_buffer_days: row.reorderBuffer,
            }),
          });
        } catch {
          // continue
        }
      }
      await fetchProducts();
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  }

  // ── Seuils & Alertes actions ──────────────────────────────────────────────

  async function handleSaveAlertSettings() {
    setIsSavingAlerts(true);
    try {
      await fetch("/api/settings/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alertSettings),
      });
    } catch {
      // handle silently
    } finally {
      setIsSavingAlerts(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="h-7 w-7 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Param\u00e8tres</h1>
      </div>

      <Tabs defaultValue="spapi">
        <TabsList className="mb-6">
          <TabsTrigger value="spapi">Compte Amazon</TabsTrigger>
          <TabsTrigger value="marketplaces">Marketplaces</TabsTrigger>
          <TabsTrigger value="couts">Co\u00fbts d&apos;achat</TabsTrigger>
          <TabsTrigger value="seuils">Seuils &amp; Alertes</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Compte Amazon ─────────────────────────────────────── */}
        <TabsContent value="spapi">
          <Card>
            <CardHeader>
              <CardTitle>Connexion Amazon SP-API</CardTitle>
              <CardDescription>
                Connectez votre compte Seller Central via OAuth pour
                synchroniser automatiquement vos donn\u00e9es.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingAccount ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Chargement...
                </div>
              ) : isConnected && account ? (
                <>
                  {/* Connected state */}
                  <div className="rounded-lg border bg-green-50 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        Connect\u00e9
                      </Badge>
                      <span className="text-sm text-green-800">
                        Seller ID : <code className="font-mono">{account.sellerId}</code>
                      </span>
                    </div>
                    {account.connectedAt && (
                      <p className="text-xs text-green-700">
                        Connect\u00e9 le{" "}
                        {new Date(account.connectedAt).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                    <p className="text-xs text-green-700">
                      R\u00e9gion : <strong>{account.region?.toUpperCase()}</strong>
                      {" \u2014 "}
                      {connectedMarketplaces.filter((m) => m.is_active).length} marketplace(s) active(s)
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      onClick={handleTestConnection}
                      disabled={testingConnection}
                    >
                      <RefreshCw
                        className={`h-4 w-4 mr-2 ${testingConnection ? "animate-spin" : ""}`}
                      />
                      Tester la connexion
                    </Button>

                    {connectionOk !== null && (
                      <Badge
                        variant={connectionOk ? "default" : "destructive"}
                        className={connectionOk ? "bg-green-100 text-green-800" : ""}
                      >
                        {connectionOk ? "Connexion OK" : "Connexion \u00e9chou\u00e9e"}
                      </Badge>
                    )}

                    <Button onClick={handleManualSync} disabled={isSyncing}>
                      <RefreshCw
                        className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`}
                      />
                      {isSyncing ? "Synchronisation\u2026" : "Sync manuelle"}
                    </Button>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDisconnect}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      D\u00e9connecter
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* Disconnected state */}
                  <div className="rounded-lg border border-dashed p-6 text-center space-y-4">
                    <Globe className="h-10 w-10 mx-auto text-muted-foreground" />
                    <div>
                      <p className="font-medium">Aucun compte Amazon connect\u00e9</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Cliquez ci-dessous pour autoriser l&apos;acc\u00e8s \u00e0 votre
                        compte Seller Central. Vos marketplaces seront
                        d\u00e9couvertes automatiquement.
                      </p>
                    </div>
                    <Button size="lg" onClick={handleConnectAmazon}>
                      <LogIn className="h-5 w-5 mr-2" />
                      Connecter mon compte Amazon
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      N\u00e9cessite un <code>AMAZON_CLIENT_ID</code> et{" "}
                      <code>AMAZON_CLIENT_SECRET</code> dans les variables
                      d&apos;environnement du serveur.
                    </p>
                  </div>
                </>
              )}

              {syncStatus && (
                <div
                  className={`rounded-md border px-4 py-3 text-sm ${
                    syncStatus.success
                      ? "border-green-200 bg-green-50 text-green-800"
                      : "border-red-200 bg-red-50 text-red-800"
                  }`}
                >
                  <p className="font-medium">{syncStatus.message}</p>
                  {syncStatus.details && (
                    <p className="mt-1 text-xs opacity-80">{syncStatus.details}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: Marketplaces ──────────────────────────────────────── */}
        <TabsContent value="marketplaces">
          <Card>
            <CardHeader>
              <CardTitle>Marketplaces</CardTitle>
              <CardDescription>
                G\u00e9rez les marketplaces sur lesquelles vous vendez.
                Activez ou d\u00e9sactivez celles que vous souhaitez suivre.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {connectedMarketplaces.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Aucune marketplace d\u00e9couverte.</p>
                  <p className="text-sm mt-1">
                    Connectez votre compte Amazon dans l&apos;onglet pr\u00e9c\u00e9dent
                    pour d\u00e9couvrir vos marketplaces.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Marketplace</TableHead>
                        <TableHead className="w-40">ID</TableHead>
                        <TableHead className="w-24 text-center">Active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {connectedMarketplaces.map((mp) => (
                        <TableRow key={mp.marketplace_id}>
                          <TableCell className="text-xl">
                            {FLAGS[mp.country_code] || "\u{1F310}"}
                          </TableCell>
                          <TableCell className="font-medium">
                            {mp.name}
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({mp.country_code})
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {mp.marketplace_id}
                          </TableCell>
                          <TableCell className="text-center">
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleMarketplace(mp.marketplace_id, mp.is_active)
                              }
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                                mp.is_active
                                  ? "bg-green-100 border-green-300 text-green-700"
                                  : "bg-muted border-transparent text-muted-foreground hover:border-border"
                              }`}
                            >
                              {mp.is_active && <Check className="h-4 w-4" />}
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 3: Co\u00fbts d'achat ──────────────────────────────────── */}
        <TabsContent value="couts">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Co\u00fbts d&apos;achat</CardTitle>
              <CardDescription>
                G\u00e9rez les prix d&apos;achat, fournisseurs et d\u00e9lais de
                r\u00e9approvisionnement pour chaque produit.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Importer CSV
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleCsvUpload}
                />
              </div>

              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">ASIN</TableHead>
                      <TableHead>Titre</TableHead>
                      <TableHead className="w-36">Prix d&apos;achat (\u20ac)</TableHead>
                      <TableHead className="w-36">Fournisseur</TableHead>
                      <TableHead className="w-32">Lead time (j)</TableHead>
                      <TableHead className="w-36">Buffer r\u00e9achat (j)</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-muted-foreground py-8"
                        >
                          Aucun produit. Ajoutez-en un ci-dessous ou importez un
                          fichier CSV.
                        </TableCell>
                      </TableRow>
                    )}
                    {products.map((product) => {
                      const edited = getEditedProduct(product);
                      const isDirty =
                        JSON.stringify(edited) !== JSON.stringify(product);
                      return (
                        <TableRow key={product.asin}>
                          <TableCell className="font-mono text-xs">
                            {product.asin}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {product.title}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              value={edited.purchasePrice}
                              onChange={(e) =>
                                handleProductFieldChange(
                                  product.asin,
                                  "purchasePrice",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-28 h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={edited.supplier}
                              onChange={(e) =>
                                handleProductFieldChange(
                                  product.asin,
                                  "supplier",
                                  e.target.value
                                )
                              }
                              className="w-28 h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              value={edited.leadTime}
                              onChange={(e) =>
                                handleProductFieldChange(
                                  product.asin,
                                  "leadTime",
                                  parseInt(e.target.value) || 0
                                )
                              }
                              className="w-20 h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              value={edited.reorderBuffer}
                              onChange={(e) =>
                                handleProductFieldChange(
                                  product.asin,
                                  "reorderBuffer",
                                  parseInt(e.target.value) || 0
                                )
                              }
                              className="w-20 h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant={isDirty ? "default" : "ghost"}
                              disabled={!isDirty || savingRows[product.asin]}
                              onClick={() => handleSaveRow(product.asin)}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Add product form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Ajouter un produit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">ASIN *</label>
                  <Input
                    placeholder="B08XYZ1234"
                    value={newProduct.asin}
                    onChange={(e) =>
                      setNewProduct((p) => ({ ...p, asin: e.target.value }))
                    }
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Titre *</label>
                  <Input
                    placeholder="Nom du produit"
                    value={newProduct.title}
                    onChange={(e) =>
                      setNewProduct((p) => ({ ...p, title: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Prix d&apos;achat (\u20ac)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="0.00"
                    value={newProduct.purchasePrice || ""}
                    onChange={(e) =>
                      setNewProduct((p) => ({
                        ...p,
                        purchasePrice: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Fournisseur</label>
                  <Input
                    placeholder="Nom du fournisseur"
                    value={newProduct.supplier}
                    onChange={(e) =>
                      setNewProduct((p) => ({ ...p, supplier: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Lead time (jours)</label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="14"
                    value={newProduct.leadTime || ""}
                    onChange={(e) =>
                      setNewProduct((p) => ({
                        ...p,
                        leadTime: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Buffer r\u00e9achat (jours)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="7"
                    value={newProduct.reorderBuffer || ""}
                    onChange={(e) =>
                      setNewProduct((p) => ({
                        ...p,
                        reorderBuffer: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>

              <Button
                className="mt-4"
                onClick={handleAddProduct}
                disabled={
                  isAddingProduct || !newProduct.asin || !newProduct.title
                }
              >
                <Plus className="h-4 w-4 mr-2" />
                {isAddingProduct ? "Ajout en cours\u2026" : "Ajouter le produit"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 4: Seuils & Alertes ───────────────────────────────────── */}
        <TabsContent value="seuils">
          <Card>
            <CardHeader>
              <CardTitle>Seuils &amp; Alertes</CardTitle>
              <CardDescription>
                Configurez les valeurs par d\u00e9faut et les seuils d&apos;alerte
                pour la gestion des stocks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Lead time par d\u00e9faut (jours)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={alertSettings.defaultLeadTime}
                    onChange={(e) =>
                      setAlertSettings((s) => ({
                        ...s,
                        defaultLeadTime: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Appliqu\u00e9 aux produits sans lead time sp\u00e9cifique.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Buffer de r\u00e9achat par d\u00e9faut (jours)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={alertSettings.defaultReorderBuffer}
                    onChange={(e) =>
                      setAlertSettings((s) => ({
                        ...s,
                        defaultReorderBuffer: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Jours de s\u00e9curit\u00e9 avant la date de rupture estim\u00e9e.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Seuil d&apos;alerte marge (%)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={alertSettings.marginAlertThreshold}
                    onChange={(e) =>
                      setAlertSettings((s) => ({
                        ...s,
                        marginAlertThreshold: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Une alerte est d\u00e9clench\u00e9e si la marge descend sous ce seuil.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Notifications par e-mail
                  </label>
                  <div className="flex items-center gap-3 h-10">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={alertSettings.emailNotifications}
                      onClick={() =>
                        setAlertSettings((s) => ({
                          ...s,
                          emailNotifications: !s.emailNotifications,
                        }))
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                        alertSettings.emailNotifications
                          ? "bg-primary"
                          : "bg-muted-foreground/30"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          alertSettings.emailNotifications
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                    <span className="text-sm text-muted-foreground">
                      {alertSettings.emailNotifications
                        ? "Activ\u00e9es"
                        : "D\u00e9sactiv\u00e9es"}{" "}
                      <span className="italic">(placeholder)</span>
                    </span>
                  </div>
                </div>
              </div>

              <Button onClick={handleSaveAlertSettings} disabled={isSavingAlerts}>
                <Save className="h-4 w-4 mr-2" />
                {isSavingAlerts
                  ? "Enregistrement\u2026"
                  : "Enregistrer les param\u00e8tres"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
