/**
 * Stockage des factures (Supabase + repli fichier local).
 *
 * À créer une fois dans Supabase (SQL Editor) :
 *
 * create table public.invoices (
 *   id uuid primary key default gen_random_uuid(),
 *   number text not null unique,
 *   wedding_id bigint not null,
 *   couple text not null,
 *   invoice_type text not null check (invoice_type in ('deposit', 'balance', 'full')),
 *   status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'cancelled')),
 *   issued_at date not null,
 *   due_at date not null,
 *   amount_ttc numeric not null,
 *   vat_rate numeric not null default 20,
 *   line_items jsonb not null default '[]',
 *   issuer jsonb not null,
 *   client jsonb not null,
 *   notes text,
 *   created_at timestamptz default now(),
 *   updated_at timestamptz default now()
 * );
 *
 * create index invoices_wedding_id_idx on public.invoices (wedding_id);
 */

import { randomUUID } from "crypto"
import { promises as fs } from "fs"
import path from "path"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import type { CreateInvoiceInput, Invoice, InvoiceStatus, InvoiceType } from "@/lib/invoice-types"
import { buildInvoiceNumber, lineItemsTotal, todayIsoDate } from "@/lib/invoice-utils"

const TABLE = process.env.SUPABASE_INVOICES_TABLE?.trim() || "invoices"
const DATA_FILE = path.join(process.cwd(), "data", "invoices.json")

let storageMode: "supabase" | "file" | null = null

export async function listInvoices(): Promise<Invoice[]> {
  const rows = await loadAll()
  return rows.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  if (await useSupabase()) {
    const { data, error } = await getSupabaseAdmin().from(TABLE).select("*").eq("id", id).maybeSingle()
    if (!error && data) return mapDbRow(data as Record<string, unknown>)
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
    if (!error) return invoice
    if (!isMissingTableError(error.message)) {
      throw new Error(`Supabase insert failed: ${error.message}`)
    }
    storageMode = "file"
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
    if (!error) return updated
    if (!isMissingTableError(error.message)) {
      throw new Error(`Supabase update failed: ${error.message}`)
    }
    storageMode = "file"
  }

  const rows = await readFileStore()
  const next = rows.map((row) => (row.id === id ? updated : row))
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
    if (!error) return Boolean(data)
    if (!isMissingTableError(error.message)) {
      throw new Error(`Supabase delete failed: ${error.message}`)
    }
    storageMode = "file"
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
    if (!error && data) {
      return (data as Record<string, unknown>[]).map(mapDbRow)
    }
    if (error && !isMissingTableError(error.message)) {
      console.warn("[invoices] Supabase:", error.message)
    }
    storageMode = "file"
  }
  return readFileStore()
}

async function useSupabase(): Promise<boolean> {
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
    storageMode = "file"
    return false
  } catch {
    storageMode = "file"
    return false
  }
}

function isMissingTableError(message: string) {
  const lower = message.toLowerCase()
  return lower.includes("does not exist") || lower.includes("could not find the table")
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
