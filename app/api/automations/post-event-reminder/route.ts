import { NextResponse } from "next/server"
import { checkAutomationSecret } from "@/lib/automation-auth"
import { runAutomations } from "@/lib/automation-engine"

/** @deprecated Utiliser /api/automations/run */
export async function GET(request: Request) {
  return handleLegacy(request)
}

export async function POST(request: Request) {
  return handleLegacy(request)
}

async function handleLegacy(request: Request) {
  const authError = checkAutomationSecret(request)
  if (authError) return authError

  const url = new URL(request.url)
  const dryRun = url.searchParams.get("dryRun") === "1"
  const skipSchedule = url.searchParams.get("skipSchedule") === "1"

  try {
    const result = await runAutomations({ dryRun, skipSchedule })
    return NextResponse.json({ ...result, legacyRoute: "post-event-reminder" })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
