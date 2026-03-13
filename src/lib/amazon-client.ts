// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const SellingPartner = require("amazon-sp-api")
import { supabaseAdmin } from "@/lib/supabase"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clientCache = new Map<string, any>()

export const DEFAULT_MARKETPLACE_ID =
  process.env.AMAZON_MARKETPLACE_ID || "A13V1IB3VIYZZH"

// Get the active marketplace ID from app_settings, fallback to env/default
export async function getActiveMarketplaceId(): Promise<string> {
  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("active_marketplace_id")
      .eq("id", 1)
      .single()
    return data?.active_marketplace_id || DEFAULT_MARKETPLACE_ID
  } catch {
    return DEFAULT_MARKETPLACE_ID
  }
}

// Create a SP client for a specific refresh token + region
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSpClientForAccount(refreshToken: string, region: string = "eu"): any {
  const cacheKey = `${region}:${refreshToken.slice(0, 10)}`
  if (!clientCache.has(cacheKey)) {
    clientCache.set(
      cacheKey,
      new SellingPartner({
        region,
        refresh_token: refreshToken,
        credentials: {
          SELLING_PARTNER_APP_CLIENT_ID: process.env.AMAZON_CLIENT_ID!,
          SELLING_PARTNER_APP_CLIENT_SECRET: process.env.AMAZON_CLIENT_SECRET!,
        },
      })
    )
  }
  return clientCache.get(cacheKey)
}

// Get the active SP client: DB account first, then env vars fallback
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getActiveSpClient(): Promise<any> {
  try {
    const { data } = await supabaseAdmin
      .from("amazon_accounts")
      .select("refresh_token, region")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single()

    if (data?.refresh_token) {
      return getSpClientForAccount(data.refresh_token, data.region || "eu")
    }
  } catch {
    // No DB account, fall through to env vars
  }

  // Fallback to environment variables
  const refreshToken = process.env.AMAZON_REFRESH_TOKEN
  if (!refreshToken) {
    throw new Error("Aucun compte Amazon connecté et AMAZON_REFRESH_TOKEN non défini")
  }
  return getSpClientForAccount(refreshToken)
}

// Legacy sync getter (kept for backward compat, uses env only)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSpClient(): any {
  const refreshToken = process.env.AMAZON_REFRESH_TOKEN
  if (!refreshToken) {
    throw new Error("AMAZON_REFRESH_TOKEN non défini")
  }
  return getSpClientForAccount(refreshToken)
}

export async function fetchOrders(createdAfter: string, marketplaceId?: string) {
  const client = await getActiveSpClient()
  const mpId = marketplaceId || await getActiveMarketplaceId()
  const response = await client.callAPI({
    operation: "getOrders",
    query: {
      MarketplaceIds: [mpId],
      CreatedAfter: createdAfter,
      OrderStatuses: ["Shipped"],
    },
  })
  return response.Orders || []
}

export async function fetchOrderItems(orderId: string) {
  const client = await getActiveSpClient()
  const response = await client.callAPI({
    operation: "getOrderItems",
    path: { orderId },
  })
  return response.OrderItems || []
}

export async function fetchInventory(marketplaceId?: string) {
  const client = await getActiveSpClient()
  const mpId = marketplaceId || await getActiveMarketplaceId()
  const response = await client.callAPI({
    operation: "getFbaInventorySummaries",
    query: {
      granularityType: "Marketplace",
      granularityId: mpId,
      marketplaceIds: [mpId],
    },
  })
  return response.inventorySummaries || []
}

export async function fetchFinancialEvents(orderId: string) {
  const client = await getActiveSpClient()
  const response = await client.callAPI({
    operation: "getOrderFinancialEvents",
    path: { orderId },
  })
  return response
}

export async function requestSettlementReport(marketplaceId?: string) {
  const client = await getActiveSpClient()
  const mpId = marketplaceId || await getActiveMarketplaceId()
  const response = await client.callAPI({
    operation: "createReport",
    body: {
      reportType: "GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE_V2",
      marketplaceIds: [mpId],
    },
  })
  return response.reportId
}

export async function getReport(reportId: string) {
  const client = await getActiveSpClient()
  const response = await client.callAPI({
    operation: "getReport",
    path: { reportId },
  })
  return response
}

export async function getReportDocument(reportDocumentId: string) {
  const client = await getActiveSpClient()
  const response = await client.callAPI({
    operation: "getReportDocument",
    path: { reportDocumentId },
  })
  return response
}

// Retry wrapper with exponential backoff for SP-API rate limits
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 2000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: unknown) {
      const isThrottled =
        error instanceof Error && error.message?.includes("QuotaExceeded")
      if (attempt === maxRetries || !isThrottled) throw error
      const delay = baseDelay * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw new Error("Max retries exceeded")
}
