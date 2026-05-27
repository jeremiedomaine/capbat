import { NextResponse } from "next/server"
import { gateInternalToolAccess } from "@/lib/auth/internal-session"
import { parseEventType } from "@/lib/event-types"
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
      eventType?: string
      eventName?: string
      spouse1FirstName?: string
      spouse1LastName?: string
      spouse2FirstName?: string
      spouse2LastName?: string
      postalAddress?: string
      comments?: string
      couple?: string
      contactName?: string
      email?: string
      phone?: string
      eventDate?: string
      depositAmount?: string
      balanceAmount?: string
      autopilot?: boolean
    }

    const eventType = parseEventType(body.eventType)

    if (
      !body.eventName?.trim() ||
      !body.couple?.trim() ||
      !body.email ||
      !body.phone ||
      !body.eventDate ||
      !body.depositAmount ||
      !body.balanceAmount
    ) {
      return NextResponse.json(
        {
          error:
            "Les champs nom de l'événement, libellé tableau, email, téléphone, date, acompte et solde sont obligatoires.",
        },
        { status: 400 }
      )
    }

    if (eventType === "other" && !body.contactName?.trim()) {
      return NextResponse.json({ error: "Le nom du contact est obligatoire." }, { status: 400 })
    }

    if (
      eventType === "wedding" &&
      (!body.spouse1FirstName?.trim() ||
        !body.spouse1LastName?.trim() ||
        !body.spouse2FirstName?.trim() ||
        !body.spouse2LastName?.trim())
    ) {
      return NextResponse.json(
        { error: "Les prénoms et noms des deux mariés sont obligatoires." },
        { status: 400 }
      )
    }

    const created = await createWedding({
      eventType,
      eventName: body.eventName,
      spouse1FirstName: body.spouse1FirstName ?? "",
      spouse1LastName: body.spouse1LastName ?? "",
      spouse2FirstName: body.spouse2FirstName ?? "",
      spouse2LastName: body.spouse2LastName ?? "",
      postalAddress: body.postalAddress ?? "",
      comments: body.comments ?? "",
      couple: body.couple,
      contactName: body.contactName ?? "",
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
