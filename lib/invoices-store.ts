/**
 * Stockage des factures (Supabase obligatoire sur Vercel ; repli fichier en local uniquement).
 *
 * Migration : supabase/invoices.sql
 */

import { randomUUID } from "crypto"
import { promises as fs } from "fs"
import path from "path"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import type { CreateInvoiceInput, Invoice, InvoiceStatus, InvoiceType } from "@/lib/invoice-types"
import { buildInvoiceNumber, lineItemsTotal, todayIsoDate } from "@/lib/invoice-utils"

const TABLE = process.env.SUPABASE_INVOICES_TABLE?.trim() || "invoices"
const DATA_FILE = path.join(process.cwd(), "data", "invoices.json")

const MISSING_TABLE_HINT =
  'Table Supabase "invoices" absente. Ouvrez Supabase → SQL Editor et exécutez le fichier supabase/invoices.sql, puis redeployez.'

let storageMode: "supabase" | "file" | null = null

function isProductionRuntime() {
  return Boolean(process.env.VERCEL)
}

export async function listInvoices(): Promise<Invoice[]> {
  const rows = await loadAll()
  return rows.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  if (await useSupabase()) {
    const { data, error } = await getSupabaseAdmin().from(TABLE).select("*").eq("id", id).maybeSingle()
    if (error) throw storageError("lecture", error.message)
    if (data) return mapDbRow(data as Record<string, unknown>)
    return null
  }
  const rows = await readFileStore()
  return rows.find((row) => row.id === id) ?? null
}

export async function findInvoiceByWeddingAndType(
  weddingId: number,
  type: InvoiceType
): Promise<Invoice | null> {
  const rows = await loadAll()
  return (
    rows.find(
      (row) =>
        row.weddingId === weddingId &&
        row.type === type &&
        row.status !== "cancelled"
    ) ?? null
  )
}

export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  const rows = await loadAll()
  const existing = rows.find(
    (row) =>
      row.weddingId === input.weddingId &&
      row.type === input.type &&
      row.status !== "cancelled"
  )
  if (existing) {
    throw new Error(
      `Une facture existe déjà pour cet événement (${existing.number}).`
    )
  }

  const now = new Date().toISOString()
  const amountTtc = input.amountTtc || lineItemsTotal(input.lineItems)
  const invoice: Invoice = {
    id: randomUUID(),
    number: buildInvoiceNumber(rows.map((row) => row.number)),
    weddingId: input.weddingId,
    couple: input.couple.trim(),
    type: input.type,
    status: input.status ?? "draft",
    issuedAt: input.issuedAt ?? todayIsoDate(),
    dueAt: input.dueAt ?? todayIsoDate(),
    amountTtc,
    vatRate: input.vatRate ?? 20,
    lineItems: input.lineItems,
    issuer: input.issuer,
    client: input.client,
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

export async function updateInvoiceStatus(id: string, status: InvoiceStatus): Promise<Invoice | null> {
  const current = await getInvoice(id)
  if (!current) return null

  const updated: Invoice = {
    ...current,
    status,
    updatedAt: new Date().toISOString(),
  }

  if (await useSupabase()) {
    const { error } = await getSupabaseAdmin()
      .from(TABLE)
      .update({ status, updated_at: updated.updatedAt })
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

export async function deleteInvoice(id: string): Promise<boolean> {
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

async function loadAll(): Promise<Invoice[]> {
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
    console.warn("[invoices] Supabase probe:", error.message)
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

async function readFileStore(): Promise<Invoice[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8")
    const parsed = JSON.parse(raw) as Invoice[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function writeFileStore(rows: Invoice[]) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
  await fs.writeFile(DATA_FILE, JSON.stringify(rows, null, 2), "utf8")
}

function mapDbRow(row: Record<string, unknown>): Invoice {
  return {
    id: String(row.id),
    number: String(row.number),
    weddingId: Number(row.wedding_id),
    couple: String(row.couple),
    type: row.invoice_type as InvoiceType,
    status: row.status as InvoiceStatus,
    issuedAt: String(row.issued_at).slice(0, 10),
    dueAt: String(row.due_at).slice(0, 10),
    amountTtc: Number(row.amount_ttc),
    vatRate: Number(row.vat_rate ?? 20),
    lineItems: (row.line_items as Invoice["lineItems"]) ?? [],
    issuer: row.issuer as Invoice["issuer"],
    client: row.client as Invoice["client"],
    notes: row.notes ? String(row.notes) : undefined,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  }
}

function toDbRow(invoice: Invoice) {
  return {
    id: invoice.id,
    number: invoice.number,
    wedding_id: invoice.weddingId,
    couple: invoice.couple,
    invoice_type: invoice.type,
    status: invoice.status,
    issued_at: invoice.issuedAt,
    due_at: invoice.dueAt,
    amount_ttc: invoice.amountTtc,
    vat_rate: invoice.vatRate,
    line_items: invoice.lineItems,
    issuer: invoice.issuer,
    client: invoice.client,
    notes: invoice.notes ?? null,
    created_at: invoice.createdAt,
    updated_at: invoice.updatedAt,
  }
}
