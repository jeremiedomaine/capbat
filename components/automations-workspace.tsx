"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Mail, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DEFAULT_AUTOMATION_MESSAGE,
  DEFAULT_AUTOMATION_SUBJECT,
  FIXED_AUTOMATION_SEND_TIME,
  MAX_AUTOMATIONS,
} from "@/lib/automation-defaults"
import { formatDayOffset, dayOffsetSectionLabel } from "@/lib/automation-format"
import {
  AUTOMATION_PREVIEW_DAYS_AHEAD,
  AUTOMATION_PREVIEW_SAMPLE_WEDDING,
} from "@/lib/automation-preview-sample"
import { EVENT_TYPE_LABELS, type EventType } from "@/lib/event-types"
import { buildAutomationVariableMap, renderTemplate } from "@/lib/email-template"
import { isValidEmail } from "@/lib/form-validation"
import { getStoredContactEmail, PROFILE_EVENTS } from "@/lib/profile-local-storage"
import { cn } from "@/lib/utils"

const VARIABLES = [
  "{{prenom}}",
  "{{date_mariage}}",
  "{{solde_restant}}",
  "{{couple}}",
  "{{contact}}",
  "{{acompte}}",
  "{{telephone}}",
  "{{j_moins}}",
  "{{j_plus}}",
] as const

type Automation = {
  id: string
  name: string
  dayOffset: number
  subjectTemplate: string
  messageTemplate: string
  eventTypes: EventType[]
  onlyIfBalancePending: boolean
  sortOrder: number
}

const EVENT_TYPE_OPTIONS: EventType[] = ["wedding", "gite", "other"]

function emptyDraft(): Omit<Automation, "id" | "sortOrder"> {
  return {
    name: "Nouvelle automatisation",
    dayOffset: -7,
    subjectTemplate: DEFAULT_AUTOMATION_SUBJECT,
    messageTemplate: DEFAULT_AUTOMATION_MESSAGE,
    eventTypes: ["wedding"],
    onlyIfBalancePending: false,
  }
}

export function AutomationsWorkspace() {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Omit<Automation, "id" | "sortOrder"> & { id?: string }>(
    emptyDraft()
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Automation | null>(null)
  const [testRecipientEmail, setTestRecipientEmail] = useState("")
  const [isNew, setIsNew] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const messageRef = useRef<HTMLTextAreaElement | null>(null)

  const applySelection = useCallback((item: Automation) => {
    setSelectedId(item.id)
    setDraft({
      name: item.name,
      dayOffset: item.dayOffset,
      subjectTemplate: item.subjectTemplate,
      messageTemplate: item.messageTemplate,
      eventTypes: item.eventTypes,
      onlyIfBalancePending: item.onlyIfBalancePending,
    })
    setIsNew(false)
    setRenamingId(null)
  }, [])

  const load = useCallback(
    async (keepId?: string | null) => {
      setLoading(true)
      try {
        const res = await fetch("/api/automations")
        const payload = (await res.json()) as { automations?: Automation[]; error?: string }
        if (!res.ok) throw new Error(payload.error ?? "Chargement impossible.")
        const list = payload.automations ?? []
        setAutomations(list)

        const targetId = keepId ?? selectedId
        const current = targetId ? list.find((a) => a.id === targetId) : null
        if (current) {
          applySelection(current)
        } else if (list.length > 0 && !isNew) {
          applySelection(list[0]!)
        } else if (!list.length) {
          setSelectedId(null)
          setDraft(emptyDraft())
        }
      } catch (e) {
        toast.error("Automatisations", {
          description: e instanceof Error ? e.message : "Erreur de chargement.",
        })
      } finally {
        setLoading(false)
      }
    },
    [applySelection, isNew, selectedId]
  )

  useEffect(() => {
    void load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const sync = () => setTestRecipientEmail(getStoredContactEmail()?.trim() ?? "")
    sync()
    window.addEventListener(PROFILE_EVENTS.contactEmail, sync)
    return () => window.removeEventListener(PROFILE_EVENTS.contactEmail, sync)
  }, [])

  const previewVars = useMemo(() => {
    const daysAhead = draft.dayOffset < 0 ? Math.abs(draft.dayOffset) : undefined
    const daysAfter = draft.dayOffset > 0 ? draft.dayOffset : undefined
    return buildAutomationVariableMap(
      AUTOMATION_PREVIEW_SAMPLE_WEDDING,
      daysAhead ?? AUTOMATION_PREVIEW_DAYS_AHEAD,
      daysAfter
    )
  }, [draft.dayOffset])

  const previewSubject = useMemo(
    () => renderTemplate(draft.subjectTemplate, previewVars),
    [draft.subjectTemplate, previewVars]
  )
  const previewMessage = useMemo(
    () => renderTemplate(draft.messageTemplate, previewVars),
    [draft.messageTemplate, previewVars]
  )

  function startNew() {
    if (automations.length >= MAX_AUTOMATIONS) {
      toast.error(`Maximum ${MAX_AUTOMATIONS} automatisations.`)
      return
    }
    setSelectedId(null)
    setDraft(emptyDraft())
    setIsNew(true)
    setRenamingId(null)
  }

  function insertVariable(token: string) {
    const el = messageRef.current
    if (!el) {
      setDraft((d) => ({ ...d, messageTemplate: `${d.messageTemplate}${token}` }))
      return
    }
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? start
    const next = el.value.slice(0, start) + token + el.value.slice(end)
    setDraft((d) => ({ ...d, messageTemplate: next }))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    })
  }

  function toggleEventType(type: EventType) {
    setDraft((d) => {
      const has = d.eventTypes.includes(type)
      const eventTypes = has ? d.eventTypes.filter((t) => t !== type) : [...d.eventTypes, type]
      return { ...d, eventTypes }
    })
  }

  async function handleSave() {
    if (!draft.name.trim()) {
      toast.error("Indiquez un nom.")
      return
    }
    if (!draft.eventTypes.length) {
      toast.error("Sélectionnez au moins un type d'événement.")
      return
    }
    if (draft.dayOffset === 0) {
      toast.error("Le délai ne peut pas être J0.")
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: draft.name.trim(),
        dayOffset: draft.dayOffset,
        subjectTemplate: draft.subjectTemplate,
        messageTemplate: draft.messageTemplate,
        eventTypes: draft.eventTypes,
        onlyIfBalancePending: draft.onlyIfBalancePending,
      }

      const res = await fetch(isNew ? "/api/automations" : `/api/automations/${selectedId}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as { automation?: Automation; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Enregistrement impossible.")

      toast.success(isNew ? "Automatisation créée" : "Modifications enregistrées")
      const newId = data.automation?.id ?? selectedId
      setIsNew(false)
      await load(newId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur")
    } finally {
      setSaving(false)
    }
  }

  async function renameAutomation(id: string, name: string) {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error("Le nom ne peut pas être vide.")
      return
    }
    try {
      const res = await fetch(`/api/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = (await res.json()) as { automation?: Automation; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Renommage impossible.")
      toast.success("Nom mis à jour")
      setRenamingId(null)
      if (selectedId === id && data.automation) {
        setDraft((d) => ({ ...d, name: trimmed }))
      }
      await load(id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur")
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const deletedId = deleteTarget.id
    try {
      const res = await fetch(`/api/automations/${deletedId}`, { method: "DELETE" })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Suppression impossible.")
      toast.success("Automatisation supprimée")
      setDeleteTarget(null)
      if (selectedId === deletedId) {
        setSelectedId(null)
        setIsNew(false)
        setDraft(emptyDraft())
      }
      await load(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur")
    }
  }

  async function handleTestEmail() {
    const to = testRecipientEmail.trim()
    if (!isValidEmail(to)) {
      toast.error("E-mail de test invalide", {
        description: "Renseignez un e-mail dans Paramètres.",
      })
      return
    }
    setSendingTest(true)
    try {
      const daysAhead = draft.dayOffset < 0 ? Math.abs(draft.dayOffset) : undefined
      const daysAfter = draft.dayOffset > 0 ? draft.dayOffset : undefined
      const res = await fetch("/api/automations/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subjectTemplate: draft.subjectTemplate,
          messageTemplate: draft.messageTemplate,
          daysAhead,
          daysAfter,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Envoi impossible.")
      toast.success("E-mail de test envoyé", { description: to })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur Resend")
    } finally {
      setSendingTest(false)
    }
  }

  const grouped = useMemo(() => {
    const before = automations.filter((a) => a.dayOffset < 0)
    const after = automations.filter((a) => a.dayOffset > 0)
    return { before, after }
  }, [automations])

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">Automatisations</h1>
        <p className="text-sm text-gray-500">
          Créez et modifiez vos modèles ici (nom, délai, message). Activez-les ensuite sur chaque
          fiche événement. Envoi automatique à {FIXED_AUTOMATION_SEND_TIME} (Paris).
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,320px)_1fr] gap-6">
        <Card className="bg-white border-gray-100 shadow-sm h-fit">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Bibliothèque</CardTitle>
              <Button type="button" size="sm" variant="outline" onClick={startNew}>
                <Plus className="h-4 w-4 mr-1" />
                Nouvelle
              </Button>
            </div>
            <CardDescription>
              {automations.length}/{MAX_AUTOMATIONS} · clic pour éditer, crayon pour renommer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
              </p>
            ) : automations.length === 0 ? (
              <p className="text-sm text-gray-500">Aucune automatisation. Créez la première.</p>
            ) : (
              <>
                {grouped.before.length > 0 ? (
                  <AutomationListGroup
                    title="Avant l'événement"
                    items={grouped.before}
                    selectedId={selectedId}
                    renamingId={renamingId}
                    renameValue={renameValue}
                    onSelect={applySelection}
                    onStartRename={(item) => {
                      setRenamingId(item.id)
                      setRenameValue(item.name)
                    }}
                    onRenameValueChange={setRenameValue}
                    onCommitRename={(id) => void renameAutomation(id, renameValue)}
                    onCancelRename={() => setRenamingId(null)}
                    onDelete={setDeleteTarget}
                  />
                ) : null}
                {grouped.after.length > 0 ? (
                  <AutomationListGroup
                    title="Après l'événement"
                    items={grouped.after}
                    selectedId={selectedId}
                    renamingId={renamingId}
                    renameValue={renameValue}
                    onSelect={applySelection}
                    onStartRename={(item) => {
                      setRenamingId(item.id)
                      setRenameValue(item.name)
                    }}
                    onRenameValueChange={setRenameValue}
                    onCommitRename={(id) => void renameAutomation(id, renameValue)}
                    onCancelRename={() => setRenamingId(null)}
                    onDelete={setDeleteTarget}
                  />
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">
              {isNew ? "Nouvelle automatisation" : draft.name || "Édition"}
            </CardTitle>
            <CardDescription>
              {dayOffsetSectionLabel(draft.dayOffset)} · {formatDayOffset(draft.dayOffset)}
              {!isNew ? " · modifiez puis enregistrez" : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom affiché</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Ex: Relance solde"
                />
              </div>
              <div className="space-y-2">
                <Label>Délai (jours)</Label>
                <Input
                  type="number"
                  min={-365}
                  max={365}
                  value={draft.dayOffset}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, dayOffset: Number.parseInt(e.target.value, 10) || 0 }))
                  }
                />
                <p className="text-xs text-gray-500">
                  Négatif = avant · positif = après ({formatDayOffset(draft.dayOffset)})
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Types d&apos;événements concernés</Label>
              <div className="flex flex-wrap gap-3">
                {EVENT_TYPE_OPTIONS.map((type) => (
                  <label key={type} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={draft.eventTypes.includes(type)}
                      onCheckedChange={() => toggleEventType(type)}
                    />
                    {EVENT_TYPE_LABELS[type]}
                  </label>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={draft.onlyIfBalancePending}
                onCheckedChange={(v) =>
                  setDraft((d) => ({ ...d, onlyIfBalancePending: v === true }))
                }
              />
              Uniquement si le solde est encore en attente
            </label>

            <div className="space-y-2">
              <Label>Objet de l&apos;e-mail</Label>
              <Input
                value={draft.subjectTemplate}
                onChange={(e) => setDraft((d) => ({ ...d, subjectTemplate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Message</Label>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLES.map((v) => (
                  <Button
                    key={v}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs font-mono"
                    onClick={() => insertVariable(v)}
                  >
                    {v}
                  </Button>
                ))}
              </div>
              <Textarea
                ref={messageRef}
                rows={8}
                value={draft.messageTemplate}
                onChange={(e) => setDraft((d) => ({ ...d, messageTemplate: e.target.value }))}
              />
            </div>

            <div className="rounded-lg border border-gray-100 bg-gray-50/80 p-4 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Aperçu</p>
              <p className="text-sm font-medium text-gray-900">{previewSubject}</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{previewMessage}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={handleSave} disabled={saving || (!isNew && !selectedId)}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement…
                  </>
                ) : isNew ? (
                  "Créer"
                ) : (
                  "Enregistrer les modifications"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleTestEmail}
                disabled={sendingTest || isNew}
              >
                {sendingTest ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                Envoyer un test
              </Button>
              {!isNew && selectedId ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => {
                    const item = automations.find((a) => a.id === selectedId)
                    if (item) setDeleteTarget(item)
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette automatisation ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {deleteTarget?.name} » sera définitivement retirée. Les relances déjà activées sur
              des événements seront aussi retirées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function AutomationListGroup({
  title,
  items,
  selectedId,
  renamingId,
  renameValue,
  onSelect,
  onStartRename,
  onRenameValueChange,
  onCommitRename,
  onCancelRename,
  onDelete,
}: {
  title: string
  items: Automation[]
  selectedId: string | null
  renamingId: string | null
  renameValue: string
  onSelect: (item: Automation) => void
  onStartRename: (item: Automation) => void
  onRenameValueChange: (value: string) => void
  onCommitRename: (id: string) => void
  onCancelRename: () => void
  onDelete: (item: Automation) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{title}</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id}>
            <div
              className={cn(
                "rounded-lg border px-2 py-2 transition-colors",
                selectedId === item.id
                  ? "border-gray-300 bg-gray-50"
                  : "border-transparent hover:bg-gray-50"
              )}
            >
              {renamingId === item.id ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={renameValue}
                    onChange={(e) => onRenameValueChange(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onCommitRename(item.id)
                      if (e.key === "Escape") onCancelRename()
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2"
                    onClick={() => onCommitRename(item.id)}
                  >
                    OK
                  </Button>
                </div>
              ) : (
                <div className="flex items-start gap-1">
                  <button
                    type="button"
                    onClick={() => onSelect(item)}
                    className="flex-1 min-w-0 text-left px-1 py-0.5"
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDayOffset(item.dayOffset)} ·{" "}
                      {item.eventTypes.map((t) => EVENT_TYPE_LABELS[t]).join(", ")}
                    </p>
                  </button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-gray-500"
                    aria-label={`Renommer ${item.name}`}
                    onClick={() => onStartRename(item)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-gray-500 hover:text-red-600"
                    aria-label={`Supprimer ${item.name}`}
                    onClick={() => onDelete(item)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
