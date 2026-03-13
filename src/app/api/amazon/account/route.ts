import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"

// Get the current connected Amazon account info
export async function GET() {
  try {
    const { data: account } = await supabaseAdmin
      .from("amazon_accounts")
      .select("id, seller_id, region, connected_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single()

    if (!account) {
      return NextResponse.json({ connected: false, account: null })
    }

    const { data: marketplaces } = await supabaseAdmin
      .from("amazon_marketplaces")
      .select("marketplace_id, country_code, name, is_active")
      .eq("account_id", account.id)
      .order("name")

    return NextResponse.json({
      connected: true,
      account: {
        sellerId: account.seller_id,
        region: account.region,
        connectedAt: account.connected_at,
      },
      marketplaces: marketplaces || [],
    })
  } catch {
    // No account table yet or no data
    const hasEnvToken = !!process.env.AMAZON_REFRESH_TOKEN
    return NextResponse.json({
      connected: hasEnvToken,
      account: hasEnvToken
        ? { sellerId: "env", region: "eu", connectedAt: null }
        : null,
      marketplaces: [],
    })
  }
}

// Disconnect: delete the account
export async function DELETE() {
  try {
    await supabaseAdmin.from("amazon_accounts").delete().neq("id", "00000000-0000-0000-0000-000000000000")
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
