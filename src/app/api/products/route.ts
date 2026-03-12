import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("*")
    .order("updated_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ products: data || [] })
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const { asin, title, brand, purchase_price, supplier, lead_time_days, reorder_buffer_days } = body

  if (!asin) {
    return NextResponse.json({ error: "ASIN is required" }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from("products")
    .upsert(
      {
        asin,
        title: title || null,
        brand: brand || null,
        purchase_price: purchase_price || 0,
        supplier: supplier || null,
        lead_time_days: lead_time_days || 7,
        reorder_buffer_days: reorder_buffer_days || 10,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "asin" }
    )
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ product: data?.[0] })
}

export async function DELETE(request: NextRequest) {
  const { asin } = await request.json()

  if (!asin) {
    return NextResponse.json({ error: "ASIN is required" }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from("products")
    .delete()
    .eq("asin", asin)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
