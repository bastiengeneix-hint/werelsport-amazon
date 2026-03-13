import { supabaseAdmin } from "./supabase"

interface AccountSnapshot {
  totalRevenue: number
  totalProfit: number
  avgRoi: number
  activeSkus: number
  stockValue: number
  topProducts: Array<{
    title: string
    asin: string
    margin_eur: number
    roi_pct: number
  }>
  alerts: Array<{
    asin: string
    days_until_stockout: number
    qty_to_order: number
    estimated_cost: number
  }>
}

async function getAccountSnapshot(): Promise<AccountSnapshot> {
  const { data: profitability } = await supabaseAdmin
    .from("asin_profitability")
    .select("*")

  const { data: inventory } = await supabaseAdmin
    .from("inventory_snapshots")
    .select("*")
    .order("snapshot_at", { ascending: false })

  const { data: products } = await supabaseAdmin.from("products").select("*")

  const items = profitability || []
  const totalRevenue = items.reduce(
    (sum, p) => sum + (p.avg_selling_price || 0) * (p.total_units_sold || 0),
    0
  )
  const totalProfit = items.reduce(
    (sum, p) => sum + (p.total_profit || 0),
    0
  )
  const avgRoi =
    items.length > 0
      ? items.reduce((sum, p) => sum + (p.roi_pct || 0), 0) / items.length
      : 0
  const activeSkus = items.filter((p) => p.total_units_sold > 0).length

  // Calculate stock value
  const latestInventory = new Map<string, number>()
  for (const snap of inventory || []) {
    if (!latestInventory.has(snap.asin)) {
      latestInventory.set(snap.asin, snap.quantity_available)
    }
  }
  const productMap = new Map(
    (products || []).map((p) => [p.asin, p])
  )
  let stockValue = 0
  latestInventory.forEach((qty, asin) => {
    const product = productMap.get(asin)
    if (product) stockValue += qty * product.purchase_price
  })

  const topProducts = [...items]
    .sort((a, b) => (b.total_profit || 0) - (a.total_profit || 0))
    .slice(0, 5)
    .map((p) => ({
      title: p.title,
      asin: p.asin,
      margin_eur: p.avg_margin_eur || 0,
      roi_pct: p.roi_pct || 0,
    }))

  // Calculate alerts
  const alerts: AccountSnapshot["alerts"] = []
  for (const product of products || []) {
    const stock = latestInventory.get(product.asin) || 0
    const profItem = items.find((p) => p.asin === product.asin)
    if (!profItem || profItem.total_units_sold === 0) continue

    const velocity30 = profItem.total_units_sold / 30
    if (velocity30 === 0) continue
    const daysOfStock = stock / velocity30
    const daysNeeded =
      (product.lead_time_days || 7) + (product.reorder_buffer_days || 10)

    if (daysOfStock <= daysNeeded) {
      const qtyToOrder =
        Math.ceil(velocity30 * (daysNeeded + 30)) - stock
      alerts.push({
        asin: product.asin,
        days_until_stockout: Math.round(daysOfStock),
        qty_to_order: Math.max(0, qtyToOrder),
        estimated_cost: Math.max(0, qtyToOrder) * product.purchase_price,
      })
    }
  }
  alerts.sort((a, b) => a.days_until_stockout - b.days_until_stockout)

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalProfit: Math.round(totalProfit * 100) / 100,
    avgRoi: Math.round(avgRoi * 100) / 100,
    activeSkus,
    stockValue: Math.round(stockValue * 100) / 100,
    topProducts,
    alerts: alerts.slice(0, 10),
  }
}

export async function buildSystemPrompt(): Promise<string> {
  const snapshot = await getAccountSnapshot()

  const topProductsText =
    snapshot.topProducts.length > 0
      ? snapshot.topProducts
          .map(
            (p) =>
              `- ${p.title} (${p.asin}) : ${p.margin_eur}€ marge / ${p.roi_pct}% ROI`
          )
          .join("\n")
      : "- Aucune donnée disponible"

  const alertsText =
    snapshot.alerts.length > 0
      ? snapshot.alerts
          .map(
            (a) =>
              `- ${a.asin} : ${a.days_until_stockout} jours de stock restants, commander ${a.qty_to_order} unités (${a.estimated_cost}€)`
          )
          .join("\n")
      : "- Aucune alerte active"

  return `Tu es le DAF (Directeur Administratif et Financier) du compte Amazon FBA.

DONNÉES ACTUELLES DU COMPTE :
- Revenu brut : ${snapshot.totalRevenue}€
- Marge nette : ${snapshot.totalProfit}€ (${snapshot.avgRoi}% ROI moyen)
- SKUs actifs : ${snapshot.activeSkus}
- Stock total valorisé : ${snapshot.stockValue}€

TOP 5 PRODUITS PAR MARGE :
${topProductsText}

ALERTES ACTIVES :
${alertsText}

Réponds uniquement en te basant sur ces données réelles. Sois précis, chiffré, actionnable. Parle comme un DAF, pas comme un assistant généraliste. Réponds en français.`
}
