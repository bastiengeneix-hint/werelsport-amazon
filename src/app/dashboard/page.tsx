"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { DEMO_MODE, generateDemoOrders, generateDemoInventory } from "@/lib/demo-data";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Order {
  asin: string;
  title?: string;
  selling_price: number;
  net_revenue?: number;
  purchase_price?: number;
  quantity?: number;
}

interface InventoryItem {
  asin: string;
  title?: string;
  status?: string;
  purchase_price?: number;
}

interface KPIs {
  totalRevenue: number;
  totalProfit: number;
  avgROI: number;
  activeSkus: number;
}

interface ProductRow {
  asin: string;
  title: string;
  margin: number;
  roi: number;
  unitsSold: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function aggregateOrders(
  orders: Order[],
  inventory: InventoryItem[]
): { kpis: KPIs; topProducts: ProductRow[] } {
  const inventoryMap = new Map<string, InventoryItem>();
  for (const item of inventory) {
    inventoryMap.set(item.asin, item);
  }

  // Per-ASIN aggregation
  const byAsin = new Map<
    string,
    { revenue: number; profit: number; units: number; title: string }
  >();

  for (const order of orders) {
    const inv = inventoryMap.get(order.asin);
    const purchasePrice =
      order.purchase_price ?? inv?.purchase_price ?? 0;
    const netRevenue = order.net_revenue ?? order.selling_price;
    const profit = netRevenue - purchasePrice;
    const units = order.quantity ?? 1;

    if (!byAsin.has(order.asin)) {
      byAsin.set(order.asin, {
        revenue: 0,
        profit: 0,
        units: 0,
        title: order.title ?? inv?.title ?? order.asin,
      });
    }
    const entry = byAsin.get(order.asin)!;
    entry.revenue += order.selling_price * units;
    entry.profit += profit * units;
    entry.units += units;
  }

  // Global KPIs
  let totalRevenue = 0;
  let totalProfit = 0;

  for (const entry of byAsin.values()) {
    totalRevenue += entry.revenue;
    totalProfit += entry.profit;
  }

  // Weighted average ROI: weight by revenue
  let weightedRoiSum = 0;
  let weightSum = 0;
  for (const entry of byAsin.values()) {
    if (entry.revenue > 0) {
      const roi = (entry.profit / entry.revenue) * 100;
      weightedRoiSum += roi * entry.revenue;
      weightSum += entry.revenue;
    }
  }
  const avgROI = weightSum > 0 ? weightedRoiSum / weightSum : 0;

  // Active SKUs = distinct ASINs in orders + active inventory items
  const activeFromInventory = inventory.filter(
    (i) => i.status === "active" || i.status == null
  ).length;
  const activeSkus = Math.max(byAsin.size, activeFromInventory);

  // Top 5 by profitability (margin €)
  const topProducts: ProductRow[] = Array.from(byAsin.entries())
    .map(([asin, entry]) => ({
      asin,
      title: entry.title,
      margin: entry.profit,
      roi: entry.revenue > 0 ? (entry.profit / entry.revenue) * 100 : 0,
      unitsSold: entry.units,
    }))
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 5);

  return {
    kpis: { totalRevenue, totalProfit, avgROI, activeSkus },
    topProducts,
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function KPICard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <Card className="bg-slate-800 border-slate-700 text-slate-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-400">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader className="pb-2">
        <div className="h-3 w-32 bg-slate-700 rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="h-7 w-24 bg-slate-700 rounded animate-pulse mt-1" />
      </CardContent>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [period, setPeriod] = useState<"7" | "30" | "90">("30");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [topProducts, setTopProducts] = useState<ProductRow[]>([]);

  const fetchData = useCallback(
    async (days: string, isSyncing = false) => {
      if (isSyncing) setSyncing(true);
      else setLoading(true);
      setError(null);

      try {
        let orders, inventory;

        if (DEMO_MODE) {
          orders = generateDemoOrders(parseInt(days));
          inventory = generateDemoInventory();
        } else {
          const [ordersRes, inventoryRes] = await Promise.all([
            fetch(`/api/amazon/orders?days=${days}`),
            fetch(`/api/amazon/inventory`),
          ]);

          if (!ordersRes.ok || !inventoryRes.ok) {
            throw new Error("Erreur lors du chargement des données.");
          }

          const ordersData = await ordersRes.json();
          const inventoryData = await inventoryRes.json();
          orders = ordersData.orders;
          inventory = inventoryData.inventory;
        }

        const { kpis: computedKpis, topProducts: computed } = aggregateOrders(
          orders ?? [],
          inventory ?? [],
        );
        setKpis(computedKpis);
        setTopProducts(computed);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Une erreur est survenue."
        );
      } finally {
        setLoading(false);
        setSyncing(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchData(period);
  }, [period, fetchData]);

  const handleSync = () => {
    fetchData(period, true);
  };

  const roiColor = (roi: number) => {
    if (roi >= 20) return "text-emerald-400";
    if (roi >= 10) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 space-y-6">
      {/* ── Demo Banner ── */}
      {DEMO_MODE && (
        <div className="rounded-lg bg-indigo-600/20 border border-indigo-500/40 px-4 py-2.5 text-sm text-indigo-300 flex items-center gap-2">
          <span className="bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Demo</span>
          Donnees fictives — Connectez votre compte Amazon pour voir vos vraies donnees
        </div>
      )}
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Vue d&apos;ensemble de vos performances Amazon
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period selector */}
          <Select
            value={period}
            onValueChange={(v) => setPeriod(v as "7" | "30" | "90")}
          >
            <SelectTrigger className="w-28 bg-slate-800 border-slate-700 text-slate-100 focus:ring-slate-600">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-slate-100">
              <SelectItem value="7" className="focus:bg-slate-700">
                7 jours
              </SelectItem>
              <SelectItem value="30" className="focus:bg-slate-700">
                30 jours
              </SelectItem>
              <SelectItem value="90" className="focus:bg-slate-700">
                90 jours
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Sync button */}
          <Button
            onClick={handleSync}
            disabled={syncing || loading}
            className="bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
          >
            {syncing ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
                  />
                </svg>
                Sync…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582M20 20v-5h-.581M4.582 9A8 8 0 0119.418 15M19.418 15H15M4.582 9H9"
                  />
                </svg>
                Synchroniser
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <KPICard
              title="Revenu brut total"
              value={kpis ? formatCurrency(kpis.totalRevenue) : "—"}
              subtitle={`Sur les ${period} derniers jours`}
            />
            <KPICard
              title="Marge nette totale"
              value={kpis ? formatCurrency(kpis.totalProfit) : "—"}
              subtitle={
                kpis && kpis.totalRevenue > 0
                  ? `${((kpis.totalProfit / kpis.totalRevenue) * 100).toFixed(1)} % du CA`
                  : undefined
              }
            />
            <KPICard
              title="ROI moyen pondéré"
              value={kpis ? `${kpis.avgROI.toFixed(1)} %` : "—"}
              subtitle="Pondéré par le revenu"
            />
            <KPICard
              title="SKUs actifs"
              value={kpis ? formatNumber(kpis.activeSkus) : "—"}
              subtitle="Produits en catalogue"
            />
          </>
        )}
      </div>

      {/* ── Top Products Table ── */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="border-b border-slate-700 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-100">
              Top 5 produits par rentabilité
            </CardTitle>
            <Badge
              variant="outline"
              className="border-slate-600 text-slate-400 text-xs"
            >
              {period} derniers jours
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <svg
                className="h-8 w-8 animate-spin text-slate-500"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
                />
              </svg>
            </div>
          ) : topProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <svg
                className="h-10 w-10 mb-3 opacity-40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 9.75h16.5M3.75 14.25h16.5M8.25 4.5l-4.5 15M16.5 4.5l4.5 15"
                />
              </svg>
              <p className="text-sm">Aucune donnée disponible pour cette période.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-transparent">
                  <TableHead className="text-slate-400 font-medium">
                    ASIN
                  </TableHead>
                  <TableHead className="text-slate-400 font-medium">
                    Titre
                  </TableHead>
                  <TableHead className="text-slate-400 font-medium text-right">
                    Marge €
                  </TableHead>
                  <TableHead className="text-slate-400 font-medium text-right">
                    ROI %
                  </TableHead>
                  <TableHead className="text-slate-400 font-medium text-right">
                    Unités vendues
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.map((product, idx) => (
                  <TableRow
                    key={product.asin}
                    className="border-slate-700 hover:bg-slate-700/40 transition-colors"
                  >
                    <TableCell className="font-mono text-xs text-slate-300 py-3">
                      <span className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-400">
                          {idx + 1}
                        </span>
                        {product.asin}
                      </span>
                    </TableCell>
                    <TableCell
                      className="max-w-[220px] truncate text-slate-200 text-sm py-3"
                      title={product.title}
                    >
                      {product.title}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-slate-100 py-3">
                      {formatCurrency(product.margin)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold py-3 ${roiColor(product.roi)}`}
                    >
                      {product.roi.toFixed(1)} %
                    </TableCell>
                    <TableCell className="text-right text-slate-300 py-3">
                      {formatNumber(product.unitsSold)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
