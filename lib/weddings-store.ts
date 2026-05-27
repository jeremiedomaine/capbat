import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { parseEventType, type EventType } from "@/lib/event-types"
import { parsePaymentMethod } from "@/lib/payment-methods"
import { type WeddingDetailFields } from "@/lib/wedding-details"
import { type WeddingPaymentTracking } from "@/lib/wedding-payments"

const db = () => getSupabaseAdmin()

export type Wedding = WeddingDetailFields &
  WeddingPaymentTracking & {
  id: number
  eventType: EventType
  couple: string
  contactName: string
  email: string
  phone: string
  eventDate: string
  deposit: { amount: string; status: PaymentStatus }
  balance: { amount: string; status: PaymentStatus }
  autopilot: boolean
  lastActivity: string
  /** Date civile (YYYY-MM-DD) d'envoi du message J+3, si déjà envoyé. */
  postEventReminderSentDate: string
}

export type PaymentStatus = "pending" | "paid" | "to_collect"

export type NewWeddingInput = WeddingDetailFields & {
  eventType: EventType
  couple: string
  contactName: string
  email: string
  phone: string
  eventDate: string
  depositAmount: string
  balanceAmount: string
  autopilot: boolean
}

export type UpdateWeddingInput = Partial<WeddingDetailFields> &
  Partial<WeddingPaymentTracking> & {
  eventType?: EventType
  couple?: string
  contactName?: string
  email?: string
  phone?: string
  eventDate?: string
  depositAmount?: string
  balanceAmount?: string
  autopilot?: boolean
}

const RESERVATIONS_TABLE = process.env.SUPABASE_RESERVATIONS_TABLE
let resolvedTableName: string | null = RESERVATIONS_TABLE ?? null

export async function getWeddingById(weddingId: number): Promise<Wedding | null> {
  const tableName = await resolveReservationsTableName()
  const rowFilter = await findRowFilter(tableName, weddingId)
  if (!rowFilter) return null
  const row = await fetchRowByFilter(tableName, rowFilter)
  if (!row) return null
  return mapReservationToWedding(row, 0)
}

export async function listWeddings(): Promise<Wedding[]> {
  const tableName = await resolveReservationsTableName()
  const { data, error } = await db().from(tableName).select("*")
  if (error) throw new Error(`Supabase list failed: ${error.message}`)
  const rows = (data ?? []).map(mapReservationToWedding)
  return rows.sort((a, b) => a.eventDate.localeCompare(b.eventDate))
}

export async function createWedding(input: NewWeddingInput): Promise<Wedding> {
  const tableName = await resolveReservationsTableName()
  const payload: ReservationWrite = {
    event_type: input.eventType,
    event_name: input.eventName.trim(),
    spouse1_first_name: input.spouse1FirstName.trim(),
    spouse1_last_name: input.spouse1LastName.trim(),
    spouse2_first_name: input.spouse2FirstName.trim(),
    spouse2_last_name: input.spouse2LastName.trim(),
    postal_address: input.postalAddress.trim(),
    comments: input.comments.trim(),
    couple: input.couple.trim(),
    contact_name: input.contactName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    event_date: input.eventDate,
    deposit_amount: parseAmount(input.depositAmount),
    balance_amount: parseAmount(input.balanceAmount),
    deposit_status: "pending",
    balance_status: "to_collect",
    autopilot: input.autopilot,
    message_template: null,
    last_activity: "Créé aujourd'hui",
  }
  const insertPayload = toTablePayload(tableName, payload)

  const { data, error } = await db().from(tableName).insert(insertPayload).select("*").single()
  if (error) {
    throw new Error(`Supabase create failed: ${error.message}`)
  }

  return mapReservationToWedding(data)
}

export async function updateWeddingPaymentStatus(
  weddingId: number,
  field: "deposit" | "balance",
  status: PaymentStatus
) {
  const tableName = await resolveReservationsTableName()
  const rowFilter = await findRowFilter(tableName, weddingId)
  if (!rowFilter) return null

  const patch: ReservationWrite =
    field === "deposit"
      ? { deposit_status: status, last_activity: "Statut acompte mis à jour" }
      : { balance_status: status, last_activity: "Statut solde mis à jour" }
  const updatePayload = toTablePayload(tableName, patch)

  const { data, error } = await db()
    .from(tableName)
    .update(updatePayload)
    .eq(rowFilter.column, rowFilter.value)
    .select("*")
    .maybeSingle()

  if (error) {
    throw new Error(`Supabase status update failed: ${error.message}`)
  }
  if (!data) return null
  return mapReservationToWedding(data)
}

export async function updateWeddingAutopilot(weddingId: number, autopilot: boolean) {
  const tableName = await resolveReservationsTableName()
  const rowFilter = await findRowFilter(tableName, weddingId)
  if (!rowFilter) return null

  if (isLegacyTable(tableName)) {
    const current = await fetchRowByFilter(tableName, rowFilter)
    return current ? mapReservationToWedding(current) : null
  }

  const { data, error } = await db()
    .from(tableName)
    .update({
      autopilot,
      last_activity: "Relance auto mise à jour",
    })
    .eq(rowFilter.column, rowFilter.value)
    .select("*")
    .maybeSingle()

  if (error) {
    throw new Error(`Supabase autopilot update failed: ${error.message}`)
  }
  if (!data) return null
  return mapReservationToWedding(data)
}

export async function updateWedding(weddingId: number, input: UpdateWeddingInput) {
  const tableName = await resolveReservationsTableName()
  const rowFilter = await findRowFilter(tableName, weddingId)
  if (!rowFilter) return null

  const patch: ReservationWrite = {
    last_activity: "Événement modifié",
  }

  if (typeof input.eventType === "string") patch.event_type = input.eventType
  if (typeof input.eventName === "string") patch.event_name = input.eventName.trim()
  if (typeof input.spouse1FirstName === "string") patch.spouse1_first_name = input.spouse1FirstName.trim()
  if (typeof input.spouse1LastName === "string") patch.spouse1_last_name = input.spouse1LastName.trim()
  if (typeof input.spouse2FirstName === "string") patch.spouse2_first_name = input.spouse2FirstName.trim()
  if (typeof input.spouse2LastName === "string") patch.spouse2_last_name = input.spouse2LastName.trim()
  if (typeof input.postalAddress === "string") patch.postal_address = input.postalAddress.trim()
  if (typeof input.comments === "string") patch.comments = input.comments.trim()
  if (typeof input.couple === "string") patch.couple = input.couple.trim()
  if (typeof input.contactName === "string") patch.contact_name = input.contactName.trim()
  if (typeof input.email === "string") patch.email = input.email.trim()
  if (typeof input.phone === "string") patch.phone = input.phone.trim()
  if (typeof input.eventDate === "string") patch.event_date = input.eventDate
  if (typeof input.depositAmount === "string") patch.deposit_amount = parseAmount(input.depositAmount)
  if (typeof input.balanceAmount === "string") patch.balance_amount = parseAmount(input.balanceAmount)
  if (typeof input.autopilot === "boolean") patch.autopilot = input.autopilot
  if (input.depositPaidDate !== undefined) {
    patch.deposit_paid_date = normalizeOptionalDate(input.depositPaidDate)
  }
  if (input.depositPaymentMethod !== undefined) {
    patch.deposit_payment_method = normalizeOptionalPaymentMethod(input.depositPaymentMethod)
  }
  if (input.balancePaidDate !== undefined) {
    patch.balance_paid_date = normalizeOptionalDate(input.balancePaidDate)
  }
  if (input.balancePaymentMethod !== undefined) {
    patch.balance_payment_method = normalizeOptionalPaymentMethod(input.balancePaymentMethod)
  }
  const updatePayload = toTablePayload(tableName, patch)

  const { data, error } = await db()
    .from(tableName)
    .update(updatePayload)
    .eq(rowFilter.column, rowFilter.value)
    .select("*")
    .maybeSingle()

  if (error) {
    throw new Error(`Supabase update failed: ${error.message}`)
  }
  if (!data) return null
  return mapReservationToWedding(data)
}

export async function deleteWedding(weddingId: number) {
  const tableName = await resolveReservationsTableName()
  const rowFilter = await findRowFilter(tableName, weddingId)
  if (!rowFilter) return false

  const { data, error } = await db()
    .from(tableName)
    .delete()
    .eq(rowFilter.column, rowFilter.value)
    .select("*")
    .maybeSingle()

  if (error) {
    throw new Error(`Supabase delete failed: ${error.message}`)
  }
  return Boolean(data)
}

export async function markPostEventReminderSent(weddingId: number, isoCalendarDate: string) {
  const tableName = await resolveReservationsTableName()
  if (isLegacyTable(tableName)) return null

  const rowFilter = await findRowFilter(tableName, weddingId)
  if (!rowFilter) return null

  const day = isoCalendarDate.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null

  const { data, error } = await db()
    .from(tableName)
    .update({
      post_event_reminder_sent_date: day,
      last_activity: "Message J+3 envoyé",
    })
    .eq(rowFilter.column, rowFilter.value)
    .select("*")
    .maybeSingle()

  if (error) {
    throw new Error(`Supabase post-event mark failed: ${error.message}`)
  }
  if (!data) return null
  return mapReservationToWedding(data)
}

/** Colonne unique `status` (legacy) ou chaînes FR / EN depuis Supabase. */
function parsePaymentStatusFlexible(raw: unknown): PaymentStatus | null {
  if (raw === null || raw === undefined) return null
  const trimmed = String(raw).trim()
  if (trimmed === "") return null
  const lower = trimmed.toLowerCase()
  const noAccent = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "")

  if (lower === "paid" || lower === "pending" || lower === "to_collect") {
    return lower as PaymentStatus
  }
  if (noAccent === "paye") return "paid"
  if (noAccent.includes("percevoir")) return "to_collect"
  if (noAccent === "confirme") return "pending"

  return null
}

function resolvePaymentFieldStatus(
  row: ReservationRow,
  field: "deposit" | "balance"
): PaymentStatus {
  const raw =
    field === "deposit"
      ? row.deposit_status ?? (row as { depositStatus?: unknown }).depositStatus
      : row.balance_status ?? (row as { balanceStatus?: unknown }).balanceStatus
  const explicit = parsePaymentStatusFlexible(raw)
  if (explicit !== null) return explicit
  const legacy = parsePaymentStatusFlexible(row.status)
  return legacy ?? "pending"
}

type ReservationRow = {
  id?: number
  event_type?: string | null
  eventType?: string | null
  couple?: string | null
  event_name?: string | null
  eventName?: string | null
  spouse1_first_name?: string | null
  spouse1_last_name?: string | null
  spouse2_first_name?: string | null
  spouse2_last_name?: string | null
  postal_address?: string | null
  comments?: string | null
  contact_name?: string | null
  contactName?: string | null
  client_name?: string | null
  email?: string | null
  client_email?: string | null
  phone?: string | null
  event_date?: string | null
  eventDate?: string | null
  /** Table legacy : un seul statut global (payé / confirmé / à percevoir). */
  status?: string | null
  deposit_amount?: number | string | null
  depositAmount?: number | string | null
  balance_amount?: number | string | null
  balanceAmount?: number | string | null
  deposit_status?: PaymentStatus | string | null
  balance_status?: PaymentStatus | string | null
  deposit_paid_date?: string | null
  deposit_payment_method?: string | null
  balance_paid_date?: string | null
  balance_payment_method?: string | null
  post_event_reminder_sent_date?: string | null
  autopilot?: boolean | null
  last_activity?: string | null
  lastActivity?: string | null
  created_at?: string | null
  message_template?: string | null
}

type ReservationWrite = {
  event_type?: EventType
  event_name?: string
  spouse1_first_name?: string
  spouse1_last_name?: string
  spouse2_first_name?: string
  spouse2_last_name?: string
  postal_address?: string
  comments?: string
  couple?: string
  contact_name?: string
  email?: string
  phone?: string
  event_date?: string
  deposit_amount?: number
  balance_amount?: number
  deposit_status?: PaymentStatus
  balance_status?: PaymentStatus
  deposit_paid_date?: string | null
  deposit_payment_method?: string | null
  balance_paid_date?: string | null
  balance_payment_method?: string | null
  autopilot?: boolean
  message_template?: string | null
  last_activity?: string
}

function mapReservationToWedding(row: ReservationRow, index: number): Wedding {
  const eventDate = row.event_date ?? row.eventDate ?? row.created_at ?? ""
  const contactName = row.contact_name ?? row.contactName ?? row.client_name ?? ""
  const email = row.email ?? row.client_email ?? ""
  const coupleFallback = contactName || email || `Réservation ${index + 1}`
  const stableId = resolveWeddingId(row, index)

  return {
    id: stableId,
    eventType: parseEventType(row.event_type ?? row.eventType),
    ...mapReservationDetails(row),
    ...mapReservationPaymentTracking(row),
    couple: row.couple ?? coupleFallback,
    contactName,
    email,
    phone: row.phone ?? "",
    eventDate,
    deposit: {
      amount: toEuroAmount(row.deposit_amount ?? row.depositAmount),
      status: resolvePaymentFieldStatus(row, "deposit"),
    },
    balance: {
      amount: toEuroAmount(row.balance_amount ?? row.balanceAmount),
      status: resolvePaymentFieldStatus(row, "balance"),
    },
    autopilot: row.autopilot ?? false,
    lastActivity: row.last_activity ?? row.lastActivity ?? "Synchronisé depuis Supabase",
    postEventReminderSentDate: normalizeStoredDate(row.post_event_reminder_sent_date),
  }
}

function mapReservationPaymentTracking(row: ReservationRow): WeddingPaymentTracking {
  return {
    depositPaidDate: normalizeStoredDate(row.deposit_paid_date),
    depositPaymentMethod: parsePaymentMethod(row.deposit_payment_method),
    balancePaidDate: normalizeStoredDate(row.balance_paid_date),
    balancePaymentMethod: parsePaymentMethod(row.balance_payment_method),
  }
}

function normalizeStoredDate(raw: string | null | undefined): string {
  if (!raw) return ""
  return raw.slice(0, 10)
}

function normalizeOptionalDate(raw: string | null): string | null {
  const trimmed = raw?.trim() ?? ""
  if (!trimmed) return null
  return trimmed.slice(0, 10)
}

function normalizeOptionalPaymentMethod(raw: PaymentMethod | ""): string | null {
  const method = parsePaymentMethod(raw)
  return method || null
}

function mapReservationDetails(row: ReservationRow): WeddingDetailFields {
  return {
    eventName: row.event_name ?? row.eventName ?? "",
    spouse1FirstName: row.spouse1_first_name ?? "",
    spouse1LastName: row.spouse1_last_name ?? "",
    spouse2FirstName: row.spouse2_first_name ?? "",
    spouse2LastName: row.spouse2_last_name ?? "",
    postalAddress: row.postal_address ?? "",
    comments: row.comments ?? "",
  }
}

function toEuroAmount(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "0 €"
  const numeric =
    typeof value === "number"
      ? value
      : Number.parseFloat(String(value).replace(/[^\d,.-]/g, "").replace(",", "."))
  if (!Number.isFinite(numeric)) return "0 €"
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(numeric))} €`
}

function parseAmount(value: string) {
  const numeric = Number.parseFloat(value.replace(",", "."))
  return Number.isFinite(numeric) ? numeric : 0
}

function resolveWeddingId(row: ReservationRow, index: number) {
  if (typeof row.id === "number") return row.id
  const email = row.email ?? row.client_email
  if (email) return stableHash(email)
  return 1_000_000 + index
}

async function resolveReservationsTableName() {
  const tableCandidates = resolvedTableName
    ? [resolvedTableName]
    : ["reservations", "Réservation Capbat"]

  let lastErrorMessage = "unknown error"

  for (const tableName of tableCandidates) {
    const { error } = await db().from(tableName).select("*").limit(1)
    if (error) {
      lastErrorMessage = error.message
      continue
    }
    resolvedTableName = tableName
    return tableName
  }

  throw new Error(`Supabase list failed: ${lastErrorMessage}`)
}

async function findRowFilter(tableName: string, weddingId: number) {
  const { data, error } = await db().from(tableName).select("*")
  if (error) {
    throw new Error(`Supabase row lookup failed: ${error.message}`)
  }

  for (const row of data ?? []) {
    const typed = row as ReservationRow
    if (typeof typed.id === "number" && typed.id === weddingId) {
      return { column: "id", value: weddingId }
    }

    const email = typed.email ?? typed.client_email
    if (email && stableHash(email) === weddingId) {
      return {
        column: typed.email ? "email" : "client_email",
        value: email,
      }
    }
  }

  return null
}

function stableHash(input: string) {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

function isLegacyTable(tableName: string) {
  return tableName.toLowerCase() !== "reservations"
}

function toTablePayload(tableName: string, payload: ReservationWrite) {
  if (!isLegacyTable(tableName)) return payload

  const statusFromPayments = payload.deposit_status ?? payload.balance_status
  const legacy: Record<string, string | number | boolean | null> = {}
  if (typeof payload.contact_name === "string") legacy.client_name = payload.contact_name
  if (typeof payload.email === "string") legacy.client_email = payload.email
  if (typeof payload.event_date === "string") legacy.event_date = payload.event_date
  legacy.status =
    statusFromPayments === "paid"
      ? "payé"
      : statusFromPayments === "to_collect"
      ? "à percevoir"
      : "confirmé"
  return legacy
}

async function fetchRowByFilter(
  tableName: string,
  rowFilter: { column: string; value: string | number }
) {
  const { data, error } = await db()
    .from(tableName)
    .select("*")
    .eq(rowFilter.column, rowFilter.value)
    .maybeSingle()

  if (error) {
    throw new Error(`Supabase row fetch failed: ${error.message}`)
  }
  return (data as ReservationRow | null) ?? null
}
