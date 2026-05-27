import { NextResponse } from "next/server"

/** Manuel : AUTOMATION_SECRET (header). Vercel Cron : CRON_SECRET en Bearer (voir dashboard). */
export function checkAutomationSecret(request: Request) {
  const automation = process.env.AUTOMATION_SECRET?.trim()
  const cron = process.env.CRON_SECRET?.trim()
  const allowed = [automation, cron].filter(Boolean)
  if (!allowed.length) {
    return NextResponse.json(
      { error: "AUTOMATION_SECRET ou CRON_SECRET requis (Variables Vercel)." },
      { status: 500 }
    )
  }

  const bearer = request.headers.get("authorization")
  const tokenFromBearer = bearer?.startsWith("Bearer ") ? bearer.slice(7).trim() : null
  const tokenFromHeader = request.headers.get("x-automation-secret")?.trim() ?? null
  const token = tokenFromBearer ?? tokenFromHeader
  if (!token || !allowed.includes(token)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 })
  }

  return null
}
