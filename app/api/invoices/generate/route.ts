import { NextResponse } from "next/server"
import { gateInternalToolAccess } from "@/lib/auth/internal-session"
import { generateInvoicesForWeddings } from "@/lib/invoice-generate"
import type { InvoiceParty, InvoiceType } from "@/lib/invoice-types"

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

    if (!body.issuer?.name || !body.issuer.email) {
      return NextResponse.json(
        { error: "Les coordonnées de l'émetteur (nom, e-mail) sont obligatoires." },
        { status: 400 }
      )
    }

    const types = body.types?.length ? body.types : (["deposit", "balance"] as InvoiceType[])
    const result = await generateInvoicesForWeddings({
      types,
      weddingIds: body.weddingIds,
      issuer: body.issuer,
      vatRate: body.vatRate,
      dueInDays: body.dueInDays,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
