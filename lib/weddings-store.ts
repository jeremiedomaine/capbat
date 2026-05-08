import { getSupabaseAdmin } from "@/lib/supabase/admin"

const db = () => getSupabaseAdmin()

export type Wedding = {
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

export type PaymentStatus = "pending" | "paid" | "to_collect"

export type NewWeddingInput = {
  couple: string
  contactName: string
  email: string
  phone: string
  eventDate: string
  depositAmount: string
  balanceAmount: string
  autopilot: boolean
}

export type UpdateWeddingInput = {
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

  if (typeof input.couple === "string") patch.couple = input.couple.trim()
  if (typeof input.contactName === "string") patch.contact_name = input.contactName.trim()
  if (typeof input.email === "string") patch.email = input.email.trim()
  if (typeof input.phone === "string") patch.phone = input.phone.trim()
  if (typeof input.eventDate === "string") patch.event_date = input.eventDate
  if (typeof input.depositAmount === "string") patch.deposit_amount = parseAmount(input.depositAmount)
  if (typeof input.balanceAmount === "string") patch.balance_amount = parseAmount(input.balanceAmount)
  if (typeof input.autopilot === "boolean") patch.autopilot = input.autopilot
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

function normalizeStatus(status?: PaymentStatus, paid?: boolean): PaymentStatus {
  if (status) return status
  if (typeof paid === "boolean") return paid ? "paid" : "pending"
  return "pending"
}

type ReservationRow = {
  id?: number
  couple?: string | null
  contact_name?: string | null
  contactName?: string | null
  client_name?: string | null
  email?: string | null
  client_email?: string | null
  phone?: string | null
  event_date?: string | null
  eventDate?: string | null
  deposit_amount?: number | string | null
  depositAmount?: number | string | null
  balance_amount?: number | string | null
  balanceAmount?: number | string | null
  deposit_status?: PaymentStatus | null
  balance_status?: PaymentStatus | null
  autopilot?: boolean | null
  last_activity?: string | null
  lastActivity?: string | null
  created_at?: string | null
  message_template?: string | null
}

type ReservationWrite = {
  couple?: string
  contact_name?: string
  email?: string
  phone?: string
  event_date?: string
  deposit_amount?: number
  balance_amount?: number
  deposit_status?: PaymentStatus
  balance_status?: PaymentStatus
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
    couple: row.couple ?? coupleFallback,
    contactName,
    email,
    phone: row.phone ?? "",
    eventDate,
    deposit: {
      amount: toEuroAmount(row.deposit_amount ?? row.depositAmount),
      status: normalizeStatus(row.deposit_status ?? undefined),
    },
    balance: {
      amount: toEuroAmount(row.balance_amount ?? row.balanceAmount),
      status: normalizeStatus(row.balance_status ?? undefined),
    },
    autopilot: row.autopilot ?? false,
    lastActivity: row.last_activity ?? row.lastActivity ?? "Synchronisé depuis Supabase",
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
