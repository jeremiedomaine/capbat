"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { FIXED_AUTOMATION_SEND_TIME } from "@/lib/automation-defaults"
import { formatDayOffset } from "@/lib/automation-format"
import type { EventType } from "@/lib/event-types"

type AutomationRow = {
  automationId: string
  name: string
  dayOffset: number
  enabled: boolean
  sentAt: string | null
  onlyIfBalancePending: boolean
}

export function EventAutomationsCard({
  eventId,
  eventType,
}: {
  eventId: number
  eventType: EventType
}) {
  const [rows, setRows] = useState<AutomationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/weddings/${eventId}/automations`)
      const payload = (await res.json()) as { automations?: AutomationRow[]; error?: string }
      if (!res.ok) throw new Error(payload.error ?? "Chargement impossible.")
      setRows(payload.automations ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur")
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void load()
  }, [load])

  const activeCount = rows.filter((r) => r.enabled).length

  const grouped = useMemo(() => {
    const before = rows.filter((r) => r.dayOffset < 0)
    const after = rows.filter((r) => r.dayOffset > 0)
    return { before, after }
  }, [rows])

  async function toggle(automationId: string, enabled: boolean) {
    setPendingId(automationId)
    try {
      const res = await fetch(`/api/weddings/${eventId}/automations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ automationId, enabled, eventType }),
      })
      const payload = (await res.json()) as { automations?: AutomationRow[]; error?: string }
      if (!res.ok) throw new Error(payload.error ?? "Mise à jour impossible.")
      setRows(payload.automations ?? [])
      window.dispatchEvent(new Event("weddings-updated"))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur")
    } finally {
      setPendingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Relances automatiques</CardTitle>
        <CardDescription>
          {activeCount} relance{activeCount !== 1 ? "s" : ""} active{activeCount !== 1 ? "s" : ""}{" "}
          · envoi à {FIXED_AUTOMATION_SEND_TIME} (Paris).{" "}
          <Link href="/automatisations" className="text-blue-600 hover:underline">
            Gérer les modèles
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aucune automatisation compatible.{" "}
            <Link href="/automatisations" className="text-blue-600 hover:underline">
              Créez-en une
            </Link>
            .
          </p>
        ) : (
          <>
            {grouped.before.length > 0 ? (
              <AutomationToggleGroup
                title="Avant l'événement"
                rows={grouped.before}
                pendingId={pendingId}
                onToggle={toggle}
              />
            ) : null}
            {grouped.after.length > 0 ? (
              <AutomationToggleGroup
                title="Après l'événement"
                rows={grouped.after}
                pendingId={pendingId}
                onToggle={toggle}
              />
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function AutomationToggleGroup({
  title,
  rows,
  pendingId,
  onToggle,
}: {
  title: string
  rows: AutomationRow[]
  pendingId: string | null
  onToggle: (id: string, enabled: boolean) => void
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{title}</p>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.automationId}
            className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{row.name}</p>
              <p className="text-xs text-gray-500">
                {formatDayOffset(row.dayOffset)}
                {row.onlyIfBalancePending ? " · si solde en attente" : ""}
              </p>
              {row.sentAt ? (
                <Badge variant="outline" className="mt-1 text-xs border-emerald-200 text-emerald-700">
                  Remis au serveur le {row.sentAt}
                </Badge>
              ) : null}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {pendingId === row.automationId ? (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              ) : null}
              <Switch
                checked={row.enabled}
                disabled={pendingId === row.automationId || Boolean(row.sentAt)}
                onCheckedChange={(checked) => onToggle(row.automationId, checked)}
                aria-label={`${row.name} pour cet événement`}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
