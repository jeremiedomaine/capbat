import { buildLineItemsFromTemplate, type InvoiceTemplate } from "@/lib/invoice-template"
import { listWeddings, type Wedding } from "@/lib/weddings-store"
import { createInvoice, findInvoiceByWeddingAndType } from "@/lib/invoices-store"
import type { CreateInvoiceInput, Invoice, InvoiceParty, InvoiceType } from "@/lib/invoice-types"
import {
  addCalendarDays,
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
  template?: InvoiceTemplate
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
      const template = options.template
      const lineItems = template
        ? buildLineItemsFromTemplate(
            type,
            {
              couple: wedding.couple,
              eventDate: wedding.eventDate,
              eventType: wedding.eventType,
              eventName: wedding.eventName,
            },
            template,
            depositAmount,
            balanceAmount
          )
        : buildLineItemsFallback(
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
    addressLine: wedding.postalAddress || undefined,
  }
}

function buildLineItemsFallback(
  type: InvoiceType,
  couple: string,
  eventDate: string,
  depositAmount: number,
  balanceAmount: number
) {
  const eventLabel = eventDate ? ` — ${formatEventDate(eventDate)}` : ""
  if (type === "deposit") {
    return [{ label: `Acompte — ${couple}${eventLabel}`, quantity: 1, unitPrice: depositAmount, kind: "standard" as const }]
  }
  if (type === "balance") {
    return [{ label: `Solde — ${couple}${eventLabel}`, quantity: 1, unitPrice: balanceAmount, kind: "standard" as const }]
  }
  return [
    {
      label: `Prestation complète — ${couple}${eventLabel}`,
      quantity: 1,
      unitPrice: depositAmount + balanceAmount,
      kind: "standard" as const,
    },
  ]
}

function formatEventDate(value: string) {
  const key = value.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return value
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${key}T12:00:00`))
}
