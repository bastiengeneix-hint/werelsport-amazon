import { NextResponse } from "next/server"
import { getActiveSpClient } from "@/lib/amazon-client"

export async function POST() {
  try {
    if (!process.env.AMAZON_CLIENT_ID || !process.env.AMAZON_CLIENT_SECRET) {
      return NextResponse.json(
        { connected: false, error: "AMAZON_CLIENT_ID ou AMAZON_CLIENT_SECRET non configuré" },
        { status: 400 }
      )
    }

    const sp = await getActiveSpClient()
    await sp.callAPI({
      operation: "getMarketplaceParticipations",
      endpoint: "sellers",
    })

    return NextResponse.json({ connected: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue"
    return NextResponse.json(
      { connected: false, error: message },
      { status: 500 }
    )
  }
}
