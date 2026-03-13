import { NextResponse } from "next/server"
import crypto from "crypto"

export async function GET() {
  const clientId = process.env.AMAZON_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: "AMAZON_CLIENT_ID non configuré" }, { status: 500 })
  }

  const baseUrl = process.env.NEXTAUTH_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  const callbackUrl = `${baseUrl}/api/amazon/callback`
  const state = crypto.randomBytes(16).toString("hex")

  const authUrl = new URL("https://sellercentral.amazon.com/apps/authorize/consent")
  authUrl.searchParams.set("application_id", clientId)
  authUrl.searchParams.set("redirect_uri", callbackUrl)
  authUrl.searchParams.set("state", state)

  const response = NextResponse.redirect(authUrl.toString())
  response.cookies.set("amazon_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 min
    path: "/",
  })

  return response
}
