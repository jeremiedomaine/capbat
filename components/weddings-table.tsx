"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CalendarPlus, Loader2, Pencil } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/empty-state"
import { validateEditWeddingInput } from "@/lib/form-validation"

type WeddingRow = {
  id: number
  couple: string
  contactName: string
  email: string
  phone: string
  eventDate: string
  deposit: { amount: string; status: PaymentStatus }
  balance: { amount: string; status: PaymentStatus }
  autopilot: boolean
  lastActivity: string
}

type PaymentStatus = "pending" | "paid" | "to_collect"

type PendingOp =
  | { rowId: number; kind: "deposit" | "balance" | "autopilot" }
  | null

export function WeddingsTable() {
  const [rows, setRows] = useState<WeddingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingRow, setEditingRow] = useState<WeddingRow | null>(null)
  const [editCouple, setEditCouple] = useState("")
  const [editContactName, setEditContactName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editEventDate, setEditEventDate] = useState("")
  const [editDepositAmount, setEditDepositAmount] = useState("")
  const [editBalanceAmount, setEditBalanceAmount] = useState("")
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [pendingOp, setPendingOp] = useState<PendingOp>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const refreshRows = useCallback(async () => {
    setLoadError("")
    try {
      const response = await fetch("/api/weddings", { credentials: "same-origin" })
      const payload = (await response.json()) as {
        weddings?: WeddingRow[]
        error?: string
      }

      if (!response.ok) {
        const hint =
          response.status === 403
            ? " Vérifie INTERNAL_ALLOWED_EMAILS sur Vercel : ton email doit être dans la liste."
            : response.status === 401
              ? " Session expirée : reconnecte-toi."
              : ""
        const msg = (payload.error ?? `Erreur ${response.status}`) + hint
        setRows([])
        setLoadError(msg)
        toast.error("Impossible de charger les événements", { description: msg.slice(0, 200) })
        return
      }

      setRows(payload.weddings ?? [])
    } catch {
      setRows([])
      setLoadError("Impossible de joindre le serveur.")
      toast.error("Réseau indisponible", {
        description: "Impossible de charger les événements.",
      })
    } finally {
      setLoading(false)
    }
  }, [])

  const toggleAutopilot = async (id: number, autopilot: boolean) => {
    setPendingOp({ rowId: id, kind: "autopilot" })
    try {
      const response = await fetch(`/api/weddings/${id}/autopilot`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autopilot }),
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(payload.error ?? "Mise à jour impossible.")
      }
      const payload = (await response.json()) as { wedding: WeddingRow }
      setRows((prev) => prev.map((row) => (row.id === id ? payload.wedding : row)))
      window.dispatchEvent(new Event("weddings-updated"))
      toast.success(autopilot ? "Relance automatique activée" : "Relance automatique désactivée")
    } catch (e) {
      toast.error("Échec de la mise à jour", {
        description: e instanceof Error ? e.message : "Réessayez dans un instant.",
      })
    } finally {
      setPendingOp(null)
    }
  }

  useEffect(() => {
    refreshRows()
  }, [refreshRows])

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
    [rows]
  )

  const updatePaymentStatus = async (
    weddingId: number,
    field: "deposit" | "balance",
    status: PaymentStatus
  ) => {
    setPendingOp({ rowId: weddingId, kind: field })
    try {
      const response = await fetch(`/api/weddings/${weddingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, status }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(payload.error ?? "Mise à jour impossible.")
      }
      const payload = (await response.json()) as { wedding: WeddingRow }
      setRows((prev) =>
        prev.map((row) => (row.id === weddingId ? payload.wedding : row))
      )
      window.dispatchEvent(new Event("weddings-updated"))
      toast.success(
        field === "deposit" ? "Statut acompte mis à jour" : "Statut solde mis à jour"
      )
    } catch (e) {
      toast.error("Échec du statut", {
        description: e instanceof Error ? e.message : "Réessayez dans un instant.",
      })
    } finally {
      setPendingOp(null)
    }
  }

  const showEmpty = !loading && !loadError && sortedRows.length === 0

  return (
    <>
      <Card className="bg-white border-gray-100 shadow-sm">
        <CardHeader className="px-6 pt-6 pb-4 border-b border-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-gray-900">
                Prochains Mariages
              </CardTitle>
              <p className="text-sm text-gray-400 mt-0.5">
                {loading ? "Chargement..." : `${sortedRows.length} événements planifiés`}
              </p>
            </div>
            <Badge variant="outline" className="text-xs text-gray-500 border-gray-200">
              2026
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadError ? (
            <div className="mx-6 mt-4 mb-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
              <p className="font-medium">Données non chargées</p>
              <p className="mt-1 text-red-700">{loadError}</p>
              <p className="mt-2 text-xs text-red-600">
                Dans Vercel → Settings → Environment Variables : pour chaque variable, coche{" "}
                <strong>Production</strong> (pas seulement Preview). Ajoute{" "}
                <strong>NEXT_PUBLIC_SUPABASE_URL</strong>{" "}
                <span className="opacity-90">
                  (ou duplique la même URL en <strong>SUPABASE_URL</strong> côté serveur)
                </span>
                , plus <strong>SUPABASE_SERVICE_ROLE_KEY</strong> (secret service_role). Optionnel :{" "}
                <strong>SUPABASE_RESERVATIONS_TABLE</strong>. Puis Redeploy.
              </p>
            </div>
          ) : null}

          {loading && sortedRows.length === 0 && !loadError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" aria-hidden />
              <p className="text-sm">Chargement des événements…</p>
            </div>
          ) : null}

          {showEmpty ? (
            <div className="p-6">
              <EmptyState
                icon={CalendarPlus}
                title="Aucun mariage enregistré"
                description="Ajoutez votre premier événement pour voir le planning, les encaissements et les relances automatiques ici."
              >
                <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
                  <Link href="/evenements/nouveau">Créer un événement</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/evenements">Voir la liste</Link>
                </Button>
              </EmptyState>
            </div>
          ) : null}

          {!loading && !showEmpty && !loadError ? (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-50 hover:bg-transparent">
                  <TableHead className="px-6 py-3.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Mariés
                  </TableHead>
                  <TableHead className="px-4 py-3.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Acompte
                  </TableHead>
                  <TableHead className="px-4 py-3.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Solde
                  </TableHead>
                  <TableHead className="px-4 py-3.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Relance auto
                  </TableHead>
                  <TableHead className="px-6 py-3.5 text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Dernière Activité
                  </TableHead>
                  <TableHead className="px-6 py-3.5 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.map((row, idx) => (
                  <TableRow
                    key={row.id}
                    className={`border-gray-50 transition-colors hover:bg-gray-50/60 ${
                      idx !== sortedRows.length - 1 ? "border-b" : ""
                    }`}
                  >
                    <TableCell className="px-6 py-4">
                      <p className="font-semibold text-gray-900 text-sm">{row.couple}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Contact: {row.contactName || "—"}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{row.email || "—"}</p>
                      <p className="text-xs text-gray-500">{row.phone || "—"}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(row.eventDate)}</p>
                    </TableCell>

                    <TableCell className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700 font-medium">
                          {row.deposit.amount}
                        </span>
                        <StatusBadge
                          status={row.deposit.status}
                          options={["pending", "paid"]}
                          disabled={Boolean(pendingOp?.rowId === row.id && pendingOp.kind === "deposit")}
                          onSelect={(status) => updatePaymentStatus(row.id, "deposit", status)}
                        />
                      </div>
                    </TableCell>

                    <TableCell className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700 font-medium">
                          {row.balance.amount}
                        </span>
                        <StatusBadge
                          status={row.balance.status}
                          options={["pending", "paid", "to_collect"]}
                          disabled={Boolean(pendingOp?.rowId === row.id && pendingOp.kind === "balance")}
                          onSelect={(status) => updatePaymentStatus(row.id, "balance", status)}
                        />
                      </div>
                    </TableCell>

                    <TableCell className="px-4 py-4">
                      <div className="flex items-center gap-2.5">
                        <Switch
                          checked={row.autopilot}
                          disabled={
                            pendingOp?.rowId === row.id && pendingOp.kind === "autopilot"
                          }
                          onCheckedChange={(checked) => toggleAutopilot(row.id, checked)}
                          className="data-[state=checked]:bg-emerald-500"
                          aria-label={`Pilote automatique pour ${row.couple}`}
                        />
                        <span className="text-xs text-gray-400">
                          {pendingOp?.rowId === row.id && pendingOp.kind === "autopilot" ? (
                            <Loader2 className="inline h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : row.autopilot ? (
                            "Actif"
                          ) : (
                            "Inactif"
                          )}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="px-6 py-4">
                      <span className="text-sm text-gray-400">{row.lastActivity}</span>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <Button
                        variant="outline"
                        size="icon"
                        className="w-8 h-8"
                        onClick={() => openEditDialog(row)}
                        aria-label={`Modifier ${row.couple}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editingRow)} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier l&apos;événement</DialogTitle>
            <DialogDescription>
              Modifiez les informations de cette ligne ou supprimez-la définitivement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-800">Couple</label>
              <Input value={editCouple} onChange={(event) => setEditCouple(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-800">Nom du contact</label>
              <Input
                value={editContactName}
                onChange={(event) => setEditContactName(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-800">Adresse mail</label>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(event) => setEditEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-800">Numéro de téléphone</label>
                <Input
                  type="tel"
                  value={editPhone}
                  onChange={(event) => setEditPhone(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-800">Date</label>
              <Input
                type="date"
                value={editEventDate}
                onChange={(event) => setEditEventDate(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-800">Acompte (€)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editDepositAmount}
                  onChange={(event) => setEditDepositAmount(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-800">Solde (€)</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editBalanceAmount}
                  onChange={(event) => setEditBalanceAmount(event.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-between gap-2 flex-col sm:flex-row">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={deleteSubmitting || editSubmitting}
            >
              Supprimer la ligne
            </Button>
            <div className="flex items-center gap-2 justify-end w-full sm:w-auto">
              <Button variant="outline" onClick={closeEditDialog} disabled={editSubmitting}>
                Annuler
              </Button>
              <Button onClick={() => void handleSaveEdit()} disabled={editSubmitting || deleteSubmitting}>
                {editSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Enregistrement…
                  </>
                ) : (
                  "Enregistrer"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet événement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive : la ligne sera retirée de votre planning et de Supabase.
              Les relances automatiques associées ne s&apos;appliqueront plus à ce dossier.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubmitting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              disabled={deleteSubmitting}
              onClick={(e) => {
                e.preventDefault()
                void executeDelete()
              }}
            >
              {deleteSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin inline" aria-hidden />
                  Suppression…
                </>
              ) : (
                "Supprimer définitivement"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )

  function openEditDialog(row: WeddingRow) {
    setEditingRow(row)
    setEditCouple(row.couple)
    setEditContactName(row.contactName)
    setEditEmail(row.email)
    setEditPhone(row.phone)
    setEditEventDate(row.eventDate.slice(0, 10))
    setEditDepositAmount(extractNumericAmount(row.deposit.amount))
    setEditBalanceAmount(extractNumericAmount(row.balance.amount))
  }

  function closeEditDialog() {
    if (editSubmitting || deleteSubmitting) return
    setEditingRow(null)
    setConfirmDeleteOpen(false)
  }

  async function handleSaveEdit() {
    if (!editingRow) return
    const err = validateEditWeddingInput({
      couple: editCouple,
      contactName: editContactName,
      email: editEmail,
      phone: editPhone,
      eventDate: editEventDate,
      depositAmount: editDepositAmount,
      balanceAmount: editBalanceAmount,
    })
    if (err) {
      toast.error("Formulaire incomplet", { description: err })
      return
    }

    setEditSubmitting(true)
    try {
      const response = await fetch(`/api/weddings/${editingRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          couple: editCouple.trim(),
          contactName: editContactName.trim(),
          email: editEmail.trim(),
          phone: editPhone.trim(),
          eventDate: editEventDate,
          depositAmount: editDepositAmount,
          balanceAmount: editBalanceAmount,
        }),
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(payload.error ?? "Enregistrement impossible.")
      }
      await refreshRows()
      setEditingRow(null)
      window.dispatchEvent(new Event("weddings-updated"))
      toast.success("Événement mis à jour")
    } catch (e) {
      toast.error("Échec de l’enregistrement", {
        description: e instanceof Error ? e.message : "Réessayez dans un instant.",
      })
    } finally {
      setEditSubmitting(false)
    }
  }

  async function executeDelete() {
    if (!editingRow) return
    setDeleteSubmitting(true)
    try {
      const response = await fetch(`/api/weddings/${editingRow.id}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        throw new Error(payload.error ?? "Suppression impossible.")
      }
      setRows((prev) => prev.filter((row) => row.id !== editingRow.id))
      setEditingRow(null)
      setConfirmDeleteOpen(false)
      window.dispatchEvent(new Event("weddings-updated"))
      toast.success("Événement supprimé")
    } catch (e) {
      toast.error("Suppression impossible", {
        description: e instanceof Error ? e.message : "Réessayez dans un instant.",
      })
    } finally {
      setDeleteSubmitting(false)
    }
  }
}

type StatusBadgeProps = {
  status: PaymentStatus
  options: PaymentStatus[]
  disabled?: boolean
  onSelect: (status: PaymentStatus) => void
}

function StatusBadge({ status, options, disabled, onSelect }: StatusBadgeProps) {
  const label = getStatusLabel(status)
  const className = getStatusClassName(status)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="focus:outline-none disabled:pointer-events-none disabled:opacity-50"
        >
          <Badge className={`${className} border-0 text-xs font-medium px-2`}>{label}</Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {options.map((option) => (
          <DropdownMenuItem key={option} onClick={() => onSelect(option)}>
            {getStatusLabel(option)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function getStatusLabel(status: PaymentStatus) {
  if (status === "paid") return "Payé"
  if (status === "to_collect") return "À percevoir"
  return "En attente"
}

function getStatusClassName(status: PaymentStatus) {
  if (status === "paid") return "bg-emerald-50 text-emerald-600"
  if (status === "to_collect") return "bg-orange-50 text-orange-500"
  return "bg-amber-50 text-amber-600"
}

function formatDate(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed)
}

function extractNumericAmount(value: string) {
  const cleaned = value.replace(/[^\d,.-]/g, "").replace(",", ".")
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? String(Math.round(parsed)) : ""
}
