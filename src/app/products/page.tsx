"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import { ArrowUpDown } from "lucide-react";

interface OrderProduct {
  title: string;
  brand: string;
  purchase_price: number;
}

interface Order {
  order_id: string;
  asin: string;
  quantity: number;
  selling_price: number;
  fba_fee: number;
  referral_fee: number;
  net_revenue: number;
  order_date: string;
  products: OrderProduct;
}

interface ProductRow {
  asin: string;
  title: string;
  brand: string;
  purchase_price: number;
  avg_selling_price: number;
  fba_fee: number;
  referral_fee: number;
  margin_eur: number;
  margin_pct: number;
  roi_pct: number;
  units_sold: number;
}

type SortKey = keyof ProductRow;
type SortDirection = "asc" | "desc";

function aggregateOrders(orders: Order[]): ProductRow[] {
  const map = new Map<
    string,
    {
      asin: string;
      title: string;
      brand: string;
      purchase_price: number;
      total_selling_price: number;
      total_fba_fee: number;
      total_referral_fee: number;
      total_quantity: number;
    }
  >();

  for (const order of orders) {
    const existing = map.get(order.asin);
    if (existing) {
      existing.total_selling_price += order.selling_price * order.quantity;
      existing.total_fba_fee += order.fba_fee * order.quantity;
      existing.total_referral_fee += order.referral_fee * order.quantity;
      existing.total_quantity += order.quantity;
    } else {
      map.set(order.asin, {
        asin: order.asin,
        title: order.products?.title ?? "—",
        brand: order.products?.brand ?? "—",
        purchase_price: order.products?.purchase_price ?? 0,
        total_selling_price: order.selling_price * order.quantity,
        total_fba_fee: order.fba_fee * order.quantity,
        total_referral_fee: order.referral_fee * order.quantity,
        total_quantity: order.quantity,
      });
    }
  }

  return Array.from(map.values()).map((entry) => {
    const avg_selling_price =
      entry.total_quantity > 0
        ? entry.total_selling_price / entry.total_quantity
        : 0;
    const avg_fba_fee =
      entry.total_quantity > 0
        ? entry.total_fba_fee / entry.total_quantity
        : 0;
    const avg_referral_fee =
      entry.total_quantity > 0
        ? entry.total_referral_fee / entry.total_quantity
        : 0;
    const margin_eur =
      avg_selling_price -
      entry.purchase_price -
      avg_fba_fee -
      avg_referral_fee;
    const margin_pct =
      avg_selling_price > 0 ? (margin_eur / avg_selling_price) * 100 : 0;
    const roi_pct =
      entry.purchase_price > 0 ? (margin_eur / entry.purchase_price) * 100 : 0;

    return {
      asin: entry.asin,
      title: entry.title,
      brand: entry.brand,
      purchase_price: entry.purchase_price,
      avg_selling_price,
      fba_fee: avg_fba_fee,
      referral_fee: avg_referral_fee,
      margin_eur,
      margin_pct,
      roi_pct,
      units_sold: entry.total_quantity,
    };
  });
}

const PERIOD_OPTIONS = [
  { label: "7j", value: "7" },
  { label: "30j", value: "30" },
  { label: "90j", value: "90" },
];

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "asin", label: "ASIN" },
  { key: "title", label: "Titre" },
  { key: "brand", label: "Marque" },
  { key: "purchase_price", label: "Prix achat (€)", numeric: true },
  { key: "avg_selling_price", label: "Prix vente moy. (€)", numeric: true },
  { key: "fba_fee", label: "Fee FBA (€)", numeric: true },
  { key: "referral_fee", label: "Fee Referral (€)", numeric: true },
  { key: "margin_eur", label: "Marge (€)", numeric: true },
  { key: "margin_pct", label: "Marge (%)", numeric: true },
  { key: "roi_pct", label: "ROI (%)", numeric: true },
  { key: "units_sold", label: "Unités vendues", numeric: true },
];

export default function ProductsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [period, setPeriod] = useState("30");
  const [brand, setBrand] = useState("all");
  const [marginThreshold, setMarginThreshold] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("units_sold");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/amazon/orders?days=${period}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setOrders(data.orders ?? []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [period]);

  const products = useMemo(() => aggregateOrders(orders), [orders]);

  const brands = useMemo(() => {
    const set = new Set(products.map((p) => p.brand).filter((b) => b !== "—"));
    return Array.from(set).sort();
  }, [products]);

  const filtered = useMemo(() => {
    let rows = products;

    if (brand !== "all") {
      rows = rows.filter((p) => p.brand === brand);
    }

    const threshold = parseFloat(marginThreshold);
    if (!isNaN(threshold)) {
      rows = rows.filter((p) => p.margin_pct > threshold);
    }

    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc"
          ? av.localeCompare(bv)
          : bv.localeCompare(av);
      }
      const an = av as number;
      const bn = bv as number;
      return sortDir === "asc" ? an - bn : bn - an;
    });
  }, [products, brand, marginThreshold, sortKey, sortDir]);

  const kpi = useMemo(() => {
    const totalUnits = filtered.reduce((s, p) => s + p.units_sold, 0);
    const totalRevenue = filtered.reduce(
      (s, p) => s + p.avg_selling_price * p.units_sold,
      0
    );
    const totalMargin = filtered.reduce(
      (s, p) => s + p.margin_eur * p.units_sold,
      0
    );
    const avgMarginPct =
      totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;
    const totalCost = filtered.reduce(
      (s, p) => s + p.purchase_price * p.units_sold,
      0
    );
    const avgRoi = totalCost > 0 ? (totalMargin / totalCost) * 100 : 0;

    return { totalUnits, totalRevenue, totalMargin, avgMarginPct, avgRoi };
  }, [filtered]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function marginBadgeVariant(pct: number) {
    if (pct >= 20) return "default";
    if (pct >= 10) return "secondary";
    return "destructive";
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Produits — Rentabilité par ASIN
        </h1>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Produits affichés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatNumber(filtered.length)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unités vendues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatNumber(kpi.totalUnits)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Chiffre d&apos;affaires
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(kpi.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Marge totale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(kpi.totalMargin)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Marge moy. / ROI moy.
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatPercent(kpi.avgMarginPct)}{" "}
              <span className="text-base font-normal text-muted-foreground">
                / {formatPercent(kpi.avgRoi)}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Period */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Période</label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Brand */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Marque</label>
              <Select value={brand} onValueChange={setBrand}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les marques</SelectItem>
                  {brands.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Margin threshold */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Marge min. (%)</label>
              <Input
                type="number"
                placeholder="ex: 15"
                value={marginThreshold}
                onChange={(e) => setMarginThreshold(e.target.value)}
                className="w-[120px]"
              />
            </div>

            {/* Reset */}
            {(brand !== "all" || marginThreshold !== "") && (
              <Button
                variant="outline"
                onClick={() => {
                  setBrand("all");
                  setMarginThreshold("");
                }}
              >
                Réinitialiser
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              Chargement des données…
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-48 text-destructive">
              Erreur : {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
              <p className="text-lg font-medium">Aucun produit trouvé</p>
              <p className="text-sm">
                Essayez de modifier les filtres ou la période sélectionnée.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {COLUMNS.map((col) => (
                      <TableHead
                        key={col.key}
                        className={col.numeric ? "text-right" : ""}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`-ml-3 h-8 font-semibold ${
                            col.numeric ? "flex ml-auto" : ""
                          }`}
                          onClick={() => handleSort(col.key)}
                        >
                          {col.label}
                          <ArrowUpDown
                            className={`ml-1 h-3 w-3 ${
                              sortKey === col.key
                                ? "opacity-100 text-primary"
                                : "opacity-40"
                            }`}
                          />
                        </Button>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((product) => (
                    <TableRow key={product.asin}>
                      <TableCell className="font-mono text-xs">
                        {product.asin}
                      </TableCell>
                      <TableCell
                        className="max-w-[220px] truncate"
                        title={product.title}
                      >
                        {product.title}
                      </TableCell>
                      <TableCell>{product.brand}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(product.purchase_price)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(product.avg_selling_price)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(product.fba_fee)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(product.referral_fee)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(product.margin_eur)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={marginBadgeVariant(product.margin_pct)}>
                          {formatPercent(product.margin_pct)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            product.roi_pct >= 30
                              ? "default"
                              : product.roi_pct >= 15
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {formatPercent(product.roi_pct)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(product.units_sold)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
