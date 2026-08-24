"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Landmark, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/empty-state"
import { EVENT_TYPE_LABELS, getEventTypeBadgeClass, type EventType } from "@/lib/event-types"
import { extractEventYears, formatEventDateFr, pickDefaultSeasonYear } from "@/lib/event-dates"
import { formatEuroDetailed } from "@/lib/invoice-utils"
import {
  buildTouristTaxMonthGroups,
  isTouristTaxEventType,
  parseTouristTaxAmount,
  TOURIST_TAX_STATUS_LABELS,
  type TouristTaxEventRow,
  type TouristTaxStatus,
} from "@/lib/tourist-tax"

type WeddingPayload = TouristTaxEventRow & {
  eventType: EventType
}

function statusLabel(status: TouristTaxStatus | "") {
  if (status === "paid" || status === "unpaid") return TOURIST_TAX_STATUS_LABELS[status]
  return "Non suivi"
}

export function TouristTaxReport() {
  const [rows, setRows] = useState<WeddingPayload[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear())

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const response = await fetch("/api/weddings")
        const payload = (await response.json()) as { weddings?: WeddingPayload[]; error?: string }
        if (!response.ok) throw new Error(payload.error ?? "Chargement impossible.")
        if (!cancelled) setRows(payload.weddings ?? [])
      } catch (e) {
        if (!cancelled) {
          toast.error("Taxe de séjour", {
            description: e instanceof Error ? e.message : "Erreur de chargement.",
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const eligible = useMemo(
    () => rows.filter((row) => isTouristTaxEventType(row.eventType)),
    [rows]
  )

  const years = useMemo(() => extractEventYears(eligible), [eligible])

  useEffect(() => {
    if (!years.length) return
    setSelectedYear((current) =>
      years.includes(current) ? current : pickDefaultSeasonYear(years)
    )
  }, [years])

  const groups = useMemo(
    () => buildTouristTaxMonthGroups(eligible, selectedYear),
    [eligible, selectedYear]
  )

  const yearTotals = useMemo(() => {
    return groups.reduce(
      (acc, group) => ({
        events: acc.events + group.eventCount,
        total: acc.total + group.totalAmount,
        unpaid: acc.unpaid + group.unpaidAmount,
        untracked: acc.untracked + group.untrackedCount,
      }),
      { events: 0, total: 0, unpaid: 0, untracked: 0 }
    )
  }, [groups])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-100 bg-white py-24 text-gray-500 shadow-sm">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" aria-hidden />
        <p className="text-sm">Chargement de la taxe de séjour…</p>
      </div>
    )
  }

  if (!eligible.length) {
    return (
      <EmptyState
        icon={Landmark}
        title="Aucun mariage ni gîte"
        description="La taxe de séjour se déclare sur les mariages et les séjours gîte."
      />
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          Regroupement par mois de l&apos;événement, pour la déclaration à l&apos;agglo.
        </p>
        <Select
          value={String(selectedYear)}
          onValueChange={(value) => setSelectedYear(Number.parseInt(value, 10))}
        >
          <SelectTrigger className="w-[140px] bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Événements</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-gray-900">
            {yearTotals.events}
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total à déclarer</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-gray-900">
            {formatEuroDetailed(yearTotals.total)}
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Reste à verser</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-gray-900">
            {formatEuroDetailed(yearTotals.unpaid)}
          </CardContent>
        </Card>
      </div>

      {yearTotals.untracked > 0 ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          {yearTotals.untracked} événement{yearTotals.untracked > 1 ? "s" : ""} sans suivi de
          taxe — à compléter sur la fiche.
        </p>
      ) : null}

      {groups.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title={`Aucun événement en ${selectedYear}`}
          description="Changez d’année, ou renseignez des mariages et gîtes sur cette saison."
        />
      ) : (
        groups.map((group) => (
          <Card key={group.monthKey} className="bg-white border-gray-100 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <CardTitle className="text-base text-gray-900">{group.monthLabel}</CardTitle>
                <p className="text-sm text-gray-600">
                  {formatEuroDetailed(group.totalAmount)} · {group.eventCount} événement
                  {group.eventCount > 1 ? "s" : ""}
                </p>
              </div>
              <p className="text-xs text-gray-500">
                {group.paidCount} versée{group.paidCount > 1 ? "s" : ""} · {group.unpaidCount}{" "}
                non versée{group.unpaidCount > 1 ? "s" : ""}
                {group.untrackedCount
                  ? ` · ${group.untrackedCount} non suivi${group.untrackedCount > 1 ? "s" : ""}`
                  : ""}
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {group.events.map((event) => (
                <Link
                  key={event.id}
                  href={`/evenements/${event.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={getEventTypeBadgeClass(event.eventType)}
                      >
                        {EVENT_TYPE_LABELS[event.eventType]}
                      </Badge>
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {event.eventName || event.couple}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{formatEventDateFr(event.eventDate)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-gray-900">
                      {formatEuroDetailed(parseTouristTaxAmount(event.touristTaxAmount))}
                    </p>
                    <p
                      className={
                        event.touristTaxStatus === "paid"
                          ? "text-xs text-emerald-700"
                          : event.touristTaxStatus === "unpaid"
                            ? "text-xs text-amber-700"
                            : "text-xs text-gray-400"
                      }
                    >
                      {statusLabel(event.touristTaxStatus)}
                    </p>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
