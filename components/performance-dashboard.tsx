"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { BarChart3, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/empty-state"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { EventType } from "@/lib/event-types"
import { parseEventType } from "@/lib/event-types"
import { extractEventYears, pickDefaultSeasonYear } from "@/lib/event-dates"
import type { PaymentMethod } from "@/lib/payment-methods"
import {
  buildAmountsByPaymentStatus,
  buildCollectedByPaymentMethod,
  buildEventsByMonth,
  buildRevenueByEventType,
  buildRevenueByMonth,
  computePerformanceSummary,
  filterRowsByYear,
  type PerformanceWeddingRow,
} from "@/lib/performance-metrics"

type WeddingRow = PerformanceWeddingRow & {
  id: number
  activeAutomationCount?: number
}

const STATUS_PIE_COLORS: Record<"paid" | "pending" | "to_collect", string> = {
  paid: "hsl(142 71% 40%)",
  pending: "hsl(48 96% 50%)",
  to_collect: "hsl(28 92% 52%)",
}

const EVENT_TYPE_COLORS: Record<EventType, string> = {
  wedding: "hsl(350 65% 55%)",
  gite: "hsl(200 80% 48%)",
  other: "hsl(220 10% 46%)",
}

const PAYMENT_METHOD_COLORS = [
  "hsl(217 91% 60%)",
  "hsl(142 71% 40%)",
  "hsl(28 92% 52%)",
  "hsl(280 65% 55%)",
  "hsl(190 70% 42%)",
  "hsl(220 10% 62%)",
]

export function PerformanceDashboard() {
  const [rows, setRows] = useState<WeddingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear())

  const loadWeddings = useCallback(async () => {
    try {
      const response = await fetch("/api/weddings", { credentials: "same-origin" })
      const payload = (await response.json()) as {
        weddings?: Array<
          WeddingRow & {
            eventType?: string
            depositPaymentMethod?: PaymentMethod | ""
            balancePaymentMethod?: PaymentMethod | ""
          }
        >
        error?: string
      }
      if (!response.ok) {
        setRows([])
        toast.error("Données indisponibles", {
          description: payload.error ?? `Erreur ${response.status}`,
        })
        return
      }

      setRows(
        (payload.weddings ?? []).map((row) => ({
          ...row,
          eventType: parseEventType(row.eventType),
        }))
      )
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

  useEffect(() => {
    if (rows.length === 0) return
    const years = extractEventYears(rows)
    setSelectedYear((prev) => (years.includes(prev) ? prev : pickDefaultSeasonYear(years)))
  }, [rows])

  const availableYears = useMemo(() => {
    const current = new Date().getFullYear()
    const merged = new Set([...extractEventYears(rows), current, selectedYear])
    return [...merged].sort((a, b) => b - a)
  }, [rows, selectedYear])

  const seasonRows = useMemo(
    () => filterRowsByYear(rows, selectedYear),
    [rows, selectedYear]
  )

  const summary = useMemo(() => computePerformanceSummary(seasonRows), [seasonRows])
  const revenueByMonth = useMemo(() => buildRevenueByMonth(seasonRows), [seasonRows])
  const eventsByMonth = useMemo(() => buildEventsByMonth(seasonRows), [seasonRows])
  const revenueByType = useMemo(() => buildRevenueByEventType(seasonRows), [seasonRows])
  const amountsByStatus = useMemo(() => buildAmountsByPaymentStatus(seasonRows), [seasonRows])
  const paymentMethods = useMemo(
    () => buildCollectedByPaymentMethod(seasonRows),
    [seasonRows]
  )

  const statusPieData = useMemo(
    () =>
      amountsByStatus.map((entry) => ({
        ...entry,
        fill: STATUS_PIE_COLORS[entry.name],
      })),
    [amountsByStatus]
  )

  const paymentPieData = useMemo(
    () =>
      paymentMethods.map((entry, index) => ({
        name: entry.key,
        label: entry.label,
        value: entry.value,
        fill: PAYMENT_METHOD_COLORS[index % PAYMENT_METHOD_COLORS.length],
      })),
    [paymentMethods]
  )

  const revenueChartConfig = useMemo(
    () =>
      ({
        expected: { label: "Prévu", color: "hsl(217 91% 60%)" },
        collected: { label: "Encaissé", color: "hsl(142 76% 36%)" },
      }) satisfies ChartConfig,
    []
  )

  const eventsChartConfig = useMemo(
    () =>
      ({
        count: { label: "Événements", color: "hsl(217 91% 60%)" },
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

  const typeChartConfig = useMemo(() => {
    const config: ChartConfig = {}
    for (const entry of revenueByType) {
      config[entry.type] = {
        label: entry.label,
        color: EVENT_TYPE_COLORS[entry.type],
      }
    }
    return config
  }, [revenueByType])

  const paymentChartConfig = useMemo(() => {
    const config: ChartConfig = {}
    for (const entry of paymentPieData) {
      config[entry.name] = { label: entry.label, color: entry.fill }
    }
    return config
  }, [paymentPieData])

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
        description="Ajoutez des événements avec montants et statuts pour voir vos indicateurs de saison."
      >
        <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
          <Link href="/evenements/nouveau">Ajouter un événement</Link>
        </Button>
      </EmptyState>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          Saison <span className="font-medium text-gray-800">{selectedYear}</span>
          {" · "}
          {summary.eventCount} événement{summary.eventCount > 1 ? "s" : ""}
        </p>
        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-[140px] bg-white">
            <SelectValue placeholder="Année" />
          </SelectTrigger>
          <SelectContent>
            {availableYears.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <KpiCard title="Chiffre prévu" value={formatEuro(summary.totalExpected)} />
        <KpiCard title="Chiffre encaissé" value={formatEuro(summary.totalCollected)} />
        <KpiCard title="Taux d'encaissement" value={`${summary.collectionRate} %`} />
        <KpiCard title="Reste à encaisser" value={formatEuro(summary.outstanding)} />
        <KpiCard
          title="Soldes en retard"
          value={formatEuro(summary.overdueBalanceAmount)}
          subtext={
            summary.overdueBalanceCount > 0
              ? `${summary.overdueBalanceCount} événement${summary.overdueBalanceCount > 1 ? "s" : ""} passé${summary.overdueBalanceCount > 1 ? "s" : ""}`
              : "Aucun solde en retard"
          }
          highlight={summary.overdueBalanceCount > 0}
        />
        <KpiCard
          title="Événements"
          value={`${summary.eventCount}`}
          subtext={`Sur la saison ${selectedYear}`}
        />
      </div>

      <Card className="bg-white border-gray-100 shadow-sm">
        <CardHeader className="pb-0">
          <CardTitle className="text-base text-gray-900">
            Prévision vs encaissement (par mois)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {revenueByMonth.length === 0 ? (
            <ChartEmpty message="Aucun événement daté pour cette saison." />
          ) : (
            <ChartContainer config={revenueChartConfig} className="h-[300px] w-full">
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
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-base text-gray-900">Volume d&apos;événements</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {eventsByMonth.length === 0 ? (
              <ChartEmpty message="Aucun événement sur cette saison." />
            ) : (
              <ChartContainer config={eventsChartConfig} className="h-[260px] w-full">
                <BarChart data={eventsByMonth} margin={{ left: 8, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-100 shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-base text-gray-900">Chiffre par type</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {revenueByType.length === 0 ? (
              <ChartEmpty message="Aucun montant renseigné." />
            ) : (
              <ChartContainer config={typeChartConfig} className="h-[260px] w-full">
                <BarChart
                  data={revenueByType}
                  layout="vertical"
                  margin={{ left: 8, right: 24, top: 8 }}
                >
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} hide />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    width={96}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => formatEuro(Number(value))}
                      />
                    }
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {revenueByType.map((entry) => (
                      <Cell key={entry.type} fill={EVENT_TYPE_COLORS[entry.type]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-base text-gray-900">
              Acomptes et soldes par statut
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ChartContainer config={statusChartConfig} className="h-[280px] w-full">
              <PieChart>
                <RechartsTooltip
                  content={
                    <ChartTooltipContent
                      nameKey="name"
                      formatter={(value, name) => (
                        <div className="flex w-full min-w-[10rem] justify-between gap-4 tabular-nums">
                          <span className="text-muted-foreground">
                            {statusChartConfig[String(name) as keyof typeof statusChartConfig]?.label ??
                              String(name)}
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
                  data={statusPieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={92}
                  paddingAngle={2}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              </PieChart>
            </ChartContainer>
            <LegendInline config={statusChartConfig} data={statusPieData} />
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-100 shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-base text-gray-900">
              Encaissements par moyen de paiement
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {paymentPieData.length === 0 ? (
              <ChartEmpty message="Aucun paiement encaissé ou moyen renseigné sur la saison." />
            ) : (
              <>
                <ChartContainer config={paymentChartConfig} className="h-[280px] w-full">
                  <PieChart>
                    <RechartsTooltip
                      content={
                        <ChartTooltipContent
                          nameKey="name"
                          formatter={(value, name) => (
                            <div className="flex w-full min-w-[10rem] justify-between gap-4 tabular-nums">
                              <span className="text-muted-foreground">
                                {paymentChartConfig[String(name)]?.label ?? String(name)}
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
                      data={paymentPieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={92}
                      paddingAngle={2}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  </PieChart>
                </ChartContainer>
                <PaymentLegend data={paymentPieData} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function KpiCard({
  title,
  value,
  subtext,
  highlight,
}: {
  title: string
  value: string
  subtext?: string
  highlight?: boolean
}) {
  return (
    <Card className={`bg-white border-gray-100 shadow-sm ${highlight ? "border-amber-200" : ""}`}>
      <CardContent className="p-5">
        <p className="text-xs font-medium text-gray-500">{title}</p>
        <p
          className={`mt-1 text-xl font-semibold tabular-nums ${
            highlight ? "text-amber-800" : "text-gray-900"
          }`}
        >
          {value}
        </p>
        {subtext ? <p className="mt-1 text-xs text-gray-400">{subtext}</p> : null}
      </CardContent>
    </Card>
  )
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-gray-400">
      {message}
    </div>
  )
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
    <div className="flex flex-wrap items-center justify-center gap-4 pt-3 text-xs text-gray-600">
      {items.map((item) => (
        <div key={item.key} className="flex items-center gap-2 tabular-nums">
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{ backgroundColor: item.color }}
          />
          <span>
            {config[item.key]?.label ?? item.key}
            <span className="text-gray-900 font-medium">
              {" "}
              · {formatEuro(amountByKey[item.key] ?? 0)}
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}

function PaymentLegend({
  data,
}: {
  data: Array<{ label: string; value: number; fill: string }>
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 pt-3 text-xs text-gray-600">
      {data.map((item) => (
        <div key={item.label} className="flex items-center gap-2 tabular-nums">
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{ backgroundColor: item.fill }}
          />
          <span>
            {item.label}
            <span className="text-gray-900 font-medium"> · {formatEuro(item.value)}</span>
          </span>
        </div>
      ))}
    </div>
  )
}
