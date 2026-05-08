"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

export function PerformanceDashboard() {
  const [rows, setRows] = useState<WeddingRow[]>([])

  const loadWeddings = useCallback(async () => {
    const response = await fetch("/api/weddings")
    const payload = (await response.json()) as { weddings: WeddingRow[] }
    setRows(payload.weddings ?? [])
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

  const balanceStatuses = useMemo(() => {
    const counts: Record<PaymentStatus, number> = {
      pending: 0,
      paid: 0,
      to_collect: 0,
    }
    for (const row of rows) counts[row.balance.status] += 1
    return [
      { name: "paid", value: counts.paid },
      { name: "pending", value: counts.pending },
      { name: "to_collect", value: counts.to_collect },
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
        paid: { label: "Payé", color: "hsl(142 76% 36%)" },
        pending: { label: "En attente", color: "hsl(45 93% 47%)" },
        to_collect: { label: "À encaisser", color: "hsl(217 91% 60%)" },
      }) satisfies ChartConfig,
    []
  )

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
              Statut des soldes
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ChartContainer config={statusChartConfig} className="h-[320px] w-full">
              <ResponsiveContainer>
                <PieChart>
                  <RechartsTooltip
                    content={<ChartTooltipContent nameKey="name" />}
                    cursor={false}
                  />
                  <Pie
                    data={balanceStatuses}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={95}
                    stroke="transparent"
                    fill="var(--color-paid)"
                  >
                    {balanceStatuses.map((entry) => (
                      <CellByName key={entry.name} name={entry.name} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
            <div className="pt-3">
              <LegendInline config={statusChartConfig} />
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

function CellByName({ name }: { name: string }) {
  const fill =
    name === "paid"
      ? "var(--color-paid)"
      : name === "pending"
        ? "var(--color-pending)"
        : "var(--color-to_collect)"
  return <Cell fill={fill} />
}

function LegendInline({ config }: { config: ChartConfig }) {
  const items = [
    { key: "paid", var: "var(--color-paid)" },
    { key: "pending", var: "var(--color-pending)" },
    { key: "to_collect", var: "var(--color-to_collect)" },
  ] as const

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-600">
      {items.map((item) => (
        <div key={item.key} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-sm"
            style={{ backgroundColor: item.var }}
          />
          <span>{config[item.key]?.label ?? item.key}</span>
        </div>
      ))}
    </div>
  )
}

