import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { MARKETPLACES } from "@/lib/marketplaces"

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const SellingPartner = require("amazon-sp-api")

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const oauthCode = searchParams.get("spapi_oauth_code")
  const state = searchParams.get("state")
  const sellingPartnerId = searchParams.get("selling_partner_id")

  // Validate state
  const savedState = request.cookies.get("amazon_oauth_state")?.value
  if (!state || state !== savedState) {
    return NextResponse.redirect(new URL("/settings?error=invalid_state", request.url))
  }

  if (!oauthCode) {
    return NextResponse.redirect(new URL("/settings?error=no_code", request.url))
  }

  const clientId = process.env.AMAZON_CLIENT_ID!
  const clientSecret = process.env.AMAZON_CLIENT_SECRET!
  // Build base URL (origin only, no path)
  const raw = process.env.NEXTAUTH_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  const baseUrl = new URL(raw.startsWith("http") ? raw : `https://${raw}`).origin
  const callbackUrl = `${baseUrl}/api/amazon/callback`

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://api.amazon.com/auth/o2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: oauthCode,
        redirect_uri: callbackUrl,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      console.error("Token exchange failed:", err)
      return NextResponse.redirect(new URL("/settings?error=token_exchange", request.url))
    }

    const tokens = await tokenRes.json()
    const refreshToken = tokens.refresh_token

    // Upsert amazon account
    const { data: account, error: accountError } = await supabaseAdmin
      .from("amazon_accounts")
      .upsert(
        {
          seller_id: sellingPartnerId || "unknown",
          refresh_token: refreshToken,
          region: "eu",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "seller_id" }
      )
      .select()
      .single()

    if (accountError) {
      // If upsert fails due to no unique constraint on seller_id, try insert
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("amazon_accounts")
        .insert({
          seller_id: sellingPartnerId || "unknown",
          refresh_token: refreshToken,
          region: "eu",
        })
        .select()
        .single()

      if (insertError) {
        console.error("DB error:", insertError)
        return NextResponse.redirect(new URL("/settings?error=db_error", request.url))
      }

      // Use the inserted account
      await discoverMarketplaces(inserted.id, refreshToken, clientId, clientSecret)
    } else {
      await discoverMarketplaces(account.id, refreshToken, clientId, clientSecret)
    }

    const response = NextResponse.redirect(new URL("/settings?connected=true", baseUrl))
    response.cookies.delete("amazon_oauth_state")
    return response
  } catch (err) {
    console.error("OAuth callback error:", err)
    return NextResponse.redirect(new URL("/settings?error=unknown", request.url))
  }
}

async function discoverMarketplaces(
  accountId: string,
  refreshToken: string,
  clientId: string,
  clientSecret: string
) {
  try {
    const sp = new SellingPartner({
      region: "eu",
      refresh_token: refreshToken,
      credentials: {
        SELLING_PARTNER_APP_CLIENT_ID: clientId,
        SELLING_PARTNER_APP_CLIENT_SECRET: clientSecret,
      },
    })

    const participations = await sp.callAPI({
      operation: "getMarketplaceParticipations",
      endpoint: "sellers",
    })

    if (!participations || !Array.isArray(participations)) return

    // Clear old marketplaces for this account
    await supabaseAdmin
      .from("amazon_marketplaces")
      .delete()
      .eq("account_id", accountId)

    // Insert discovered marketplaces
    for (const participation of participations) {
      const mp = participation.marketplace
      if (!mp?.id) continue

      const known = MARKETPLACES.find((m) => m.id === mp.id)
      await supabaseAdmin.from("amazon_marketplaces").insert({
        account_id: accountId,
        marketplace_id: mp.id,
        country_code: known?.code || mp.countryCode || "??",
        name: known?.name || mp.name || mp.id,
        is_active: true,
      })
    }
  } catch (err) {
    console.error("Failed to discover marketplaces:", err)
    // Non-fatal: account is still saved, user can configure manually
  }
}
