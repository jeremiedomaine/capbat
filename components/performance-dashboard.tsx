"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { BarChart3, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

type PaymentStatus = "pending" | "paid" | "to_collect"

type WeddingRow = {
  id: number
  eventDate: string
  deposit: { amount: string; status: PaymentStatus }
  balance: { amount: string; status: PaymentStatus }
  autopilot: boolean
}

type MonthKey = `${number}-${string}`

/** Couleurs fixes (pas besoin des CSS vars du ChartContainer ; un `fill` sur `<Pie>` les écrase sinon). */
const STATUS_PIE_COLORS: Record<"paid" | "pending" | "to_collect", string> = {
  paid: "hsl(142 71% 40%)",
  pending: "hsl(48 96% 50%)",
  to_collect: "hsl(28 92% 52%)",
}

export function PerformanceDashboard() {
  const [rows, setRows] = useState<WeddingRow[]>([])
  const [loading, setLoading] = useState(true)

  const loadWeddings = useCallback(async () => {
    try {
      const response = await fetch("/api/weddings", { credentials: "same-origin" })
      const payload = (await response.json()) as {
        weddings?: WeddingRow[]
        error?: string
      }
      if (!response.ok) {
        setRows([])
        toast.error("Données indisponibles", {
          description: payload.error ?? `Erreur ${response.status}`,
        })
        return
      }
      setRows(payload.weddings ?? [])
    } catch {
      setRows([])
      toast.error("Réseau", { description: "Impossible de charger les indicateurs." })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadWeddings()
    const handler = () => loadWeddings()
    window.addEventListener("weddings-updated", handler)
    return () => window.removeEventListener("weddings-updated", handler)
  }, [loadWeddings])

  const summary = useMemo(() => {
    const totalExpected =
      rows.reduce((sum, row) => sum + parseEuroAmount(row.deposit.amount), 0) +
      rows.reduce((sum, row) => sum + parseEuroAmount(row.balance.amount), 0)

    const totalCollected =
      rows
        .filter((row) => row.deposit.status === "paid")
        .reduce((sum, row) => sum + parseEuroAmount(row.deposit.amount), 0) +
      rows
        .filter((row) => row.balance.status === "paid")
        .reduce((sum, row) => sum + parseEuroAmount(row.balance.amount), 0)

    const outstanding =
      rows
        .filter((row) => row.deposit.status !== "paid")
        .reduce((sum, row) => sum + parseEuroAmount(row.deposit.amount), 0) +
      rows
        .filter((row) => row.balance.status !== "paid")
        .reduce((sum, row) => sum + parseEuroAmount(row.balance.amount), 0)

    const autopilotOn = rows.filter((row) => row.autopilot).length
    const totalWeddings = rows.length

    return { totalExpected, totalCollected, outstanding, autopilotOn, totalWeddings }
  }, [rows])

  const revenueByMonth = useMemo(() => {
    const map = new Map<MonthKey, { month: string; expected: number; collected: number }>()

    for (const row of rows) {
      const d = new Date(row.eventDate)
      if (Number.isNaN(d.getTime())) continue
      const monthLabel = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` as MonthKey
      const expected = parseEuroAmount(row.deposit.amount) + parseEuroAmount(row.balance.amount)
      const collected =
        (row.deposit.status === "paid" ? parseEuroAmount(row.deposit.amount) : 0) +
        (row.balance.status === "paid" ? parseEuroAmount(row.balance.amount) : 0)

      const previous = map.get(key)
      if (!previous) {
        map.set(key, { month: monthLabel, expected, collected })
      } else {
        previous.expected += expected
        previous.collected += collected
      }
    }

    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => value)
  }, [rows])

  /**
   * Acomptes + soldes : chaque ligne contribue deux montants (dépôt + solde),
   * classés selon le statut de ce paiement (parts du camembert en €).
   */
  const depositAndBalanceAmountsByStatus = useMemo(() => {
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
      { name: "paid", value: sums.paid, fill: STATUS_PIE_COLORS.paid },
      { name: "pending", value: sums.pending, fill: STATUS_PIE_COLORS.pending },
      { name: "to_collect", value: sums.to_collect, fill: STATUS_PIE_COLORS.to_collect },
    ]
  }, [rows])

  const revenueChartConfig = useMemo(
    () =>
      ({
        expected: { label: "Prévu", color: "hsl(217 91% 60%)" }, // blue-500-ish
        collected: { label: "Encaissé", color: "hsl(142 76% 36%)" }, // emerald-600-ish
      }) satisfies ChartConfig,
    []
  )

  const statusChartConfig = useMemo(
    () =>
      ({
        paid: { label: "Payé", color: STATUS_PIE_COLORS.paid },
        pending: { label: "En attente", color: STATUS_PIE_COLORS.pending },
        to_collect: { label: "À percevoir", color: STATUS_PIE_COLORS.to_collect },
      }) satisfies ChartConfig,
    []
  )

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-100 bg-white py-24 text-gray-500 shadow-sm">
        <Loader2 className="h-10 w-10 animate-spin text-gray-400" aria-hidden />
        <p className="text-sm">Chargement des indicateurs…</p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Pas encore de données"
        description="Ajoutez des mariages avec montants et statuts pour voir la prévision, l’encaissement et la répartition des soldes."
      >
        <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
          <Link href="/evenements/nouveau">Ajouter un événement</Link>
        </Button>
      </EmptyState>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <KpiCard title="Chiffre prévu" value={formatEuro(summary.totalExpected)} />
        <KpiCard title="Chiffre encaissé" value={formatEuro(summary.totalCollected)} />
        <KpiCard title="Reste à encaisser" value={formatEuro(summary.outstanding)} />
        <KpiCard title="Relances actives" value={`${summary.autopilotOn}`} />
        <KpiCard title="Événements" value={`${summary.totalWeddings}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2 bg-white border-gray-100 shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-base text-gray-900">
              Prévision vs encaissement (par mois)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ChartContainer config={revenueChartConfig} className="h-[320px] w-full">
              <BarChart data={revenueByMonth} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="expected" fill="var(--color-expected)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="collected" fill="var(--color-collected)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-100 shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-base text-gray-900">
              Acomptes et soldes par statut (montants)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ChartContainer config={statusChartConfig} className="h-[320px] w-full">
              <PieChart>
                <RechartsTooltip
                  content={
                    <ChartTooltipContent
                      nameKey="name"
                      formatter={(value, name) => (
                        <div className="flex w-full min-w-[10rem] justify-between gap-4 tabular-nums">
                          <span className="text-muted-foreground">
                            {statusChartConfig[String(name)]?.label ?? String(name)}
                          </span>
                          <span className="font-medium">
                            {formatEuro(typeof value === "number" ? value : Number(value))}
                          </span>
                        </div>
                      )}
                    />
                  }
                  cursor={false}
                />
                <Pie
                  data={depositAndBalanceAmountsByStatus}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={2}
                  stroke="#ffffff"
                  strokeWidth={2}
                  labelLine={false}
                  label={({ name, percent }) => {
                    const p = typeof percent === "number" ? percent * 100 : 0
                    if (p < 4) return null
                    const label = statusChartConfig[String(name)]?.label ?? String(name)
                    return `${label} (${Math.round(p)}%)`
                  }}
                />
              </PieChart>
            </ChartContainer>
            <div className="pt-3">
              <LegendInline config={statusChartConfig} data={depositAndBalanceAmountsByStatus} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function KpiCard({ title, value }: { title: string; value: string }) {
  return (
    <Card className="bg-white border-gray-100 shadow-sm">
      <CardContent className="p-5">
        <p className="text-xs font-medium text-gray-500">{title}</p>
        <p className="mt-1 text-xl font-semibold text-gray-900 tabular-nums">{value}</p>
      </CardContent>
    </Card>
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

function LegendInline({
  config,
  data,
}: {
  config: ChartConfig
  data: Array<{ name: string; value: number }>
}) {
  const items = [
    { key: "paid" as const, color: STATUS_PIE_COLORS.paid },
    { key: "pending" as const, color: STATUS_PIE_COLORS.pending },
    { key: "to_collect" as const, color: STATUS_PIE_COLORS.to_collect },
  ] as const

  const amountByKey = Object.fromEntries(data.map((d) => [d.name, d.value])) as Record<
    string,
    number
  >

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-600">
      {items.map((item) => (
        <div key={item.key} className="flex items-center gap-2 tabular-nums">
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{ backgroundColor: item.color }}
          />
          <span>
            {config[item.key]?.label ?? item.key}
            <span className="text-gray-900 font-medium"> · {formatEuro(amountByKey[item.key] ?? 0)}</span>
          </span>
        </div>
      ))}
    </div>
  )
}

