import { listAutomations, markAutomationRunDate, type Automation } from "@/lib/automations-store"
import { FIXED_AUTOMATION_SEND_TIME } from "@/lib/automation-defaults"
import {
  loadEnabledAssignmentKeys,
  loadSentLogKeys,
  markAutomationSent,
} from "@/lib/event-automations-store"
import {
  addCalendarDaysInTimeZone,
  getAutomationCronPollMinutes,
  getAutomationTimezone,
  getZonedCalendarDateAndMinutes,
  shouldRunScheduledSend,
} from "@/lib/automation-schedule"
import { buildAutomationVariableMap, renderTemplate } from "@/lib/email-template"
import { sendResendEmail } from "@/lib/resend-send"
import { listWeddings, type Wedding } from "@/lib/weddings-store"

export type AutomationRunResult = {
  ok: boolean
  dryRun?: boolean
  skipped?: boolean
  reason?: string
  timeZone: string
  calendarDate: string
  automations: Array<{
    automationId: string
    name: string
    dayOffset: number
    targetEventDate: string
    matched: number
    sent: number
    failed: number
    recipients?: string[]
    failures?: Array<{ email: string; reason: string }>
    skippedReason?: string
  }>
}

type RunOptions = {
  dryRun?: boolean
  skipSchedule?: boolean
}

export async function runAutomations(options: RunOptions = {}): Promise<AutomationRunResult> {
  const { dryRun = false, skipSchedule = false } = options
  const timeZone = getAutomationTimezone()
  const pollWindowMinutes = getAutomationCronPollMinutes()
  const scheduleCheck = shouldRunScheduledSend(FIXED_AUTOMATION_SEND_TIME, {
    timeZone,
    pollWindowMinutes,
  })
  const calendarDate = getZonedCalendarDateAndMinutes(timeZone).calendarDate

  if (!dryRun && !skipSchedule && !scheduleCheck.run) {
    return {
      ok: true,
      skipped: true,
      reason: "outside_send_window",
      timeZone,
      calendarDate,
      automations: [],
    }
  }

  const automations = await listAutomations(true)
  const weddings = await listWeddings()
  const enabledKeys = await loadEnabledAssignmentKeys()
  const sentKeys = await loadSentLogKeys()

  const fromEmail = process.env.RESEND_FROM_EMAIL

  if (!dryRun && !fromEmail) {
    throw new Error("RESEND_FROM_EMAIL manquante.")
  }

  const results: AutomationRunResult["automations"] = []

  for (const automation of automations) {
    const automationResult = await processAutomation({
      automation,
      weddings,
      enabledKeys,
      sentKeys,
      timeZone,
      calendarDate,
      dryRun,
      skipSchedule,
      fromEmail: fromEmail ?? "",
    })
    results.push(automationResult)
  }

  return {
    ok: results.every((r) => (r.failed ?? 0) === 0),
    dryRun,
    timeZone,
    calendarDate,
    automations: results,
  }
}

async function processAutomation(ctx: {
  automation: Automation
  weddings: Wedding[]
  enabledKeys: Set<string>
  sentKeys: Set<string>
  timeZone: string
  calendarDate: string
  dryRun: boolean
  skipSchedule: boolean
  fromEmail: string
}) {
  const { automation, weddings, enabledKeys, sentKeys, timeZone, calendarDate, dryRun, skipSchedule, fromEmail } =
    ctx

  if (!dryRun && !skipSchedule && automation.lastRunParisDate === calendarDate) {
    return {
      automationId: automation.id,
      name: automation.name,
      dayOffset: automation.dayOffset,
      targetEventDate: "",
      matched: 0,
      sent: 0,
      failed: 0,
      skippedReason: "already_ran_today",
    }
  }

  const targetEventDate = addCalendarDaysInTimeZone(timeZone, -automation.dayOffset)

  const candidates = weddings.filter((wedding) => {
    if (!wedding.email) return false
    if (!automation.eventTypes.includes(wedding.eventType)) return false
    if (wedding.eventDate.slice(0, 10) !== targetEventDate) return false
    if (automation.onlyIfBalancePending && wedding.balance.status !== "pending") return false
    if (!enabledKeys.has(`${wedding.id}:${automation.id}`)) return false
    if (sentKeys.has(`${wedding.id}:${automation.id}`)) return false
    return true
  })

  if (dryRun) {
    return {
      automationId: automation.id,
      name: automation.name,
      dayOffset: automation.dayOffset,
      targetEventDate,
      matched: candidates.length,
      sent: 0,
      failed: 0,
      recipients: candidates.map((w) => w.email),
    }
  }

  const sentTo: string[] = []
  const failures: Array<{ email: string; reason: string }> = []

  for (const wedding of candidates) {
    const daysAhead = automation.dayOffset < 0 ? Math.abs(automation.dayOffset) : undefined
    const daysAfter = automation.dayOffset > 0 ? automation.dayOffset : undefined
    const vars = buildAutomationVariableMap(wedding, daysAhead, daysAfter)
    try {
      await sendResendEmail({
        from: fromEmail,
        to: wedding.email,
        subject: renderTemplate(automation.subjectTemplate, vars),
        text: renderTemplate(automation.messageTemplate, vars),
      })
      await markAutomationSent(wedding.id, automation.id)
      sentKeys.add(`${wedding.id}:${automation.id}`)
      sentTo.push(wedding.email)
    } catch (error) {
      failures.push({
        email: wedding.email,
        reason: error instanceof Error ? error.message : "Erreur inconnue",
      })
    }
  }

  if (!skipSchedule) {
    await markAutomationRunDate(automation.id, calendarDate)
  }

  return {
    automationId: automation.id,
    name: automation.name,
    dayOffset: automation.dayOffset,
    targetEventDate,
    matched: candidates.length,
    sent: sentTo.length,
    failed: failures.length,
    failures: failures.length ? failures : undefined,
  }
}
