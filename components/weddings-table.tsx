"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Pencil } from "lucide-react"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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
        setRows([])
        setLoadError((payload.error ?? `Erreur ${response.status}`) + hint)
        return
      }

      setRows(payload.weddings ?? [])
    } catch {
      setRows([])
      setLoadError("Impossible de joindre le serveur.")
    } finally {
      setLoading(false)
    }
  }, [])

  const toggleAutopilot = async (id: number, autopilot: boolean) => {
    try {
      const response = await fetch(`/api/weddings/${id}/autopilot`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autopilot }),
      })
      if (!response.ok) throw new Error("autopilot update failed")
      const payload = (await response.json()) as { wedding: WeddingRow }
      setRows((prev) => prev.map((row) => (row.id === id ? payload.wedding : row)))
      window.dispatchEvent(new Event("weddings-updated"))
    } catch {
      // Keep UI unchanged on failure.
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
    try {
      const response = await fetch(`/api/weddings/${weddingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, status }),
      })

      if (!response.ok) throw new Error("status update failed")
      const payload = (await response.json()) as { wedding: WeddingRow }
      setRows((prev) =>
        prev.map((row) => (row.id === weddingId ? payload.wedding : row))
      )
      window.dispatchEvent(new Event("weddings-updated"))
    } catch {
      // No optimistic update: keep previous state when request fails.
    }
  }

  return (
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
              Sur Vercel, vérifie notamment{" "}
              <strong>SUPABASE_SERVICE_ROLE_KEY</strong> (clé secrète « service_role », pas la clé
              anon), <strong>NEXT_PUBLIC_SUPABASE_URL</strong> et éventuellement{" "}
              <strong>SUPABASE_RESERVATIONS_TABLE</strong>.
            </p>
          </div>
        ) : null}
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
                {/* Couple + date */}
                <TableCell className="px-6 py-4">
                  <p className="font-semibold text-gray-900 text-sm">{row.couple}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Contact: {row.contactName || "—"}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{row.email || "—"}</p>
                  <p className="text-xs text-gray-500">{row.phone || "—"}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(row.eventDate)}</p>
                </TableCell>

                {/* Deposit */}
                <TableCell className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700 font-medium">
                      {row.deposit.amount}
                    </span>
                    <StatusBadge
                      status={row.deposit.status}
                      options={["pending", "paid"]}
                      onSelect={(status) => updatePaymentStatus(row.id, "deposit", status)}
                    />
                  </div>
                </TableCell>

                {/* Balance */}
                <TableCell className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700 font-medium">
                      {row.balance.amount}
                    </span>
                    <StatusBadge
                      status={row.balance.status}
                      options={["pending", "paid", "to_collect"]}
                      onSelect={(status) => updatePaymentStatus(row.id, "balance", status)}
                    />
                  </div>
                </TableCell>

                {/* Autopilot Switch */}
                <TableCell className="px-4 py-4">
                  <div className="flex items-center gap-2.5">
                    <Switch
                      checked={row.autopilot}
                      onCheckedChange={(checked) => toggleAutopilot(row.id, checked)}
                      className="data-[state=checked]:bg-emerald-500"
                      aria-label={`Pilote automatique pour ${row.couple}`}
                    />
                    <span className="text-xs text-gray-400">
                      {row.autopilot ? "Actif" : "Inactif"}
                    </span>
                  </div>
                </TableCell>

                {/* Last Activity */}
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
      </CardContent>
      <Dialog open={Boolean(editingRow)} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent>
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
                  value={editDepositAmount}
                  onChange={(event) => setEditDepositAmount(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-800">Solde (€)</label>
                <Input
                  type="number"
                  min="0"
                  value={editBalanceAmount}
                  onChange={(event) => setEditBalanceAmount(event.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button
              variant="destructive"
              onClick={handleDeleteRow}
              disabled={deleteSubmitting || editSubmitting}
            >
              {deleteSubmitting ? "Suppression..." : "Supprimer la ligne"}
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={closeEditDialog} disabled={editSubmitting}>
                Annuler
              </Button>
              <Button onClick={handleSaveEdit} disabled={editSubmitting || deleteSubmitting}>
                {editSubmitting ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )

  function openEditDialog(row: WeddingRow) {
    setEditingRow(row)
    setEditCouple(row.couple)
    setEditContactName(row.contactName)
    setEditEmail(row.email)
    setEditPhone(row.phone)
    setEditEventDate(row.eventDate)
    setEditDepositAmount(extractNumericAmount(row.deposit.amount))
    setEditBalanceAmount(extractNumericAmount(row.balance.amount))
  }

  function closeEditDialog() {
    if (editSubmitting || deleteSubmitting) return
    setEditingRow(null)
  }

  async function handleSaveEdit() {
    if (!editingRow) return
    setEditSubmitting(true)
    try {
      const response = await fetch(`/api/weddings/${editingRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          couple: editCouple,
          contactName: editContactName,
          email: editEmail,
          phone: editPhone,
          eventDate: editEventDate,
          depositAmount: editDepositAmount,
          balanceAmount: editBalanceAmount,
        }),
      })
      if (!response.ok) throw new Error("edit failed")
      await refreshRows()
      setEditingRow(null)
      window.dispatchEvent(new Event("weddings-updated"))
    } finally {
      setEditSubmitting(false)
    }
  }

  async function handleDeleteRow() {
    if (!editingRow) return
    setDeleteSubmitting(true)
    try {
      const response = await fetch(`/api/weddings/${editingRow.id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("delete failed")
      setRows((prev) => prev.filter((row) => row.id !== editingRow.id))
      setEditingRow(null)
      window.dispatchEvent(new Event("weddings-updated"))
    } finally {
      setDeleteSubmitting(false)
    }
  }
}

type StatusBadgeProps = {
  status: PaymentStatus
  options: PaymentStatus[]
  onSelect: (status: PaymentStatus) => void
}

function StatusBadge({ status, options, onSelect }: StatusBadgeProps) {
  const label = getStatusLabel(status)
  const className = getStatusClassName(status)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="focus:outline-none">
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
