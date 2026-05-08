"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { CalendarDays, Banknote, BellRing } from "lucide-react"

type PaymentStatus = "pending" | "paid" | "to_collect"
type WeddingRow = {
  id: number
  eventDate: string
  deposit: { amount: string; status: PaymentStatus }
  balance: { amount: string; status: PaymentStatus }
  autopilot: boolean
}

export function KpiCards() {
  const [rows, setRows] = useState<WeddingRow[]>([])

  const loadWeddings = useCallback(async () => {
    try {
      const response = await fetch("/api/weddings", { credentials: "same-origin" })
      const payload = (await response.json()) as { weddings?: WeddingRow[] }
      if (!response.ok) {
        setRows([])
        return
      }
      setRows(payload.weddings ?? [])
    } catch {
      setRows([])
    }
  }, [])

  useEffect(() => {
    loadWeddings()
    const handler = () => {
      loadWeddings()
    }
    window.addEventListener("weddings-updated", handler)
    return () => window.removeEventListener("weddings-updated", handler)
  }, [loadWeddings])

  const kpis = useMemo(() => {
    const todayKey = getTodayCalendarIsoKey()

    const futureWeddings = rows.filter((row) => {
      const key = resolveEventDateKey(row.eventDate)
      return key !== null && key > todayKey
    })

    const paidDepositAndBalanceTotal = futureWeddings.reduce((sum, row) => {
      let partial = sum
      if (row.deposit.status === "paid") {
        partial += parseEuroAmount(row.deposit.amount)
      }
      if (row.balance.status === "paid") {
        partial += parseEuroAmount(row.balance.amount)
      }
      return partial
    }, 0)

    const now = new Date()
    const targetMonth = now.getMonth()
    const targetYear = now.getFullYear()
    const pendingBalanceThisMonth = rows.filter((row) => {
      const d = parseEventDate(row.eventDate)
      return (
        !Number.isNaN(d.getTime()) &&
        d.getMonth() === targetMonth &&
        d.getFullYear() === targetYear &&
        row.balance.status !== "paid"
      )
    })
    const pendingBalanceTotal = pendingBalanceThisMonth.reduce(
      (sum, row) => sum + parseEuroAmount(row.balance.amount),
      0
    )

    const activeRelances = rows.filter(
      (row) => row.autopilot && row.balance.status === "pending"
    ).length

    return [
      {
        title: "Mariages prévus",
        value: `${futureWeddings.length} mariages`,
        subtext: `${formatEuro(paidDepositAndBalanceTotal)} encaissés (acomptes + soldes payés)`,
        icon: CalendarDays,
        iconBg: "bg-violet-50",
        iconColor: "text-violet-600",
        trend: "Dates strictement après aujourd’hui",
      },
      {
        title: "Soldes à encaisser ce mois-ci",
        value: `${pendingBalanceThisMonth.length} mariages`,
        subtext: `${formatEuro(pendingBalanceTotal)} en attente`,
        icon: Banknote,
        iconBg: "bg-emerald-50",
        iconColor: "text-emerald-500",
        trend: "Calculé selon les statuts",
      },
      {
        title: "Relances J-30 actives",
        value: `${activeRelances} automatisations`,
        subtext: "en cours d'exécution",
        icon: BellRing,
        iconBg: "bg-blue-50",
        iconColor: "text-blue-600",
        trend: "Mise à jour automatique",
      },
    ]
  }, [rows])

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {kpis.map((kpi) => {
        const Icon = kpi.icon
        return (
          <Card
            key={kpi.title}
            className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <p className="text-sm font-medium text-gray-500 leading-relaxed text-pretty">
                  {kpi.title}
                </p>
                <div
                  className={`w-9 h-9 rounded-lg ${kpi.iconBg} flex items-center justify-center shrink-0 ml-3`}
                >
                  <Icon className={`w-4 h-4 ${kpi.iconColor}`} />
                </div>
              </div>
              <p className="text-2xl font-semibold text-gray-900 tracking-tight">{kpi.value}</p>
              <p className="mt-1 text-sm text-gray-400">{kpi.subtext}</p>
              <div className="mt-4 pt-4 border-t border-gray-50">
                <p className="text-xs text-gray-400">{kpi.trend}</p>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function parseEuroAmount(value: string) {
  const cleaned = value.replace(/[^\d,.-]/g, "").replace(",", ".")
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatEuro(value: number) {
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(value))} €`
}

function parseEventDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number)
    return new Date(year, month - 1, day)
  }
  return new Date(value)
}

/** YYYY-MM-DD au calendrier local (aligné filtre J-N / tableau). */
function getTodayCalendarIsoKey() {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function resolveEventDateKey(raw: string): string | null {
  const trimmed = raw.trim()
  const head = trimmed.slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head
  const d = parseEventDate(trimmed)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
