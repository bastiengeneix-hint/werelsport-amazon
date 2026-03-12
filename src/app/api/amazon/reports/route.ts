import { NextResponse } from "next/server"
import {
  requestSettlementReport,
  getReport,
  getReportDocument,
} from "@/lib/amazon-client"

export async function POST() {
  try {
    const reportId = await requestSettlementReport()
    return NextResponse.json({ reportId, status: "requested" })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to request report"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const reportId = searchParams.get("reportId")

  if (!reportId) {
    return NextResponse.json(
      { error: "reportId is required" },
      { status: 400 }
    )
  }

  try {
    const report = await getReport(reportId)

    if (report.processingStatus === "DONE" && report.reportDocumentId) {
      const document = await getReportDocument(report.reportDocumentId)
      return NextResponse.json({
        status: report.processingStatus,
        document,
      })
    }

    return NextResponse.json({ status: report.processingStatus })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to get report"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
