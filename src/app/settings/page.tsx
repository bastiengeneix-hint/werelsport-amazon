"use client";

import { useState, useEffect, useRef } from "react";
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
// import { formatCurrency } from "@/lib/utils";
import { Settings, Upload, RefreshCw, Save, Plus } from "lucide-react";

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

interface ConnectionStatus {
  connected: boolean;
  checking: boolean;
}

interface AlertSettings {
  defaultLeadTime: number;
  defaultReorderBuffer: number;
  emailNotifications: boolean;
  marginAlertThreshold: number;
}

// ─── Settings Page ────────────────────────────────────────────────────────────

export default function SettingsPage() {
  // ── SP-API tab state ──────────────────────────────────────────────────────
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    checking: false,
  });
  const [syncStatus, setSyncStatus] = useState<SyncResult | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // ── Couts d'achat tab state ───────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const [editedProducts, setEditedProducts] = useState<Record<string, Product>>(
    {}
  );
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
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Seuils & Alertes tab state ────────────────────────────────────────────
  const [alertSettings, setAlertSettings] = useState<AlertSettings>({
    defaultLeadTime: 14,
    defaultReorderBuffer: 7,
    emailNotifications: false,
    marginAlertThreshold: 20,
  });
  const [isSavingAlerts, setIsSavingAlerts] = useState(false);

  // ── Fetch products on mount ───────────────────────────────────────────────
  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    try {
      const res = await fetch("/api/products");
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch {
      // silently fail — API may not be implemented yet
    }
  }

  // ── SP-API actions ────────────────────────────────────────────────────────

  async function handleTestConnection() {
    setConnectionStatus({ connected: false, checking: true });
    try {
      const res = await fetch("/api/amazon/test-connection", { method: "POST" });
      const data = await res.json();
      setConnectionStatus({ connected: data.connected ?? res.ok, checking: false });
    } catch {
      setConnectionStatus({ connected: false, checking: false });
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
          ? data.message ?? "Synchronisation terminée avec succès."
          : data.error ?? "Erreur lors de la synchronisation.",
        details: data.details,
      });
    } catch {
      setSyncStatus({
        success: false,
        message: "Impossible de contacter l'API de synchronisation.",
      });
    } finally {
      setIsSyncing(false);
    }
  }

  // ── Couts d'achat actions ─────────────────────────────────────────────────

  function getEditedProduct(product: Product): Product {
    const key = product.asin;
    return editedProducts[key] ?? product;
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
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        const saved = await res.json();
        setProducts((prev) =>
          prev.map((p) => (p.asin === asin ? saved : p))
        );
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
        body: JSON.stringify(newProduct),
      });
      if (res.ok) {
        const saved = await res.json();
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
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      const lines = text.trim().split("\n");
      // Expect header: asin,title,purchasePrice,supplier,leadTime,reorderBuffer
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
            body: JSON.stringify(row),
          });
        } catch {
          // continue
        }
      }
      await fetchProducts();
      setCsvFile(null);
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
        <h1 className="text-2xl font-bold">Paramètres</h1>
      </div>

      <Tabs defaultValue="spapi">
        <TabsList className="mb-6">
          <TabsTrigger value="spapi">Configuration SP-API</TabsTrigger>
          <TabsTrigger value="couts">Coûts d&apos;achat</TabsTrigger>
          <TabsTrigger value="seuils">Seuils &amp; Alertes</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: SP-API ─────────────────────────────────────────────── */}
        <TabsContent value="spapi">
          <Card>
            <CardHeader>
              <CardTitle>Configuration Amazon SP-API</CardTitle>
              <CardDescription>
                Les identifiants sont lus depuis les variables d&apos;environnement
                du serveur. Ces champs sont affichés en lecture seule.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Amazon Client ID</label>
                  <Input
                    readOnly
                    value="••••••••••••••••"
                    className="bg-muted cursor-not-allowed font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Défini via <code>AMAZON_CLIENT_ID</code>
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Amazon Client Secret
                  </label>
                  <Input
                    readOnly
                    value="••••••••••••••••"
                    className="bg-muted cursor-not-allowed font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Défini via <code>AMAZON_CLIENT_SECRET</code>
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Marketplace ID</label>
                  <Input
                    readOnly
                    value={process.env.NEXT_PUBLIC_MARKETPLACE_ID ?? "A13V1IB3VIYZZH"}
                    className="bg-muted cursor-not-allowed font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Défini via <code>MARKETPLACE_ID</code>
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Statut de connexion
                  </label>
                  <div className="flex items-center h-10">
                    {connectionStatus.checking ? (
                      <Badge variant="secondary">Vérification…</Badge>
                    ) : connectionStatus.connected ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                        Connecté
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Déconnecté</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={connectionStatus.checking}
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${
                      connectionStatus.checking ? "animate-spin" : ""
                    }`}
                  />
                  Tester la connexion
                </Button>

                <Button onClick={handleManualSync} disabled={isSyncing}>
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`}
                  />
                  {isSyncing ? "Synchronisation…" : "Sync manuelle"}
                </Button>
              </div>

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

        {/* ── Tab 2: Coûts d'achat ──────────────────────────────────────── */}
        <TabsContent value="couts">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Coûts d&apos;achat</CardTitle>
              <CardDescription>
                Gérez les prix d&apos;achat, fournisseurs et délais de réapprovisionnement
                pour chaque produit.
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

              {csvFile && (
                <p className="text-xs text-muted-foreground mb-3">
                  Fichier sélectionné : {csvFile.name} — import en cours…
                </p>
              )}

              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">ASIN</TableHead>
                      <TableHead>Titre</TableHead>
                      <TableHead className="w-36">
                        Prix d&apos;achat (€)
                      </TableHead>
                      <TableHead className="w-36">Fournisseur</TableHead>
                      <TableHead className="w-32">Lead time (j)</TableHead>
                      <TableHead className="w-36">Buffer réachat (j)</TableHead>
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
                    Prix d&apos;achat (€)
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
                    Buffer réachat (jours)
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
                {isAddingProduct ? "Ajout en cours…" : "Ajouter le produit"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 3: Seuils & Alertes ───────────────────────────────────── */}
        <TabsContent value="seuils">
          <Card>
            <CardHeader>
              <CardTitle>Seuils &amp; Alertes</CardTitle>
              <CardDescription>
                Configurez les valeurs par défaut et les seuils d&apos;alerte
                pour la gestion des stocks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Lead time par défaut (jours)
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
                    Appliqué aux produits sans lead time spécifique.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Buffer de réachat par défaut (jours)
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
                    Jours de sécurité avant la date de rupture estimée.
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
                    Une alerte est déclenchée si la marge descend sous ce seuil.
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
                      {alertSettings.emailNotifications ? "Activées" : "Désactivées"}{" "}
                      <span className="italic">(placeholder)</span>
                    </span>
                  </div>
                </div>
              </div>

              <Button onClick={handleSaveAlertSettings} disabled={isSavingAlerts}>
                <Save className="h-4 w-4 mr-2" />
                {isSavingAlerts ? "Enregistrement…" : "Enregistrer les paramètres"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
