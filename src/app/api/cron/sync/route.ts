import { NextResponse } from "next/server"

export const maxDuration = 300

export async function GET(request: Request) {
  // Verify cron secret for Vercel Cron Jobs
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Trigger incremental sync
    const baseUrl =
      process.env.NEXTAUTH_URL || process.env.VERCEL_URL || "http://localhost:3000"
    const response = await fetch(`${baseUrl}/api/amazon/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullSync: false }),
    })

    const result = await response.json()
    return NextResponse.json({ success: true, result })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Cron sync failed"
    console.error("Cron sync error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
