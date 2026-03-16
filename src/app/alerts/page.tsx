"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Download, Package } from "lucide-react"
import { formatCurrency, formatNumber } from "@/lib/utils"
import { DEMO_MODE, generateDemoOrders, generateDemoInventory } from "@/lib/demo-data"

interface Product {
  title: string
  brand: string
  purchase_price: number
  lead_time_days: number
  reorder_buffer_days: number
}

interface Order {
  order_id: string
  asin: string
  quantity: number
  selling_price: number
  fba_fee: number
  referral_fee: number
  net_revenue: number
  order_date: string
  products: Product
}

interface InventoryItem {
  asin: string
  quantity_available: number
  quantity_inbound: number
}

interface AlertItem {
  asin: string
  title: string
  urgency: "CRITIQUE" | "NORMAL"
  daysOfStock: number
  qtyToOrder: number
  estimatedCost: number
  velocity: number
  leadTimeDays: number
  reorderBufferDays: number
  stock: number
  purchasePrice: number
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        let orders: Order[]
        let inventory: InventoryItem[]

        if (DEMO_MODE) {
          orders = generateDemoOrders(30) as unknown as Order[]
          inventory = generateDemoInventory() as unknown as InventoryItem[]
        } else {
          const [ordersRes, inventoryRes] = await Promise.all([
            fetch("/api/amazon/orders?days=30"),
            fetch("/api/amazon/inventory"),
          ])

          if (!ordersRes.ok || !inventoryRes.ok) {
            throw new Error("Failed to fetch data")
          }

          const ordersData: { orders: Order[] } = await ordersRes.json()
          const inventoryData: { inventory: InventoryItem[] } = await inventoryRes.json()

          orders = ordersData.orders
          inventory = inventoryData.inventory
        }

        // Build velocity map: asin -> total units sold in 30 days
        const velocityMap = new Map<string, { totalQty: number; product: Product }>()
        for (const order of orders) {
          if (!order.asin || !order.products) continue
          const existing = velocityMap.get(order.asin)
          if (existing) {
            existing.totalQty += order.quantity
          } else {
            velocityMap.set(order.asin, {
              totalQty: order.quantity,
              product: order.products,
            })
          }
        }

        // Build inventory map: asin -> quantity_available
        const inventoryMap = new Map<string, number>()
        for (const item of inventory) {
          inventoryMap.set(item.asin, item.quantity_available)
        }

        const computedAlerts: AlertItem[] = []

        for (const [asin, { totalQty, product }] of Array.from(velocityMap.entries())) {
          const velocity30d = totalQty / 30 // units per day
          if (velocity30d <= 0) continue

          const stock = inventoryMap.get(asin) ?? 0
          const { lead_time_days, reorder_buffer_days, purchase_price, title } = product

          const daysOfStock = stock / velocity30d
          const daysNeeded = lead_time_days + reorder_buffer_days

          if (daysOfStock <= daysNeeded) {
            const urgency: "CRITIQUE" | "NORMAL" =
              daysOfStock < lead_time_days ? "CRITIQUE" : "NORMAL"

            const qtyToOrder = Math.max(
              0,
              Math.ceil(velocity30d * (daysNeeded + 30)) - stock
            )
            const estimatedCost = qtyToOrder * purchase_price

            computedAlerts.push({
              asin,
              title,
              urgency,
              daysOfStock: Math.floor(daysOfStock),
              qtyToOrder,
              estimatedCost,
              velocity: velocity30d,
              leadTimeDays: lead_time_days,
              reorderBufferDays: reorder_buffer_days,
              stock,
              purchasePrice: purchase_price,
            })
          }
        }

        // Sort by urgency (CRITIQUE first), then by daysOfStock ascending
        computedAlerts.sort((a, b) => {
          if (a.urgency !== b.urgency) {
            return a.urgency === "CRITIQUE" ? -1 : 1
          }
          return a.daysOfStock - b.daysOfStock
        })

        setAlerts(computedAlerts)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Une erreur est survenue")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const criticalCount = alerts.filter((a) => a.urgency === "CRITIQUE").length
  const normalCount = alerts.filter((a) => a.urgency === "NORMAL").length
  const totalCashNeeded = alerts.reduce((sum, a) => sum + a.estimatedCost, 0)
  const outOfStockSoon = alerts.filter((a) => a.daysOfStock <= 7).length

  function exportCSV() {
    const headers = [
      "ASIN",
      "Titre",
      "Urgence",
      "Jours de stock",
      "Quantite a commander",
      "Cout estime (EUR)",
      "Velocite (units/jour)",
      "Lead time (jours)",
      "Buffer (jours)",
    ]

    const rows = alerts.map((a) => [
      a.asin,
      `"${a.title.replace(/"/g, '""')}"`,
      a.urgency,
      a.daysOfStock,
      a.qtyToOrder,
      a.estimatedCost.toFixed(2),
      a.velocity.toFixed(2),
      a.leadTimeDays,
      a.reorderBufferDays,
    ])

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `alertes-reachat-${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Alertes Reachat</h1>
        <Button onClick={exportCSV} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Exporter CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700">
              Alertes critiques
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              {loading ? "—" : formatNumber(criticalCount)}
            </div>
            <p className="text-xs text-red-500 mt-1">Stock &lt; lead time</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-700">
              Alertes normales
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">
              {loading ? "—" : formatNumber(normalCount)}
            </div>
            <p className="text-xs text-orange-500 mt-1">Stock dans la zone de buffer</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cash necessaire total
            </CardTitle>
            <span className="text-lg font-semibold text-muted-foreground">€</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "—" : formatCurrency(totalCashNeeded)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Pour toutes les commandes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ASINs en rupture prochaine
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? "—" : formatNumber(outOfStockSoon)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Stock &lt; 7 jours</p>
          </CardContent>
        </Card>
      </div>

      {/* Alert List */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          Chargement des alertes...
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && alerts.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
          <Package className="h-10 w-10" />
          <p className="text-lg font-medium">Aucune alerte de reachat</p>
          <p className="text-sm">Tous vos ASINs ont un stock suffisant.</p>
        </div>
      )}

      {!loading && !error && alerts.length > 0 && (
        <div className="flex flex-col gap-3">
          {alerts.map((alert) => (
            <Card
              key={alert.asin}
              className={
                alert.urgency === "CRITIQUE"
                  ? "border-red-300 bg-red-50/50"
                  : "border-orange-200 bg-orange-50/30"
              }
            >
              <CardContent className="pt-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  {/* Left: ASIN + Title + Badge */}
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-muted-foreground">
                        {alert.asin}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          alert.urgency === "CRITIQUE"
                            ? "border-red-400 bg-red-100 text-red-700 font-bold"
                            : "border-orange-400 bg-orange-100 text-orange-700 font-bold"
                        }
                      >
                        {alert.urgency === "CRITIQUE" ? (
                          <AlertTriangle className="mr-1 h-3 w-3" />
                        ) : (
                          <AlertTriangle className="mr-1 h-3 w-3" />
                        )}
                        {alert.urgency}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium truncate max-w-xl">{alert.title}</p>
                  </div>

                  {/* Right: Metrics grid */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 shrink-0 text-sm">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Jours de stock</span>
                      <span
                        className={
                          alert.urgency === "CRITIQUE"
                            ? "font-bold text-red-700"
                            : "font-bold text-orange-700"
                        }
                      >
                        {formatNumber(alert.daysOfStock)} j
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Qte a commander</span>
                      <span className="font-semibold">
                        {formatNumber(alert.qtyToOrder)} unites
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Cout estime</span>
                      <span className="font-semibold">
                        {formatCurrency(alert.estimatedCost)}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Velocite actuelle</span>
                      <span className="font-semibold">
                        {alert.velocity.toFixed(1)} u/j
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Lead time</span>
                      <span className="font-semibold">{alert.leadTimeDays} j</span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">Buffer</span>
                      <span className="font-semibold">{alert.reorderBufferDays} j</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
