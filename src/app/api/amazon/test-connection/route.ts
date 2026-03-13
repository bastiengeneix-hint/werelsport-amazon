import { NextResponse } from "next/server";
import { getSpClient } from "@/lib/amazon-client";

export async function POST() {
  try {
    const missing: string[] = [];
    if (!process.env.AMAZON_CLIENT_ID) missing.push("AMAZON_CLIENT_ID");
    if (!process.env.AMAZON_CLIENT_SECRET) missing.push("AMAZON_CLIENT_SECRET");
    if (!process.env.AMAZON_REFRESH_TOKEN) missing.push("AMAZON_REFRESH_TOKEN");

    if (missing.length > 0) {
      return NextResponse.json(
        { connected: false, error: `Variables manquantes : ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    const sp = await getSpClient();
    // Light call to verify credentials — fetch marketplace participations
    await sp.callAPI({
      operation: "getMarketplaceParticipations",
      endpoint: "sellers",
    });

    return NextResponse.json({ connected: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json(
      { connected: false, error: message },
      { status: 500 }
    );
  }
}
