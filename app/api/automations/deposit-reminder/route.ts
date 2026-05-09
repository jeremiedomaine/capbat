import { NextResponse } from "next/server"
import {
  getAutomationSettings,
  markDepositReminderParisDate,
} from "@/lib/automation-settings-store"
import {
  addCalendarDaysInTimeZone,
  getAutomationCronPollMinutes,
  getAutomationTimezone,
  getZonedCalendarDateAndMinutes,
  shouldRunScheduledSend,
} from "@/lib/automation-schedule"
import { FIXED_AUTOMATION_SEND_TIME } from "@/lib/automation-defaults"
import { buildAutomationVariableMap, renderTemplate } from "@/lib/email-template"
import { listWeddings } from "@/lib/weddings-store"
import { getResendClient } from "@/lib/resend"

/**
 * POST pour les tests manuels (curl) ; GET pour Vercel Cron (`0 * * * *`).
 * Envoi autorisé une fois par jour entre 9h00 et 9h55 (fuseau `AUTOMATION_TIMEZONE`, défaut Europe/Paris).
 * `?dryRun=1` : ignore le créneau. `?skipSchedule=1` : envoi immédiat (tests, ne marque pas la journée).
 */
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
  const skipSchedule = url.searchParams.get("skipSchedule") === "1"
  const daysAhead = clampDaysAhead(url.searchParams.get("days"), 30)

  const automation = await getAutomationSettings()
  const timeZone = getAutomationTimezone()
  const targetDate = addCalendarDaysInTimeZone(timeZone, daysAhead)

  const pollWindowMinutes = getAutomationCronPollMinutes()
  const scheduleCheck = shouldRunScheduledSend(FIXED_AUTOMATION_SEND_TIME, {
    timeZone,
    pollWindowMinutes,
  })
  const calendarDate = getZonedCalendarDateAndMinutes(timeZone).calendarDate

  if (!dryRun && !skipSchedule) {
    if (!scheduleCheck.run) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "outside_send_window",
        sendTime: FIXED_AUTOMATION_SEND_TIME,
        timeZone,
        pollWindowMinutes,
        calendarDate: scheduleCheck.calendarDate,
        nowMinutes: scheduleCheck.nowMinutes,
        targetMinutes: scheduleCheck.targetMinutes,
      })
    }
    if (automation.lastDepositReminderParisDate === calendarDate) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "already_ran_today",
        sendTime: FIXED_AUTOMATION_SEND_TIME,
        timeZone,
        calendarDate,
      })
    }
  }

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
      sendTime: FIXED_AUTOMATION_SEND_TIME,
      timeZone,
      schedule: {
        withinSendWindow: scheduleCheck.run,
        calendarDate: scheduleCheck.calendarDate,
        pollWindowMinutes,
      },
    })
  }

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

  if (!skipSchedule) {
    const ranDay = getZonedCalendarDateAndMinutes(timeZone).calendarDate
    await markDepositReminderParisDate(ranDay)
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
    sendTime: FIXED_AUTOMATION_SEND_TIME,
    timeZone,
    pollWindowMinutes,
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
