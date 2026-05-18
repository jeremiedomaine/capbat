import { listWeddings, type Wedding } from "@/lib/weddings-store"
import { createInvoice, findInvoiceByWeddingAndType } from "@/lib/invoices-store"
import type { CreateInvoiceInput, Invoice, InvoiceParty, InvoiceType } from "@/lib/invoice-types"
import {
  addCalendarDays,
  buildLineItemsForType,
  lineItemsTotal,
  parseEuroAmount,
  todayIsoDate,
} from "@/lib/invoice-utils"

export type GenerateInvoicesOptions = {
  types: InvoiceType[]
  weddingIds?: number[]
  issuer: InvoiceParty
  vatRate?: number
  dueInDays?: number
}

export type GenerateInvoicesResult = {
  created: Invoice[]
  skipped: { weddingId: number; couple: string; type: InvoiceType; reason: string }[]
}

export async function generateInvoicesForWeddings(
  options: GenerateInvoicesOptions
): Promise<GenerateInvoicesResult> {
  const weddings = await listWeddings()
  const targetIds = options.weddingIds?.length
    ? new Set(options.weddingIds)
    : null
  const filtered = targetIds
    ? weddings.filter((w) => targetIds.has(w.id))
    : weddings

  const created: Invoice[] = []
  const skipped: GenerateInvoicesResult["skipped"] = []
  const dueInDays = options.dueInDays ?? 30
  const issuedAt = todayIsoDate()
  const dueAt = addCalendarDays(issuedAt, dueInDays)

  for (const wedding of filtered) {
    for (const type of options.types) {
      const amount = resolveAmountForType(wedding, type)
      if (amount <= 0) {
        skipped.push({
          weddingId: wedding.id,
          couple: wedding.couple,
          type,
          reason: "Montant nul ou indisponible.",
        })
        continue
      }

      const existing = await findInvoiceByWeddingAndType(wedding.id, type)
      if (existing) {
        skipped.push({
          weddingId: wedding.id,
          couple: wedding.couple,
          type,
          reason: `Facture existante (${existing.number}).`,
        })
        continue
      }

      const depositAmount = parseEuroAmount(wedding.deposit.amount)
      const balanceAmount = parseEuroAmount(wedding.balance.amount)
      const lineItems = buildLineItemsForType(
        type,
        wedding.couple,
        wedding.eventDate,
        depositAmount,
        balanceAmount
      )

      const input: CreateInvoiceInput = {
        weddingId: wedding.id,
        couple: wedding.couple,
        type,
        amountTtc: lineItemsTotal(lineItems),
        lineItems,
        issuer: options.issuer,
        client: weddingToClientParty(wedding),
        issuedAt,
        dueAt,
        vatRate: options.vatRate ?? 20,
        status: "draft",
      }

      try {
        const invoice = await createInvoice(input)
        created.push(invoice)
      } catch (err) {
        skipped.push({
          weddingId: wedding.id,
          couple: wedding.couple,
          type,
          reason: err instanceof Error ? err.message : "Création impossible.",
        })
      }
    }
  }

  return { created, skipped }
}

function resolveAmountForType(wedding: Wedding, type: InvoiceType): number {
  const deposit = parseEuroAmount(wedding.deposit.amount)
  const balance = parseEuroAmount(wedding.balance.amount)
  if (type === "deposit") return deposit
  if (type === "balance") return balance
  return deposit + balance
}

function weddingToClientParty(wedding: Wedding): InvoiceParty {
  return {
    name: wedding.couple,
    contactName: wedding.contactName,
    email: wedding.email,
    phone: wedding.phone,
  }
}
