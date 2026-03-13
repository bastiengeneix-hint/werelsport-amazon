import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { MARKETPLACES } from "@/lib/marketplaces"

export async function GET() {
  try {
    // Try to get marketplaces from DB (discovered via OAuth)
    const { data: dbMarketplaces } = await supabaseAdmin
      .from("amazon_marketplaces")
      .select("marketplace_id, country_code, name, is_active")
      .order("name")

    if (dbMarketplaces && dbMarketplaces.length > 0) {
      return NextResponse.json({ marketplaces: dbMarketplaces })
    }

    // Fallback: return all known marketplaces as options (none connected yet)
    const fallback = MARKETPLACES.map((m) => ({
      marketplace_id: m.id,
      country_code: m.code,
      name: m.name,
      is_active: m.id === "A13V1IB3VIYZZH", // Only FR active by default
    }))

    return NextResponse.json({ marketplaces: fallback })
  } catch {
    return NextResponse.json({ marketplaces: [] })
  }
}

// Toggle a marketplace active/inactive
export async function POST(request: Request) {
  try {
    const { marketplaceId, isActive } = await request.json()

    const { error } = await supabaseAdmin
      .from("amazon_marketplaces")
      .update({ is_active: isActive })
      .eq("marketplace_id", marketplaceId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
