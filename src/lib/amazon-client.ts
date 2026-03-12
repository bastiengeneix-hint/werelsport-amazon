// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const SellingPartner = require("amazon-sp-api")

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let spClient: any = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSpClient(): any {
  if (!spClient) {
    spClient = new SellingPartner({
      region: "eu",
      refresh_token: process.env.AMAZON_REFRESH_TOKEN!,
      credentials: {
        SELLING_PARTNER_APP_CLIENT_ID: process.env.AMAZON_CLIENT_ID!,
        SELLING_PARTNER_APP_CLIENT_SECRET: process.env.AMAZON_CLIENT_SECRET!,
      },
    })
  }
  return spClient
}

export const MARKETPLACE_ID =
  process.env.AMAZON_MARKETPLACE_ID || "A13V1IB3VIYZZH"

export async function fetchOrders(createdAfter: string) {
  const client = getSpClient()
  const response = await client.callAPI({
    operation: "getOrders",
    query: {
      MarketplaceIds: [MARKETPLACE_ID],
      CreatedAfter: createdAfter,
      OrderStatuses: ["Shipped"],
    },
  })
  return response.Orders || []
}

export async function fetchOrderItems(orderId: string) {
  const client = getSpClient()
  const response = await client.callAPI({
    operation: "getOrderItems",
    path: { orderId },
  })
  return response.OrderItems || []
}

export async function fetchInventory() {
  const client = getSpClient()
  const response = await client.callAPI({
    operation: "getFbaInventorySummaries",
    query: {
      granularityType: "Marketplace",
      granularityId: MARKETPLACE_ID,
      marketplaceIds: [MARKETPLACE_ID],
    },
  })
  return response.inventorySummaries || []
}

export async function fetchFinancialEvents(orderId: string) {
  const client = getSpClient()
  const response = await client.callAPI({
    operation: "getOrderFinancialEvents",
    path: { orderId },
  })
  return response
}

export async function requestSettlementReport() {
  const client = getSpClient()
  const response = await client.callAPI({
    operation: "createReport",
    body: {
      reportType: "GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE_V2",
      marketplaceIds: [MARKETPLACE_ID],
    },
  })
  return response.reportId
}

export async function getReport(reportId: string) {
  const client = getSpClient()
  const response = await client.callAPI({
    operation: "getReport",
    path: { reportId },
  })
  return response
}

export async function getReportDocument(reportDocumentId: string) {
  const client = getSpClient()
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
