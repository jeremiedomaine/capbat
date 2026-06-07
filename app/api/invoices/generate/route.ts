import { NextResponse } from "next/server"
import { gateInternalToolAccess } from "@/lib/auth/internal-session"
import { generateInvoicesForWeddings } from "@/lib/invoice-generate"
import { buildIssuerFromSettings } from "@/lib/invoice-issuer"
import type { InvoiceParty, InvoiceType } from "@/lib/invoice-types"
import { getWorkspaceSettings } from "@/lib/workspace-settings-store"

export async function POST(request: Request) {
  try {
    const denied = await gateInternalToolAccess()
    if (denied) return denied

    const body = (await request.json()) as {
      types?: InvoiceType[]
      weddingIds?: number[]
      issuer?: InvoiceParty
      vatRate?: number
      dueInDays?: number
    }

    const settings = await getWorkspaceSettings()
    const template = settings.invoiceTemplate
    const issuer = body.issuer?.name && body.issuer.email
      ? body.issuer
      : buildIssuerFromSettings(settings)

    if (!issuer.name || !issuer.email) {
      return NextResponse.json(
        { error: "Les coordonnées de l'émetteur (nom, e-mail) sont obligatoires." },
        { status: 400 }
      )
    }

    const types = body.types?.length ? body.types : (["deposit", "balance"] as InvoiceType[])
    const result = await generateInvoicesForWeddings({
      types,
      weddingIds: body.weddingIds,
      issuer,
      vatRate: body.vatRate ?? template.defaultVatRate,
      dueInDays: body.dueInDays ?? template.defaultDueDays,
      template,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
