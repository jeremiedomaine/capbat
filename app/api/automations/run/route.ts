import { NextResponse } from "next/server"
import { checkAutomationSecret } from "@/lib/automation-auth"
import { runAutomations } from "@/lib/automation-engine"

/**
 * GET/POST — cron Vercel ou tests (`?dryRun=1`, `?skipSchedule=1`).
 */
export async function GET(request: Request) {
  return handleRun(request)
}

export async function POST(request: Request) {
  return handleRun(request)
}

async function handleRun(request: Request) {
  const authError = checkAutomationSecret(request)
  if (authError) return authError

  const url = new URL(request.url)
  const dryRun = url.searchParams.get("dryRun") === "1"
  const skipSchedule = url.searchParams.get("skipSchedule") === "1"

  try {
    const result = await runAutomations({ dryRun, skipSchedule })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
