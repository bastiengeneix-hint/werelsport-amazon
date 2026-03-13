import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const asin = searchParams.get("asin")
  const days = parseInt(searchParams.get("days") || "30")
  const brand = searchParams.get("brand")

  const dateFrom = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000
  ).toISOString()

  let query = supabaseAdmin
    .from("orders")
    .select("*, products(title, brand, purchase_price)")
    .gte("order_date", dateFrom)
    .order("order_date", { ascending: false })

  if (asin) {
    query = query.eq("asin", asin)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Filter by brand if needed (requires join)
  let filtered = data || []
  if (brand) {
    filtered = filtered.filter(
      (o: Record<string, unknown>) =>
        (o.products as Record<string, unknown>)?.brand === brand
    )
  }

  return NextResponse.json({ orders: filtered })
}
