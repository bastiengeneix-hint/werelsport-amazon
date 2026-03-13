import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const days = parseInt(searchParams.get("days") || "30")

  const dateFrom = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000
  ).toISOString()

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("asin, fba_fee, referral_fee, selling_price, net_revenue")
    .gte("order_date", dateFrom)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Aggregate fees by ASIN
  const feesByAsin = new Map<
    string,
    { total_fba: number; total_referral: number; count: number }
  >()

  for (const order of data || []) {
    const existing = feesByAsin.get(order.asin) || {
      total_fba: 0,
      total_referral: 0,
      count: 0,
    }
    existing.total_fba += order.fba_fee || 0
    existing.total_referral += order.referral_fee || 0
    existing.count++
    feesByAsin.set(order.asin, existing)
  }

  const fees = Array.from(feesByAsin.entries()).map(([asin, f]) => ({
    asin,
    avg_fba_fee: f.total_fba / f.count,
    avg_referral_fee: f.total_referral / f.count,
    total_fba_fees: f.total_fba,
    total_referral_fees: f.total_referral,
    order_count: f.count,
  }))

  return NextResponse.json({ fees })
}
