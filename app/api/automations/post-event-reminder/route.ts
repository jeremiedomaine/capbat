import { NextResponse } from "next/server"
import { checkAutomationSecret } from "@/lib/automation-auth"
import {
  getAutomationSettings,
  markPostEventReminderParisDate,
} from "@/lib/automation-settings-store"
import {
  POST_EVENT_REMINDER_DAYS_AFTER,
  FIXED_AUTOMATION_SEND_TIME,
} from "@/lib/automation-defaults"
import {
  addCalendarDaysInTimeZone,
  getAutomationCronPollMinutes,
  getAutomationTimezone,
  getZonedCalendarDateAndMinutes,
  shouldRunScheduledSend,
} from "@/lib/automation-schedule"
import { buildAutomationVariableMap, renderTemplate } from "@/lib/email-template"
import { listWeddings, markPostEventReminderSent } from "@/lib/weddings-store"
import { getResendClient } from "@/lib/resend"

/**
 * Message après mariage : J+3 (3 jours après la date d'événement), mariages uniquement.
 * GET/POST pour Vercel Cron ou tests manuels (`?dryRun=1`, `?skipSchedule=1`).
 */
export async function GET(request: Request) {
  return runPostEventReminder(request)
}

export async function POST(request: Request) {
  return runPostEventReminder(request)
}

async function runPostEventReminder(request: Request) {
  const authError = checkAutomationSecret(request)
  if (authError) return authError

  const url = new URL(request.url)
  const dryRun = url.searchParams.get("dryRun") === "1"
  const skipSchedule = url.searchParams.get("skipSchedule") === "1"
  const daysAfter = clampDaysAfter(
    url.searchParams.get("days"),
    POST_EVENT_REMINDER_DAYS_AFTER
  )

  const automation = await getAutomationSettings()
  const timeZone = getAutomationTimezone()
  /** Date d'événement cible : aujourd'hui moins N jours civils. */
  const targetEventDate = addCalendarDaysInTimeZone(timeZone, -daysAfter)

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
        automation: "post_event_j_plus",
        sendTime: FIXED_AUTOMATION_SEND_TIME,
        timeZone,
        pollWindowMinutes,
        calendarDate: scheduleCheck.calendarDate,
      })
    }
    if (automation.lastPostEventReminderParisDate === calendarDate) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "already_ran_today",
        automation: "post_event_j_plus",
        sendTime: FIXED_AUTOMATION_SEND_TIME,
        timeZone,
        calendarDate,
      })
    }
  }

  const weddings = await listWeddings()
  const candidates = weddings.filter((wedding) => {
    if (wedding.eventType !== "wedding") return false
    if (!wedding.autopilot || !wedding.email) return false
    if (wedding.eventDate.slice(0, 10) !== targetEventDate) return false
    if (wedding.postEventReminderSentDate) return false
    return true
  })

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      automation: "post_event_j_plus",
      targetEventDate,
      daysAfter,
      filter: "weddings_autopilot_not_yet_sent",
      count: candidates.length,
      recipients: candidates.map((wedding) => wedding.email),
      sendTime: FIXED_AUTOMATION_SEND_TIME,
      timeZone,
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
    const vars = buildAutomationVariableMap(wedding, undefined, daysAfter)
    try {
      await resend.emails.send({
        from: fromEmail,
        to: wedding.email,
        subject: renderTemplate(automation.postEventSubjectTemplate, vars),
        text: renderTemplate(automation.postEventMessageTemplate, vars),
      })
      await markPostEventReminderSent(wedding.id, calendarDate)
      sentTo.push(wedding.email)
    } catch (error) {
      failures.push({
        email: wedding.email,
        reason: error instanceof Error ? error.message : "Erreur inconnue",
      })
    }
  }

  if (!skipSchedule) {
    await markPostEventReminderParisDate(calendarDate)
  }

  return NextResponse.json({
    ok: failures.length === 0,
    automation: "post_event_j_plus",
    daysAfter,
    targetEventDate,
    filter: "weddings_autopilot_not_yet_sent",
    matched: candidates.length,
    sent: sentTo.length,
    failed: failures.length,
    failures,
    sendTime: FIXED_AUTOMATION_SEND_TIME,
    timeZone,
    pollWindowMinutes,
  })
}

function clampDaysAfter(raw: string | null, fallback: number) {
  const n = Number.parseInt(raw ?? "", 10)
  if (!Number.isFinite(n) || n < 0 || n > 365) return fallback
  return n
}
