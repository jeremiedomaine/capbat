/**
 * Factures de taxe de séjour (numérotation TDS-YYYY-NNN).
 * Migration : supabase/tourist_tax_invoices.sql
 */

import { randomUUID } from "crypto"
import { promises as fs } from "fs"
import path from "path"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { TOURIST_TAX_RATE_EUR } from "@/lib/tourist-tax"
import type {
  CreateTouristTaxInvoiceInput,
  TouristTaxInvoice,
  TouristTaxInvoiceStatus,
  UpdateTouristTaxInvoiceInput,
} from "@/lib/tourist-tax-invoice-types"
import {
  buildTouristTaxInvoiceNumber,
  normalizeOccupancyLines,
  occupancyLinesTotal,
  todayIsoDate,
} from "@/lib/tourist-tax-invoice-utils"

const TABLE = process.env.SUPABASE_TOURIST_TAX_INVOICES_TABLE?.trim() || "tourist_tax_invoices"
const DATA_FILE = path.join(process.cwd(), "data", "tourist-tax-invoices.json")

const MISSING_TABLE_HINT =
  'Table Supabase "tourist_tax_invoices" absente. Ouvrez Supabase → SQL Editor et exécutez supabase/tourist_tax_invoices.sql, puis redeployez.'

let storageMode: "supabase" | "file" | null = null

function isProductionRuntime() {
  return Boolean(process.env.VERCEL)
}

export async function listTouristTaxInvoices(): Promise<TouristTaxInvoice[]> {
  const rows = await loadAll()
  return rows.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
}

export async function getTouristTaxInvoice(id: string): Promise<TouristTaxInvoice | null> {
  if (await useSupabase()) {
    const { data, error } = await getSupabaseAdmin().from(TABLE).select("*").eq("id", id).maybeSingle()
    if (error) throw storageError("lecture", error.message)
    if (data) return mapDbRow(data as Record<string, unknown>)
    return null
  }
  const rows = await readFileStore()
  return rows.find((item) => item.id === id) ?? null
}

export async function createTouristTaxInvoice(
  input: CreateTouristTaxInvoiceInput
): Promise<TouristTaxInvoice> {
  const lines = normalizeOccupancyLines(input.lines)
  if (!lines.length) {
    throw new Error("Ajoutez au moins une ligne d'occupation (adultes × nuitées).")
  }

  const rate = input.rate ?? TOURIST_TAX_RATE_EUR
  const amountTtc = occupancyLinesTotal(lines, rate)
  if (amountTtc <= 0) {
    throw new Error("Le montant de la taxe de séjour doit être positif.")
  }

  const rows = await loadAll()
  const now = new Date().toISOString()
  const invoice: TouristTaxInvoice = {
    id: randomUUID(),
    number: buildTouristTaxInvoiceNumber(rows.map((row) => row.number)),
    weddingId: input.weddingId,
    couple: input.couple.trim(),
    status: input.status ?? "draft",
    periodStart: input.periodStart.slice(0, 10),
    periodEnd: input.periodEnd.slice(0, 10),
    issuedAt: (input.issuedAt ?? todayIsoDate()).slice(0, 10),
    paidAt: (input.paidAt ?? "").slice(0, 10),
    paymentMethod: (input.paymentMethod ?? "").trim(),
    lines,
    amountTtc,
    rate,
    clientName: input.clientName.trim(),
    clientAddress: (input.clientAddress ?? "").trim(),
    notes: input.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  }

  if (await useSupabase()) {
    const { error } = await getSupabaseAdmin().from(TABLE).insert(toDbRow(invoice))
    if (error) throw storageError("création", error.message)
    return invoice
  }

  if (isProductionRuntime()) {
    throw new Error(MISSING_TABLE_HINT)
  }

  const fileRows = await readFileStore()
  await writeFileStore([...fileRows, invoice])
  return invoice
}

export async function updateTouristTaxInvoice(
  id: string,
  input: UpdateTouristTaxInvoiceInput
): Promise<TouristTaxInvoice | null> {
  const current = await getTouristTaxInvoice(id)
  if (!current) return null

  const lines = input.lines ? normalizeOccupancyLines(input.lines) : current.lines
  if (!lines.length) {
    throw new Error("Ajoutez au moins une ligne d'occupation (adultes × nuitées).")
  }

  const amountTtc = input.lines
    ? occupancyLinesTotal(lines, current.rate)
    : (input.amountTtc ?? current.amountTtc)

  const updated: TouristTaxInvoice = {
    ...current,
    lines,
    amountTtc,
    periodStart: input.periodStart?.slice(0, 10) ?? current.periodStart,
    periodEnd: input.periodEnd?.slice(0, 10) ?? current.periodEnd,
    issuedAt: input.issuedAt?.slice(0, 10) ?? current.issuedAt,
    paidAt:
      input.paidAt !== undefined ? input.paidAt.slice(0, 10) : current.paidAt,
    paymentMethod:
      input.paymentMethod !== undefined
        ? input.paymentMethod.trim()
        : current.paymentMethod,
    clientName: input.clientName?.trim() ?? current.clientName,
    clientAddress:
      input.clientAddress !== undefined
        ? input.clientAddress.trim()
        : current.clientAddress,
    notes:
      input.notes !== undefined ? input.notes.trim() || undefined : current.notes,
    status: input.status ?? current.status,
    updatedAt: new Date().toISOString(),
  }

  if (await useSupabase()) {
    const { error } = await getSupabaseAdmin()
      .from(TABLE)
      .update({
        lines: updated.lines,
        amount_ttc: updated.amountTtc,
        period_start: updated.periodStart,
        period_end: updated.periodEnd,
        issued_at: updated.issuedAt,
        paid_at: updated.paidAt || null,
        payment_method: updated.paymentMethod || null,
        client_name: updated.clientName,
        client_address: updated.clientAddress || null,
        notes: updated.notes ?? null,
        status: updated.status,
        updated_at: updated.updatedAt,
      })
      .eq("id", id)
    if (error) throw storageError("mise à jour", error.message)
    return updated
  }

  if (isProductionRuntime()) {
    throw new Error(MISSING_TABLE_HINT)
  }

  const fileRows = await readFileStore()
  const next = fileRows.map((row) => (row.id === id ? updated : row))
  await writeFileStore(next)
  return updated
}

export async function deleteTouristTaxInvoice(id: string): Promise<boolean> {
  if (await useSupabase()) {
    const { data, error } = await getSupabaseAdmin()
      .from(TABLE)
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle()
    if (error) throw storageError("suppression", error.message)
    return Boolean(data)
  }

  if (isProductionRuntime()) {
    throw new Error(MISSING_TABLE_HINT)
  }

  const rows = await readFileStore()
  const next = rows.filter((row) => row.id !== id)
  if (next.length === rows.length) return false
  await writeFileStore(next)
  return true
}

async function loadAll(): Promise<TouristTaxInvoice[]> {
  if (await useSupabase()) {
    const { data, error } = await getSupabaseAdmin().from(TABLE).select("*")
    if (error) throw storageError("liste", error.message)
    return (data ?? []).map((row) => mapDbRow(row as Record<string, unknown>))
  }

  if (isProductionRuntime()) {
    throw new Error(MISSING_TABLE_HINT)
  }

  return readFileStore()
}

async function useSupabase(): Promise<boolean> {
  if (isProductionRuntime()) {
    await assertSupabaseTableReady()
    return true
  }

  if (storageMode === "file") return false
  if (storageMode === "supabase") return true

  try {
    const { error } = await getSupabaseAdmin().from(TABLE).select("id").limit(1)
    if (!error) {
      storageMode = "supabase"
      return true
    }
    if (isMissingTableError(error.message)) {
      storageMode = "file"
      return false
    }
    console.warn("[tourist-tax-invoices] Supabase probe:", error.message)
    storageMode = "file"
    return false
  } catch {
    storageMode = "file"
    return false
  }
}

async function assertSupabaseTableReady() {
  if (storageMode === "supabase") return
  const { error } = await getSupabaseAdmin().from(TABLE).select("id").limit(1)
  if (error) {
    if (isMissingTableError(error.message)) {
      throw new Error(MISSING_TABLE_HINT)
    }
    throw storageError("accès", error.message)
  }
  storageMode = "supabase"
}

function storageError(action: string, message: string) {
  if (isMissingTableError(message)) {
    return new Error(MISSING_TABLE_HINT)
  }
  return new Error(`Supabase (${action}) : ${message}`)
}

function isMissingTableError(message: string) {
  const lower = message.toLowerCase()
  return (
    lower.includes("does not exist") ||
    lower.includes("could not find the table") ||
    lower.includes("schema cache")
  )
}

async function readFileStore(): Promise<TouristTaxInvoice[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8")
    const parsed = JSON.parse(raw) as TouristTaxInvoice[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeFileStore(rows: TouristTaxInvoice[]) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
  await fs.writeFile(DATA_FILE, JSON.stringify(rows, null, 2), "utf8")
}

function mapDbRow(row: Record<string, unknown>): TouristTaxInvoice {
  return {
    id: String(row.id),
    number: String(row.number),
    weddingId: Number(row.wedding_id),
    couple: String(row.couple),
    status: row.status as TouristTaxInvoiceStatus,
    periodStart: String(row.period_start).slice(0, 10),
    periodEnd: String(row.period_end).slice(0, 10),
    issuedAt: String(row.issued_at).slice(0, 10),
    paidAt: row.paid_at ? String(row.paid_at).slice(0, 10) : "",
    paymentMethod: row.payment_method ? String(row.payment_method) : "",
    lines: (row.lines as TouristTaxInvoice["lines"]) ?? [],
    amountTtc: Number(row.amount_ttc),
    rate: Number(row.rate ?? TOURIST_TAX_RATE_EUR),
    clientName: String(row.client_name ?? ""),
    clientAddress: row.client_address ? String(row.client_address) : "",
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  }
}

function toDbRow(invoice: TouristTaxInvoice) {
  return {
    id: invoice.id,
    number: invoice.number,
    wedding_id: invoice.weddingId,
    couple: invoice.couple,
    status: invoice.status,
    period_start: invoice.periodStart,
    period_end: invoice.periodEnd,
    issued_at: invoice.issuedAt,
    paid_at: invoice.paidAt || null,
    payment_method: invoice.paymentMethod || null,
    lines: invoice.lines,
    amount_ttc: invoice.amountTtc,
    rate: invoice.rate,
    client_name: invoice.clientName,
    client_address: invoice.clientAddress || null,
    notes: invoice.notes ?? null,
    created_at: invoice.createdAt,
    updated_at: invoice.updatedAt,
  }
}
