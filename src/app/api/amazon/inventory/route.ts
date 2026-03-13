import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const asin = searchParams.get("asin")

  // Get latest inventory snapshot per ASIN
  let query = supabaseAdmin
    .from("inventory_snapshots")
    .select("*")
    .order("snapshot_at", { ascending: false })

  if (asin) {
    query = query.eq("asin", asin)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Keep only the latest snapshot per ASIN
  const latestByAsin = new Map<string, (typeof data)[0]>()
  for (const snapshot of data || []) {
    if (!latestByAsin.has(snapshot.asin)) {
      latestByAsin.set(snapshot.asin, snapshot)
    }
  }

  return NextResponse.json({
    inventory: Array.from(latestByAsin.values()),
  })
}
