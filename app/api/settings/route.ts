import { NextResponse } from "next/server"
import { gateInternalToolAccess } from "@/lib/auth/internal-session"
import { getWorkspaceSettings, upsertWorkspaceSettings } from "@/lib/workspace-settings-store"
import { mergeWorkspaceSettings, type WorkspaceSettings } from "@/lib/workspace-settings"

export async function GET() {
  try {
    const denied = await gateInternalToolAccess()
    if (denied) return denied
    const settings = await getWorkspaceSettings()
    return NextResponse.json({ settings })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const denied = await gateInternalToolAccess()
    if (denied) return denied

    const body = (await request.json()) as Partial<WorkspaceSettings>
    const settings = await upsertWorkspaceSettings(mergeWorkspaceSettings(body))
    return NextResponse.json({ settings })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
