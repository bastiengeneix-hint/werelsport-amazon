import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { buildSystemPrompt } from "@/lib/ai-context"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: Request) {
  try {
    const { messages } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      )
    }

    const systemPrompt = await buildSystemPrompt()

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages.map(
        (m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })
      ),
    })

    const textContent = response.content.find((c) => c.type === "text")
    const text = textContent ? textContent.text : ""

    return NextResponse.json({ response: text })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "AI chat error"
    console.error("AI chat error:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
