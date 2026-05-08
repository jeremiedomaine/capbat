import { NextResponse } from "next/server"
import { gateInternalToolAccess } from "@/lib/auth/internal-session"
import { createWedding, listWeddings } from "@/lib/weddings-store"

export async function GET() {
  try {
    const denied = await gateInternalToolAccess()
    if (denied) return denied
    const weddings = await listWeddings()
    return NextResponse.json({ weddings })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message, weddings: [] }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const denied = await gateInternalToolAccess()
    if (denied) return denied
    const body = (await request.json()) as {
      couple?: string
      contactName?: string
      email?: string
      phone?: string
      eventDate?: string
      depositAmount?: string
      balanceAmount?: string
      autopilot?: boolean
    }

    if (
      !body.couple ||
      !body.contactName ||
      !body.email ||
      !body.phone ||
      !body.eventDate ||
      !body.depositAmount ||
      !body.balanceAmount
    ) {
      return NextResponse.json(
        {
          error:
            "Les champs couple, nom du contact, email, téléphone, date, acompte et solde sont obligatoires.",
        },
        { status: 400 }
      )
    }

    const created = await createWedding({
      couple: body.couple,
      contactName: body.contactName,
      email: body.email,
      phone: body.phone,
      eventDate: body.eventDate,
      depositAmount: body.depositAmount,
      balanceAmount: body.balanceAmount,
      autopilot: body.autopilot ?? true,
    })

    return NextResponse.json({ wedding: created }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
