// ── Données fictives WEREL SPORT pour démo ──────────────────────────────────
// Ces données simulent un catalogue d'équipements sportifs vendus sur Amazon FBA

export const DEMO_MODE = true

export const DEMO_PRODUCTS = [
  {
    asin: "B09K3XHWM1",
    title: "Haltères Réglables 2x20kg - Set Musculation",
    brand: "WEREL SPORT",
    purchase_price: 32.50,
    lead_time_days: 21,
    reorder_buffer_days: 7,
  },
  {
    asin: "B09K3XHWM2",
    title: "Tapis de Yoga Premium Antidérapant 183x61cm",
    brand: "WEREL SPORT",
    purchase_price: 8.90,
    lead_time_days: 14,
    reorder_buffer_days: 5,
  },
  {
    asin: "B09K3XHWM3",
    title: "Corde à Sauter Crossfit Pro - Roulements à Billes",
    brand: "WEREL SPORT",
    purchase_price: 4.20,
    lead_time_days: 14,
    reorder_buffer_days: 5,
  },
  {
    asin: "B09K3XHWM4",
    title: "Bandes de Résistance Élastiques - Pack de 5",
    brand: "WEREL SPORT",
    purchase_price: 3.80,
    lead_time_days: 14,
    reorder_buffer_days: 5,
  },
  {
    asin: "B09K3XHWM5",
    title: "Rouleau de Massage Foam Roller 45cm",
    brand: "WEREL SPORT",
    purchase_price: 5.50,
    lead_time_days: 14,
    reorder_buffer_days: 5,
  },
  {
    asin: "B09K3XHWM6",
    title: "Gants de Musculation Cuir - Taille M/L",
    brand: "WEREL SPORT",
    purchase_price: 6.30,
    lead_time_days: 21,
    reorder_buffer_days: 7,
  },
  {
    asin: "B09K3XHWM7",
    title: "Kettlebell Vinyle 16kg - Fitness & Crossfit",
    brand: "WEREL SPORT",
    purchase_price: 18.00,
    lead_time_days: 21,
    reorder_buffer_days: 10,
  },
  {
    asin: "B09K3XHWM8",
    title: "Sac de Frappe Boxe 120cm + Gants + Chaîne",
    brand: "WEREL FIT",
    purchase_price: 42.00,
    lead_time_days: 30,
    reorder_buffer_days: 10,
  },
  {
    asin: "B09K3XHWM9",
    title: "Banc de Musculation Pliable Multifonction",
    brand: "WEREL FIT",
    purchase_price: 55.00,
    lead_time_days: 30,
    reorder_buffer_days: 14,
  },
  {
    asin: "B09K3XHWA0",
    title: "Push-Up Board Planche 12 Positions Couleur",
    brand: "WEREL SPORT",
    purchase_price: 7.80,
    lead_time_days: 14,
    reorder_buffer_days: 5,
  },
]

// Génère des commandes fictives pour les N derniers jours
export function generateDemoOrders(days: number) {
  const orders = []
  const now = new Date()

  for (const product of DEMO_PRODUCTS) {
    // Chaque produit a un volume de vente différent
    const baseVelocity = getBaseVelocity(product.asin)

    for (let d = 0; d < days; d++) {
      // Variation aléatoire mais déterministe (basée sur asin + jour)
      const seed = hashCode(product.asin + d)
      const dailySales = Math.max(0, Math.round(baseVelocity + (seed % 3) - 1))

      for (let i = 0; i < dailySales; i++) {
        const sellingPrice = getSellingPrice(product.asin)
        const fbaFee = Math.round(sellingPrice * 0.12 * 100) / 100
        const referralFee = Math.round(sellingPrice * 0.15 * 100) / 100

        const orderDate = new Date(now)
        orderDate.setDate(orderDate.getDate() - d)

        orders.push({
          order_id: `DEMO-${product.asin}-${d}-${i}`,
          asin: product.asin,
          quantity: 1,
          selling_price: sellingPrice,
          fba_fee: fbaFee,
          referral_fee: referralFee,
          net_revenue: sellingPrice - fbaFee - referralFee,
          order_date: orderDate.toISOString(),
          products: {
            title: product.title,
            brand: product.brand,
            purchase_price: product.purchase_price,
            lead_time_days: product.lead_time_days,
            reorder_buffer_days: product.reorder_buffer_days,
          },
        })
      }
    }
  }

  return orders
}

export function generateDemoInventory() {
  return DEMO_PRODUCTS.map((product) => ({
    asin: product.asin,
    title: product.title,
    status: "active",
    purchase_price: product.purchase_price,
    quantity_available: getStockLevel(product.asin),
    quantity_inbound: getInboundLevel(product.asin),
  }))
}

// ── Helpers déterministes ────────────────────────────────────────────────────

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash)
}

function getBaseVelocity(asin: string): number {
  const velocities: Record<string, number> = {
    "B09K3XHWM1": 4,   // Haltères - best seller
    "B09K3XHWM2": 6,   // Tapis yoga - très populaire
    "B09K3XHWM3": 8,   // Corde à sauter - forte vélocité
    "B09K3XHWM4": 10,  // Bandes élastiques - top seller
    "B09K3XHWM5": 3,   // Foam roller
    "B09K3XHWM6": 2,   // Gants
    "B09K3XHWM7": 2,   // Kettlebell
    "B09K3XHWM8": 1,   // Sac de frappe
    "B09K3XHWM9": 1,   // Banc musculation
    "B09K3XHWA0": 5,   // Push-up board
  }
  return velocities[asin] ?? 2
}

function getSellingPrice(asin: string): number {
  const prices: Record<string, number> = {
    "B09K3XHWM1": 79.99,
    "B09K3XHWM2": 24.99,
    "B09K3XHWM3": 14.99,
    "B09K3XHWM4": 12.99,
    "B09K3XHWM5": 19.99,
    "B09K3XHWM6": 17.99,
    "B09K3XHWM7": 44.99,
    "B09K3XHWM8": 129.99,
    "B09K3XHWM9": 149.99,
    "B09K3XHWA0": 22.99,
  }
  return prices[asin] ?? 19.99
}

function getStockLevel(asin: string): number {
  // Niveaux de stock variés pour montrer différentes urgences
  const stocks: Record<string, number> = {
    "B09K3XHWM1": 45,   // OK
    "B09K3XHWM2": 18,   // Attention - 3 jours
    "B09K3XHWM3": 12,   // Urgent - 1.5 jours
    "B09K3XHWM4": 250,  // Bien en stock
    "B09K3XHWM5": 85,   // OK
    "B09K3XHWM6": 5,    // Critique !
    "B09K3XHWM7": 30,   // OK
    "B09K3XHWM8": 3,    // Critique !
    "B09K3XHWM9": 8,    // Attention
    "B09K3XHWA0": 120,  // Bien en stock
  }
  return stocks[asin] ?? 50
}

function getInboundLevel(asin: string): number {
  const inbound: Record<string, number> = {
    "B09K3XHWM1": 0,
    "B09K3XHWM2": 100,
    "B09K3XHWM3": 0,
    "B09K3XHWM4": 0,
    "B09K3XHWM5": 50,
    "B09K3XHWM6": 30,
    "B09K3XHWM7": 0,
    "B09K3XHWM8": 10,
    "B09K3XHWM9": 0,
    "B09K3XHWA0": 0,
  }
  return inbound[asin] ?? 0
}
