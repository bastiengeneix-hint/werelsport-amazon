import { NextResponse } from "next/server"
import {
  fetchOrders,
  fetchOrderItems,
  fetchInventory,
  fetchFinancialEvents,
  getActiveMarketplaceId,
  withRetry,
} from "@/lib/amazon-client"
import { supabaseAdmin } from "@/lib/supabase"

export const maxDuration = 300 // 5 minutes for initial sync

export async function POST(request: Request) {
  try {
    const { fullSync, marketplaceId: requestedMpId } = await request
      .json()
      .catch(() => ({ fullSync: false, marketplaceId: undefined }))

    const marketplaceId = requestedMpId || (await getActiveMarketplaceId())
    const daysBack = fullSync ? 90 : 1
    const createdAfter = new Date(
      Date.now() - daysBack * 24 * 60 * 60 * 1000
    ).toISOString()

    // 1. Sync Orders
    const orders = await withRetry(() => fetchOrders(createdAfter, marketplaceId))
    let syncedOrders = 0

    for (const order of orders) {
      const items = await withRetry(() => fetchOrderItems(order.AmazonOrderId))

      for (const item of items) {
        // Get financial events for fees
        let fbaFee = 0
        let referralFee = 0
        try {
          const financials = await withRetry(() =>
            fetchFinancialEvents(order.AmazonOrderId)
          )
          const shipmentEvents =
            financials?.FinancialEvents?.ShipmentEventList || []
          for (const event of shipmentEvents) {
            for (const shipItem of event.ShipmentItemList || []) {
              if (shipItem.SellerSKU === item.SellerSKU) {
                for (const fee of shipItem.ItemFeeList || []) {
                  if (fee.FeeType === "FBAPerUnitFulfillmentFee") {
                    fbaFee = Math.abs(fee.FeeAmount?.CurrencyAmount || 0)
                  }
                  if (fee.FeeType === "Commission") {
                    referralFee = Math.abs(fee.FeeAmount?.CurrencyAmount || 0)
                  }
                }
              }
            }
          }
        } catch {
          // Financial events may not be available for all orders
        }

        const sellingPrice = parseFloat(
          item.ItemPrice?.Amount || item.ItemPrice || "0"
        )
        const netRevenue = sellingPrice - fbaFee - referralFee

        await supabaseAdmin.from("orders").upsert(
          {
            order_id: `${order.AmazonOrderId}-${item.ASIN}`,
            asin: item.ASIN,
            quantity: item.QuantityOrdered || 1,
            selling_price: sellingPrice,
            fba_fee: fbaFee,
            referral_fee: referralFee,
            net_revenue: netRevenue,
            order_date: order.PurchaseDate,
            marketplace_id: marketplaceId,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "order_id" }
        )
        syncedOrders++
      }
    }

    // 2. Sync Inventory
    const inventoryItems = await withRetry(() => fetchInventory(marketplaceId))
    let syncedInventory = 0

    for (const item of inventoryItems) {
      await supabaseAdmin.from("inventory_snapshots").insert({
        asin: item.asin,
        quantity_available: item.totalQuantity || 0,
        quantity_inbound: item.inboundReceivingQuantity || 0,
        marketplace_id: marketplaceId,
      })
      syncedInventory++
    }

    return NextResponse.json({
      success: true,
      message: `Synchronisation terminée pour marketplace ${marketplaceId}.`,
      synced: {
        orders: syncedOrders,
        inventory: syncedInventory,
      },
      period: `${daysBack} days`,
      marketplaceId,
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error during sync"
    console.error("Sync error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
