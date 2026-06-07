import type { EventType } from "@/lib/event-types"
import { EVENT_TYPE_LABELS, EVENT_TYPES } from "@/lib/event-types"
import { getEventYear, getTodayCalendarIsoKey, resolveEventDateKey } from "@/lib/event-dates"
import type { PaymentMethod } from "@/lib/payment-methods"
import { PAYMENT_METHOD_LABELS, PAYMENT_METHOD_OPTIONS } from "@/lib/payment-methods"

export type PaymentStatus = "pending" | "paid" | "to_collect"

export type PerformanceWeddingRow = {
  eventDate: string
  eventType: EventType
  deposit: { amount: string; status: PaymentStatus }
  balance: { amount: string; status: PaymentStatus }
  depositPaymentMethod?: PaymentMethod | ""
  balancePaymentMethod?: PaymentMethod | ""
}

type MonthKey = `${number}-${string}`

export function filterRowsByYear(
  rows: PerformanceWeddingRow[],
  year: number
): PerformanceWeddingRow[] {
  return rows.filter((row) => getEventYear(row.eventDate) === year)
}

export function parseEuroAmount(value: string): number {
  const cleaned = value.replace(/[^\d,.-]/g, "").replace(",", ".")
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

export function computePerformanceSummary(rows: PerformanceWeddingRow[]) {
  const totalExpected = rows.reduce(
    (sum, row) =>
      sum + parseEuroAmount(row.deposit.amount) + parseEuroAmount(row.balance.amount),
    0
  )

  const totalCollected = rows.reduce((sum, row) => {
    let partial = sum
    if (row.deposit.status === "paid") partial += parseEuroAmount(row.deposit.amount)
    if (row.balance.status === "paid") partial += parseEuroAmount(row.balance.amount)
    return partial
  }, 0)

  const outstanding = totalExpected - totalCollected

  const todayKey = getTodayCalendarIsoKey()
  const overdueBalanceRows = rows.filter((row) => {
    const key = resolveEventDateKey(row.eventDate)
    return key !== null && key < todayKey && row.balance.status !== "paid"
  })
  const overdueBalanceAmount = overdueBalanceRows.reduce(
    (sum, row) => sum + parseEuroAmount(row.balance.amount),
    0
  )

  const collectionRate =
    totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0

  return {
    totalExpected,
    totalCollected,
    outstanding,
    collectionRate,
    overdueBalanceAmount,
    overdueBalanceCount: overdueBalanceRows.length,
    eventCount: rows.length,
  }
}

export function buildRevenueByMonth(rows: PerformanceWeddingRow[]) {
  const map = new Map<MonthKey, { month: string; expected: number; collected: number }>()

  for (const row of rows) {
    const key = monthKeyFromDate(row.eventDate)
    if (!key) continue

    const expected = parseEuroAmount(row.deposit.amount) + parseEuroAmount(row.balance.amount)
    const collected =
      (row.deposit.status === "paid" ? parseEuroAmount(row.deposit.amount) : 0) +
      (row.balance.status === "paid" ? parseEuroAmount(row.balance.amount) : 0)

    const previous = map.get(key)
    if (!previous) {
      map.set(key, { month: monthLabelFromKey(key), expected, collected })
    } else {
      previous.expected += expected
      previous.collected += collected
    }
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value)
}

export function buildEventsByMonth(rows: PerformanceWeddingRow[]) {
  const map = new Map<MonthKey, { month: string; count: number }>()

  for (const row of rows) {
    const key = monthKeyFromDate(row.eventDate)
    if (!key) continue
    const previous = map.get(key)
    if (!previous) {
      map.set(key, { month: monthLabelFromKey(key), count: 1 })
    } else {
      previous.count += 1
    }
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value)
}

export function buildRevenueByEventType(rows: PerformanceWeddingRow[]) {
  const sums = Object.fromEntries(EVENT_TYPES.map((type) => [type, 0])) as Record<
    EventType,
    number
  >

  for (const row of rows) {
    const type = row.eventType ?? "wedding"
    sums[type] +=
      parseEuroAmount(row.deposit.amount) + parseEuroAmount(row.balance.amount)
  }

  return EVENT_TYPES.map((type) => ({
    type,
    label: EVENT_TYPE_LABELS[type],
    value: sums[type],
  })).filter((entry) => entry.value > 0)
}

export function buildAmountsByPaymentStatus(rows: PerformanceWeddingRow[]) {
  const sums: Record<PaymentStatus, number> = {
    pending: 0,
    paid: 0,
    to_collect: 0,
  }

  for (const row of rows) {
    sums[row.deposit.status] += parseEuroAmount(row.deposit.amount)
    sums[row.balance.status] += parseEuroAmount(row.balance.amount)
  }

  return [
    { name: "paid" as const, value: sums.paid },
    { name: "pending" as const, value: sums.pending },
    { name: "to_collect" as const, value: sums.to_collect },
  ]
}

export type PaymentMethodBucket = PaymentMethod | "unset"

export function buildCollectedByPaymentMethod(rows: PerformanceWeddingRow[]) {
  const sums = new Map<PaymentMethodBucket, number>()

  const add = (method: PaymentMethod | "" | undefined, amount: number) => {
    if (amount <= 0) return
    const key: PaymentMethodBucket =
      method && PAYMENT_METHOD_OPTIONS.includes(method as PaymentMethod)
        ? (method as PaymentMethod)
        : "unset"
    sums.set(key, (sums.get(key) ?? 0) + amount)
  }

  for (const row of rows) {
    if (row.deposit.status === "paid") {
      add(row.depositPaymentMethod, parseEuroAmount(row.deposit.amount))
    }
    if (row.balance.status === "paid") {
      add(row.balancePaymentMethod, parseEuroAmount(row.balance.amount))
    }
  }

  const ordered: PaymentMethodBucket[] = [...PAYMENT_METHOD_OPTIONS, "unset"]
  return ordered
    .map((key) => ({
      key,
      label: key === "unset" ? "Non renseigné" : PAYMENT_METHOD_LABELS[key],
      value: sums.get(key) ?? 0,
    }))
    .filter((entry) => entry.value > 0)
}

function monthKeyFromDate(raw: string): MonthKey | null {
  const key = resolveEventDateKey(raw)
  if (!key) return null
  return `${key.slice(0, 4)}-${key.slice(5, 7)}` as MonthKey
}

function monthLabelFromKey(key: MonthKey) {
  const [year, month] = key.split("-").map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString("fr-FR", {
    month: "short",
    year: "2-digit",
  })
}
