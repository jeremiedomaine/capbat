"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Loader2, Mail } from "lucide-react"
import { toast } from "sonner"
import { Sidebar } from "@/components/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DEFAULT_AUTOMATION_MESSAGE,
  DEFAULT_AUTOMATION_SUBJECT,
  DEFAULT_POST_EVENT_AUTOMATION_MESSAGE,
  DEFAULT_POST_EVENT_AUTOMATION_SUBJECT,
  DEPOSIT_REMINDER_DAYS_BEFORE,
  FIXED_AUTOMATION_SEND_TIME,
  POST_EVENT_REMINDER_DAYS_AFTER,
} from "@/lib/automation-defaults"
import {
  AUTOMATION_PREVIEW_DAYS_AHEAD,
  AUTOMATION_PREVIEW_DAYS_AFTER,
  AUTOMATION_PREVIEW_SAMPLE_WEDDING,
} from "@/lib/automation-preview-sample"
import { buildAutomationVariableMap, renderTemplate } from "@/lib/email-template"
import { isValidEmail } from "@/lib/form-validation"
import { getStoredContactEmail, PROFILE_EVENTS } from "@/lib/profile-local-storage"

const variableButtons = [
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

export default function AutomatisationsPage() {
  const [subject, setSubject] = useState(DEFAULT_AUTOMATION_SUBJECT)
  const [message, setMessage] = useState(DEFAULT_AUTOMATION_MESSAGE)
  const [postEventSubject, setPostEventSubject] = useState(DEFAULT_POST_EVENT_AUTOMATION_SUBJECT)
  const [postEventMessage, setPostEventMessage] = useState(DEFAULT_POST_EVENT_AUTOMATION_MESSAGE)
  const [saved, setSaved] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [saveError, setSaveError] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  const [sendingPostEventTest, setSendingPostEventTest] = useState(false)
  const [testRecipientEmail, setTestRecipientEmail] = useState("")
  const messageRef = useRef<HTMLTextAreaElement | null>(null)
  const subjectRef = useRef<HTMLInputElement | null>(null)
  const postEventMessageRef = useRef<HTMLTextAreaElement | null>(null)
  const postEventSubjectRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const syncRecipient = () => setTestRecipientEmail(getStoredContactEmail()?.trim() ?? "")
    syncRecipient()
    window.addEventListener(PROFILE_EVENTS.contactEmail, syncRecipient)
    return () => window.removeEventListener(PROFILE_EVENTS.contactEmail, syncRecipient)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadError("")
      try {
        const res = await fetch("/api/automations/settings")
        const payload = (await res.json()) as {
          settings?: {
            messageTemplate: string
            subjectTemplate: string
            postEventMessageTemplate: string
            postEventSubjectTemplate: string
          }
          error?: string
        }
        if (!res.ok) {
          throw new Error(payload.error ?? "Impossible de charger les automatisations.")
        }
        if (cancelled || !payload.settings) return
        setMessage(payload.settings.messageTemplate)
        setSubject(payload.settings.subjectTemplate)
        setPostEventMessage(payload.settings.postEventMessageTemplate)
        setPostEventSubject(payload.settings.postEventSubjectTemplate)
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
    () => buildAutomationVariableMap(AUTOMATION_PREVIEW_SAMPLE_WEDDING, AUTOMATION_PREVIEW_DAYS_AHEAD),
    []
  )
  const postEventPreviewVars = useMemo(
    () =>
      buildAutomationVariableMap(
        AUTOMATION_PREVIEW_SAMPLE_WEDDING,
        undefined,
        AUTOMATION_PREVIEW_DAYS_AFTER
      ),
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
  const postEventPreviewSubject = useMemo(
    () => renderTemplate(postEventSubject, postEventPreviewVars),
    [postEventSubject, postEventPreviewVars]
  )
  const postEventPreviewBody = useMemo(
    () => renderTemplate(postEventMessage, postEventPreviewVars),
    [postEventMessage, postEventPreviewVars]
  )

  const handleSave = async () => {
    setSaveError("")
    const sub = subject.trim()
    const msg = message.trim()
    const postSub = postEventSubject.trim()
    const postMsg = postEventMessage.trim()

    if (!sub) {
      const err = "L’objet de la relance J-30 ne peut pas être vide."
      setSaveError(err)
      toast.error("Objet manquant", { description: err })
      return
    }
    if (!msg) {
      const err = "Le corps de la relance J-30 ne peut pas être vide."
      setSaveError(err)
      toast.error("Message manquant", { description: err })
      return
    }
    if (!postSub) {
      const err = "L’objet du message J+3 ne peut pas être vide."
      setSaveError(err)
      toast.error("Objet manquant", { description: err })
      return
    }
    if (!postMsg) {
      const err = "Le corps du message J+3 ne peut pas être vide."
      setSaveError(err)
      toast.error("Message manquant", { description: err })
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/automations/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageTemplate: msg,
          subjectTemplate: sub,
          postEventMessageTemplate: postMsg,
          postEventSubjectTemplate: postSub,
        }),
      })
      const payload = (await response.json()) as {
        settings?: {
          messageTemplate: string
          subjectTemplate: string
          postEventMessageTemplate: string
          postEventSubjectTemplate: string
        }
        error?: string
      }
      if (!response.ok) {
        throw new Error(payload.error ?? "Enregistrement impossible.")
      }
      if (payload.settings) {
        setMessage(payload.settings.messageTemplate)
        setSubject(payload.settings.subjectTemplate)
        setPostEventMessage(payload.settings.postEventMessageTemplate)
        setPostEventSubject(payload.settings.postEventSubjectTemplate)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      toast.success("Automatisations enregistrées", {
        description: "Les prochains envois utiliseront ces modèles.",
      })
    } catch (e) {
      const m = e instanceof Error ? e.message : "Erreur d'enregistrement."
      setSaveError(m)
      toast.error("Enregistrement impossible", { description: m })
    } finally {
      setSaving(false)
    }
  }

  const sendTestEmail = async (opts: {
    subjectTemplate: string
    messageTemplate: string
    daysAhead?: number
    daysAfter?: number
    setSending: (value: boolean) => void
  }) => {
    const to = testRecipientEmail.trim()
    if (!to || !isValidEmail(to)) {
      toast.error("Destinataire manquant", {
        description:
          "Enregistrez une adresse valide dans Paramètres → E-mail de contact, puis réessayez.",
      })
      return
    }
    if (!opts.subjectTemplate.trim() || !opts.messageTemplate.trim()) {
      toast.error("Modèle incomplet", {
        description: "Remplissez l’objet et le corps du message avant d’envoyer un test.",
      })
      return
    }

    opts.setSending(true)
    try {
      const response = await fetch("/api/automations/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subjectTemplate: opts.subjectTemplate.trim(),
          messageTemplate: opts.messageTemplate.trim(),
          daysAhead: opts.daysAhead,
          daysAfter: opts.daysAfter,
        }),
      })
      const payload = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "Envoi impossible.")
      }
      toast.success("E-mail de test envoyé", {
        description: `Vérifiez la boîte ${to} (objet préfixé « [Test] »).`,
      })
    } catch (e) {
      toast.error("Échec de l’envoi", {
        description: e instanceof Error ? e.message : "Erreur inconnue.",
      })
    } finally {
      opts.setSending(false)
    }
  }

  const handleSendTestEmail = () =>
    void sendTestEmail({
      subjectTemplate: subject,
      messageTemplate: message,
      daysAhead: AUTOMATION_PREVIEW_DAYS_AHEAD,
      setSending: setSendingTest,
    })

  const handleSendPostEventTestEmail = () =>
    void sendTestEmail({
      subjectTemplate: postEventSubject,
      messageTemplate: postEventMessage,
      daysAfter: AUTOMATION_PREVIEW_DAYS_AFTER,
      setSending: setSendingPostEventTest,
    })

  const insertVariableAtCursor = (
    variable: string,
    field: "subject" | "message" | "postEventSubject" | "postEventMessage"
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

    if (field === "postEventSubject") {
      const input = postEventSubjectRef.current
      const text = postEventSubject
      if (!input) {
        setPostEventSubject((prev) => `${prev}${variable}`)
        return
      }
      const start = input.selectionStart ?? text.length
      const end = input.selectionEnd ?? text.length
      const next = `${text.slice(0, start)}${variable}${text.slice(end)}`
      setPostEventSubject(next)
      requestAnimationFrame(() => {
        input.focus()
        const cursor = start + variable.length
        input.setSelectionRange(cursor, cursor)
      })
      return
    }

    if (field === "postEventMessage") {
      const textarea = postEventMessageRef.current
      if (!textarea) {
        setPostEventMessage((prev) => `${prev}${variable}`)
        return
      }
      const start = textarea.selectionStart ?? postEventMessage.length
      const end = textarea.selectionEnd ?? postEventMessage.length
      const nextMessage = `${postEventMessage.slice(0, start)}${variable}${postEventMessage.slice(end)}`
      setPostEventMessage(nextMessage)
      requestAnimationFrame(() => {
        textarea.focus()
        const nextCursor = start + variable.length
        textarea.setSelectionRange(nextCursor, nextCursor)
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
              Deux envois automatiques à {FIXED_AUTOMATION_SEND_TIME.replace(":", "h")} (heure de
              Paris) : relance solde J-{DEPOSIT_REMINDER_DAYS_BEFORE} et message après mariage J+
              {POST_EVENT_REMINDER_DAYS_AFTER} (mariages uniquement, pilote auto activé).
            </p>
          </header>

          {loadError ? (
            <p className="text-sm text-red-600 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
              {loadError}
            </p>
          ) : null}

          <Tabs defaultValue="deposit" className="space-y-4">
            <TabsList className="grid w-full max-w-lg grid-cols-2 h-auto p-1">
              <TabsTrigger value="deposit" className="py-2">
                Relance solde J-{DEPOSIT_REMINDER_DAYS_BEFORE}
              </TabsTrigger>
              <TabsTrigger value="post-event" className="py-2">
                Après mariage J+{POST_EVENT_REMINDER_DAYS_AFTER}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="deposit">
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle>Relance solde — J-{DEPOSIT_REMINDER_DAYS_BEFORE}</CardTitle>
                  <CardDescription>
                    Envoyée {DEPOSIT_REMINDER_DAYS_BEFORE} jours avant la date, si le solde est en
                    attente. Variables : prénom, date, solde, couple, contact, acompte, téléphone,{" "}
                    {`{{j_moins}}`}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-gray-500 w-full mb-1">Objet</span>
                    {variableButtons.map((v) => (
                      <button
                        key={`sub-${v}`}
                        type="button"
                        onClick={() => insertVariableAtCursor(v, "subject")}
                      >
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
                      <button
                        key={`msg-${v}`}
                        type="button"
                        onClick={() => insertVariableAtCursor(v, "message")}
                      >
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

                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-4 space-y-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-medium text-gray-900">Tester le rendu par e-mail</p>
                      <Link
                        href="/parametres"
                        className="text-xs font-medium text-emerald-700 hover:text-emerald-800 underline-offset-2 hover:underline"
                      >
                        Modifier l&apos;e-mail de contact
                      </Link>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Un message est envoyé à l&apos;adresse enregistrée dans{" "}
                      <span className="font-medium text-gray-800">
                        Paramètres → E-mail de contact
                      </span>
                      , avec les mêmes variables factices que l&apos;aperçu ci-dessus.
                    </p>
                    <p className="text-sm text-gray-800">
                      <span className="text-gray-500">Destinataire : </span>
                      {testRecipientEmail ? (
                        <span className="font-medium tabular-nums">{testRecipientEmail}</span>
                      ) : (
                        <span className="text-amber-800">
                          Non renseigné — enregistrez un e-mail dans Paramètres.
                        </span>
                      )}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-emerald-200 bg-white hover:bg-emerald-50"
                      disabled={loading || sendingTest || !testRecipientEmail.trim()}
                      onClick={handleSendTestEmail}
                    >
                      {sendingTest ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                          Envoi en cours…
                        </>
                      ) : (
                        <>
                          <Mail className="mr-2 h-4 w-4" aria-hidden />
                          Envoyer un e-mail test
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="post-event">
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle>Message après mariage — J+{POST_EVENT_REMINDER_DAYS_AFTER}</CardTitle>
                  <CardDescription>
                    Envoyé {POST_EVENT_REMINDER_DAYS_AFTER} jours après la date du mariage, pour les
                    mariages avec pilote auto. Rédigez le message librement. Variables : prénom,
                    date, couple, contact, acompte, solde, téléphone, {`{{j_plus}}`}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-gray-500 w-full mb-1">Objet</span>
                    {variableButtons.map((v) => (
                      <button
                        key={`post-sub-${v}`}
                        type="button"
                        onClick={() => insertVariableAtCursor(v, "postEventSubject")}
                      >
                        <Badge variant="outline" className="cursor-pointer hover:bg-gray-100">
                          {v}
                        </Badge>
                      </button>
                    ))}
                  </div>
                  <Input
                    ref={postEventSubjectRef}
                    value={postEventSubject}
                    onChange={(e) => setPostEventSubject(e.target.value)}
                    disabled={loading}
                    placeholder={DEFAULT_POST_EVENT_AUTOMATION_SUBJECT}
                    className="font-medium"
                  />

                  <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-5">
                    <span className="text-xs text-gray-500 w-full mb-1">Corps du message</span>
                    {variableButtons.map((v) => (
                      <button
                        key={`post-msg-${v}`}
                        type="button"
                        onClick={() => insertVariableAtCursor(v, "postEventMessage")}
                      >
                        <Badge variant="outline" className="cursor-pointer hover:bg-gray-100">
                          {v}
                        </Badge>
                      </button>
                    ))}
                  </div>
                  <Textarea
                    ref={postEventMessageRef}
                    value={postEventMessage}
                    onChange={(event) => setPostEventMessage(event.target.value)}
                    className="min-h-52"
                    placeholder="Saisissez votre message personnalisé après l'événement..."
                    disabled={loading}
                  />
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Apercu objet</p>
                    <p className="text-sm font-medium text-gray-900">{postEventPreviewSubject}</p>
                    <p className="text-xs uppercase tracking-wide text-gray-500 pt-2">Apercu corps</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {postEventPreviewBody || "Votre message apparaitra ici."}
                    </p>
                  </div>

                  <div className="rounded-lg border border-sky-100 bg-sky-50/60 p-4 space-y-3">
                    <p className="text-sm font-medium text-gray-900">Tester le rendu par e-mail</p>
                    <p className="text-sm text-gray-800">
                      <span className="text-gray-500">Destinataire : </span>
                      {testRecipientEmail ? (
                        <span className="font-medium tabular-nums">{testRecipientEmail}</span>
                      ) : (
                        <span className="text-amber-800">
                          Non renseigné — enregistrez un e-mail dans Paramètres.
                        </span>
                      )}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-sky-200 bg-white hover:bg-sky-50"
                      disabled={loading || sendingPostEventTest || !testRecipientEmail.trim()}
                      onClick={handleSendPostEventTestEmail}
                    >
                      {sendingPostEventTest ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                          Envoi en cours…
                        </>
                      ) : (
                        <>
                          <Mail className="mr-2 h-4 w-4" aria-hidden />
                          Envoyer un test J+{POST_EVENT_REMINDER_DAYS_AFTER}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void handleSave()} disabled={loading || saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Enregistrement…
                </>
              ) : (
                "Enregistrer les automatisations"
              )}
            </Button>
            {saved && <span className="text-sm text-emerald-600">Enregistre avec succes.</span>}
          </div>
          {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
        </div>
      </main>
    </div>
  )
}
