"use client"

import { useEffect, useState } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatNumber } from "@/lib/utils"

interface Order {
  order_id: string
  asin: string
  quantity: number
  selling_price: number
  fba_fee: number
  referral_fee: number
  net_revenue: number
  order_date: string
  products: {
    title: string
    brand: string
    purchase_price: number
  }
}

interface InventoryItem {
  asin: string
  quantity_available: number
  quantity_inbound: number
}

interface AsinMetrics {
  asin: string
  title: string
  currentStock: number
  velocity7d: number
  velocity30d: number
  daysOfStock: number
  avgSellingPrice: number
  avgMargin: number
  projectedRevenue30d: number
  projectedProfit30d: number
}

const CHART_COLORS = [
  "#6366f1",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
]

export default function VelocityPage() {
  const [metrics, setMetrics] = useState<AsinMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [ordersRes, inventoryRes] = await Promise.all([
          fetch("/api/amazon/orders?days=30"),
          fetch("/api/amazon/inventory"),
        ])

        if (!ordersRes.ok || !inventoryRes.ok) {
          throw new Error("Failed to fetch data")
        }

        const ordersData: { orders: Order[] } = await ordersRes.json()
        const inventoryData: { inventory: InventoryItem[] } = await inventoryRes.json()

        const orders = ordersData.orders
        const inventory = inventoryData.inventory

        const now = new Date()
        const cutoff7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const cutoff30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

        // Group orders by ASIN
        const asinMap = new Map<
          string,
          {
            title: string
            units7d: number
            units30d: number
            totalRevenue: number
            totalMargin: number
            orderCount: number
          }
        >()

        for (const order of orders) {
          const orderDate = new Date(order.order_date)
          const existing = asinMap.get(order.asin) ?? {
            title: order.products?.title ?? order.asin,
            units7d: 0,
            units30d: 0,
            totalRevenue: 0,
            totalMargin: 0,
            orderCount: 0,
          }

          if (orderDate >= cutoff30d) {
            existing.units30d += order.quantity
            existing.totalRevenue += order.selling_price * order.quantity
            const margin =
              order.selling_price - (order.fba_fee + order.referral_fee + (order.products?.purchase_price ?? 0))
            existing.totalMargin += margin * order.quantity
            existing.orderCount += order.quantity
          }

          if (orderDate >= cutoff7d) {
            existing.units7d += order.quantity
          }

          asinMap.set(order.asin, existing)
        }

        // Build inventory lookup
        const inventoryMap = new Map<string, number>()
        for (const item of inventory) {
          inventoryMap.set(item.asin, item.quantity_available)
        }

        // Compute metrics per ASIN
        const result: AsinMetrics[] = []

        for (const [asin, data] of asinMap.entries()) {
          const velocity7d = data.units7d / 7
          const velocity30d = data.units30d / 30
          const currentStock = inventoryMap.get(asin) ?? 0
          const daysOfStock = velocity30d > 0 ? currentStock / velocity30d : Infinity
          const avgSellingPrice =
            data.orderCount > 0 ? data.totalRevenue / data.orderCount : 0
          const avgMargin =
            data.orderCount > 0 ? data.totalMargin / data.orderCount : 0
          const projectedRevenue30d = velocity30d * avgSellingPrice * 30
          const projectedProfit30d = velocity30d * avgMargin * 30

          result.push({
            asin,
            title: data.title,
            currentStock,
            velocity7d,
            velocity30d,
            daysOfStock,
            avgSellingPrice,
            avgMargin,
            projectedRevenue30d,
            projectedProfit30d,
          })
        }

        // Sort by urgency (days of stock ASC)
        result.sort((a, b) => a.daysOfStock - b.daysOfStock)

        setMetrics(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // KPI aggregates
  const avgVelocity7d =
    metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.velocity7d, 0) / metrics.length
      : 0
  const avgVelocity30d =
    metrics.length > 0
      ? metrics.reduce((sum, m) => sum + m.velocity30d, 0) / metrics.length
      : 0
  const avgDaysOfStock =
    metrics.length > 0
      ? metrics
          .filter((m) => isFinite(m.daysOfStock))
          .reduce((sum, m) => sum + m.daysOfStock, 0) /
        (metrics.filter((m) => isFinite(m.daysOfStock)).length || 1)
      : 0
  const totalProjectedRevenue30d = metrics.reduce(
    (sum, m) => sum + m.projectedRevenue30d,
    0
  )

  // Chart data: top 5 by urgency, project stock over 90 days
  const top5 = metrics.slice(0, 5)
  const chartData: Record<string, string | number>[] = []
  for (let day = 0; day <= 90; day += 5) {
    const point: Record<string, string | number> = {
      day: `J+${day}`,
    }
    for (const m of top5) {
      const projectedStock = Math.max(0, m.currentStock - m.velocity30d * day)
      const label = m.asin.length > 10 ? m.asin.slice(-10) : m.asin
      point[label] = Math.round(projectedStock)
    }
    chartData.push(point)
  }

  function getStatusBadge(daysOfStock: number) {
    if (!isFinite(daysOfStock) || daysOfStock > 30) {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">En stock</Badge>
    }
    if (daysOfStock >= 15) {
      return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Attention</Badge>
    }
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Urgent</Badge>
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Chargement des données...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <p className="text-destructive">Erreur : {error}</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Velocite &amp; Projections</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Analyse de la velocite de vente et projections de stock sur 30&nbsp;jours
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Velocite moyenne 7j
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatNumber(Math.round(avgVelocity7d * 10) / 10)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">unites / jour</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Velocite moyenne 30j
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatNumber(Math.round(avgVelocity30d * 10) / 10)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">unites / jour</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Jours de stock moyen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {isFinite(avgDaysOfStock) ? Math.round(avgDaysOfStock) : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">jours restants</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revenu projete 30j
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(totalProjectedRevenue30d)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">projection 30 jours</p>
          </CardContent>
        </Card>
      </div>

      {/* Stock Depletion Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Projection de stock — Top 5 ASINs les plus urgents (90 jours)</CardTitle>
        </CardHeader>
        <CardContent>
          {top5.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucune donnee disponible.</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <defs>
                  {top5.map((m, i) => {
                    const key = m.asin.length > 10 ? m.asin.slice(-10) : m.asin
                    return (
                      <linearGradient key={key} id={`color-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS[i]} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_COLORS[i]} stopOpacity={0.05} />
                      </linearGradient>
                    )
                  })}
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  label={{
                    value: "Unites",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 11 },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(var(--border))",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }} />
                {top5.map((m, i) => {
                  const key = m.asin.length > 10 ? m.asin.slice(-10) : m.asin
                  return (
                    <Area
                      key={key}
                      type="monotone"
                      dataKey={key}
                      name={key}
                      stroke={CHART_COLORS[i]}
                      fill={`url(#color-${i})`}
                      strokeWidth={2}
                    />
                  )
                })}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Urgency Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tableau de velocite par ASIN — trie par urgence</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {metrics.length === 0 ? (
            <p className="text-muted-foreground text-sm p-6">Aucune donnee disponible.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">ASIN</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Stock actuel</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Velocite 7j</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Velocite 30j</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Jours de stock</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Revenu proj. 30j</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Profit proj. 30j</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.map((m) => (
                    <TableRow key={m.asin}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {m.asin}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm" title={m.title}>
                        {m.title}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(m.currentStock)}
                      </TableCell>
                      <TableCell className="text-right">
                        {(Math.round(m.velocity7d * 100) / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {(Math.round(m.velocity30d * 100) / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {isFinite(m.daysOfStock) ? Math.round(m.daysOfStock) : "∞"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(m.projectedRevenue30d)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(m.projectedProfit30d)}
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(m.daysOfStock)}
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
  )
}
