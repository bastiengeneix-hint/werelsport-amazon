import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("active_marketplace_id")
      .eq("id", 1)
      .single()

    return NextResponse.json({
      activeMarketplaceId: data?.active_marketplace_id || "A13V1IB3VIYZZH",
    })
  } catch {
    return NextResponse.json({ activeMarketplaceId: "A13V1IB3VIYZZH" })
  }
}

export async function POST(request: Request) {
  try {
    const { activeMarketplaceId } = await request.json()

    await supabaseAdmin
      .from("app_settings")
      .upsert(
        {
          id: 1,
          active_marketplace_id: activeMarketplaceId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )

    return NextResponse.json({ success: true, activeMarketplaceId })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
