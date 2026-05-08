import { NextResponse } from "next/server"
import { getAutomationSettings } from "@/lib/automation-settings-store"
import { buildAutomationVariableMap, renderTemplate } from "@/lib/email-template"
import { listWeddings } from "@/lib/weddings-store"
import { getResendClient } from "@/lib/resend"

/** POST pour les tests manuels (curl) ; GET pour Vercel Cron. */
export async function GET(request: Request) {
  return runDepositReminder(request)
}

export async function POST(request: Request) {
  return runDepositReminder(request)
}

async function runDepositReminder(request: Request) {
  const authError = checkAutomationSecret(request)
  if (authError) return authError

  const url = new URL(request.url)
  const dryRun = url.searchParams.get("dryRun") === "1"
  const daysAhead = clampDaysAhead(url.searchParams.get("days"), 30)
  const targetDate = getCalendarDateDaysFromToday(daysAhead)

  const weddings = await listWeddings()
  const candidates = weddings.filter((wedding) => {
    if (!wedding.autopilot || !wedding.email) return false
    if (wedding.eventDate.slice(0, 10) !== targetDate) return false
    return wedding.balance.status === "pending"
  })

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      targetDate,
      daysAhead,
      filter: "balance_pending_only",
      count: candidates.length,
      recipients: candidates.map((wedding) => wedding.email),
    })
  }

  const automation = await getAutomationSettings()

  const resend = getResendClient()
  const fromEmail = process.env.RESEND_FROM_EMAIL
  if (!fromEmail) {
    return NextResponse.json({ error: "RESEND_FROM_EMAIL manquante." }, { status: 500 })
  }

  const sentTo: string[] = []
  const failures: Array<{ email: string; reason: string }> = []

  for (const wedding of candidates) {
    const vars = buildAutomationVariableMap(wedding, daysAhead)
    try {
      await resend.emails.send({
        from: fromEmail,
        to: wedding.email,
        subject: renderTemplate(automation.subjectTemplate, vars),
        text: renderTemplate(automation.messageTemplate, vars),
      })
      sentTo.push(wedding.email)
    } catch (error) {
      failures.push({
        email: wedding.email,
        reason: error instanceof Error ? error.message : "Erreur inconnue",
      })
    }
  }

  return NextResponse.json({
    ok: failures.length === 0,
    filter: "balance_pending_only",
    daysAhead,
    targetDate,
    matched: candidates.length,
    sent: sentTo.length,
    failed: failures.length,
    failures,
  })
}

/** Manuel : AUTOMATION_SECRET (header). Vercel Cron : CRON_SECRET en Bearer (voir dashboard). */
function checkAutomationSecret(request: Request) {
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

function clampDaysAhead(raw: string | null, fallback: number) {
  const n = Number.parseInt(raw ?? "", 10)
  if (!Number.isFinite(n) || n < 0 || n > 365) return fallback
  return n
}

function getCalendarDateDaysFromToday(daysFromToday: number) {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + daysFromToday)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
