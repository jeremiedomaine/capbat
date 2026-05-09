"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DEFAULT_AUTOMATION_MESSAGE,
  DEFAULT_AUTOMATION_SUBJECT,
  FIXED_AUTOMATION_SEND_TIME,
} from "@/lib/automation-defaults"
import { buildAutomationVariableMap, renderTemplate } from "@/lib/email-template"
import type { Wedding } from "@/lib/weddings-store"

const previewDaysAhead = 30

const previewWedding: Wedding = {
  id: 0,
  couple: "Camille & Jordan",
  contactName: "Camille Dupont",
  email: "client@exemple.fr",
  phone: "06 12 34 56 78",
  eventDate: "2026-09-15",
  deposit: { amount: "500 €", status: "paid" },
  balance: { amount: "2 450 €", status: "pending" },
  autopilot: true,
  lastActivity: "",
}

const variableButtons = [
  "{{prenom}}",
  "{{date_mariage}}",
  "{{solde_restant}}",
  "{{couple}}",
  "{{contact}}",
  "{{acompte}}",
  "{{telephone}}",
  "{{j_moins}}",
] as const

export default function AutomatisationsPage() {
  const [subject, setSubject] = useState(DEFAULT_AUTOMATION_SUBJECT)
  const [message, setMessage] = useState(DEFAULT_AUTOMATION_MESSAGE)
  const [saved, setSaved] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [saveError, setSaveError] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const messageRef = useRef<HTMLTextAreaElement | null>(null)
  const subjectRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadError("")
      try {
        const res = await fetch("/api/automations/settings")
        const payload = (await res.json()) as {
          settings?: { messageTemplate: string; subjectTemplate: string }
          error?: string
        }
        if (!res.ok) {
          throw new Error(payload.error ?? "Impossible de charger les automatisations.")
        }
        if (cancelled || !payload.settings) return
        setMessage(payload.settings.messageTemplate)
        setSubject(payload.settings.subjectTemplate)
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Erreur de chargement.")
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

  const previewVars = useMemo(
    () => buildAutomationVariableMap(previewWedding, previewDaysAhead),
    []
  )

  const previewSubject = useMemo(
    () => renderTemplate(subject, previewVars),
    [subject, previewVars]
  )
  const previewBody = useMemo(
    () => renderTemplate(message, previewVars),
    [message, previewVars]
  )

  const handleSave = async () => {
    setSaveError("")
    setSaving(true)
    try {
      const response = await fetch("/api/automations/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageTemplate: message,
          subjectTemplate: subject,
        }),
      })
      const payload = (await response.json()) as {
        settings?: { messageTemplate: string; subjectTemplate: string }
        error?: string
      }
      if (!response.ok) {
        throw new Error(payload.error ?? "Enregistrement impossible.")
      }
      if (payload.settings) {
        setMessage(payload.settings.messageTemplate)
        setSubject(payload.settings.subjectTemplate)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Erreur d'enregistrement.")
    } finally {
      setSaving(false)
    }
  }

  const insertVariableAtCursor = (
    variable: string,
    field: "message" | "subject"
  ) => {
    if (field === "subject") {
      const input = subjectRef.current
      const text = subject
      if (!input) {
        setSubject((prev) => `${prev}${variable}`)
        return
      }
      const start = input.selectionStart ?? text.length
      const end = input.selectionEnd ?? text.length
      const next = `${text.slice(0, start)}${variable}${text.slice(end)}`
      setSubject(next)
      requestAnimationFrame(() => {
        input.focus()
        const cursor = start + variable.length
        input.setSelectionRange(cursor, cursor)
      })
      return
    }

    const textarea = messageRef.current
    if (!textarea) {
      setMessage((prev) => `${prev}${variable}`)
      return
    }

    const start = textarea.selectionStart ?? message.length
    const end = textarea.selectionEnd ?? message.length
    const nextMessage = `${message.slice(0, start)}${variable}${message.slice(end)}`
    setMessage(nextMessage)

    requestAnimationFrame(() => {
      textarea.focus()
      const nextCursor = start + variable.length
      textarea.setSelectionRange(nextCursor, nextCursor)
    })
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-5xl mx-auto space-y-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold text-gray-900">Automatisations</h1>
            <p className="text-sm text-gray-500">
              Personnalisez l&apos;e-mail de relance envoye chaque jour a{" "}
              {FIXED_AUTOMATION_SEND_TIME.replace(":", "h")}
              (heure de Paris, non modifiable). Une seule serie d&apos;envois par jour.
            </p>
          </header>

          {loadError ? (
            <p className="text-sm text-red-600 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
              {loadError}
            </p>
          ) : null}

          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle>Message automatique</CardTitle>
              <CardDescription>
                Variables : prénom du contact, date du mariage, solde, couple, nom du contact,
                acompte, téléphone, délai J-N (ex. 30).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-gray-500 w-full mb-1">Objet</span>
                {variableButtons.map((v) => (
                  <button key={`sub-${v}`} type="button" onClick={() => insertVariableAtCursor(v, "subject")}>
                    <Badge variant="outline" className="cursor-pointer hover:bg-gray-100">
                      {v}
                    </Badge>
                  </button>
                ))}
              </div>
              <Input
                ref={subjectRef}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={loading}
                placeholder={DEFAULT_AUTOMATION_SUBJECT}
                className="font-medium"
              />

              <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-5">
                <span className="text-xs text-gray-500 w-full mb-1">Corps du message</span>
                {variableButtons.map((v) => (
                  <button key={`msg-${v}`} type="button" onClick={() => insertVariableAtCursor(v, "message")}>
                    <Badge variant="outline" className="cursor-pointer hover:bg-gray-100">
                      {v}
                    </Badge>
                  </button>
                ))}
              </div>
              <Textarea
                ref={messageRef}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="min-h-52"
                placeholder="Saisissez votre message automatique..."
                disabled={loading}
              />
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Apercu objet</p>
                <p className="text-sm font-medium text-gray-900">{previewSubject}</p>
                <p className="text-xs uppercase tracking-wide text-gray-500 pt-2">Apercu corps</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {previewBody || "Votre message apparaitra ici."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => void handleSave()} disabled={loading || saving}>
                  {saving ? "Enregistrement..." : "Enregistrer les automatisations"}
                </Button>
                {saved && <span className="text-sm text-emerald-600">Enregistre avec succes.</span>}
              </div>
              {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
