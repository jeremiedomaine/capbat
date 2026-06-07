import { NextResponse } from "next/server"
import { gateInternalToolAccess } from "@/lib/auth/internal-session"
import { isWeddingEventType, parseEventType, requiresContactName } from "@/lib/event-types"
import { countActiveAutomationsByEventIds, seedDefaultAssignmentsForEvent } from "@/lib/event-automations-store"
import { generateInvoicesForWeddings } from "@/lib/invoice-generate"
import { buildIssuerFromSettings } from "@/lib/invoice-issuer"
import { getWorkspaceSettings } from "@/lib/workspace-settings-store"
import { createWedding, listWeddings } from "@/lib/weddings-store"

export async function GET() {
  try {
    const denied = await gateInternalToolAccess()
    if (denied) return denied
    const weddings = await listWeddings()
    const counts = await countActiveAutomationsByEventIds(weddings.map((w) => w.id))
    const enriched = weddings.map((w) => ({
      ...w,
      activeAutomationCount: counts.get(w.id) ?? 0,
    }))
    return NextResponse.json({ weddings: enriched })
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
      generateInvoices?: boolean
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

    if (requiresContactName(eventType) && !body.contactName?.trim()) {
      return NextResponse.json({ error: "Le nom du contact est obligatoire." }, { status: 400 })
    }

    if (
      isWeddingEventType(eventType) &&
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

    const activateDefaults = body.autopilot ?? true
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
      autopilot: activateDefaults,
    })

    await seedDefaultAssignmentsForEvent(created.id, created.eventType, activateDefaults)
    const counts = await countActiveAutomationsByEventIds([created.id])

    const settings = await getWorkspaceSettings()
    const shouldGenerateInvoices =
      body.generateInvoices ?? settings.invoiceTemplate.autoGenerateOnEventCreate

    let invoicesCreated = 0
    if (shouldGenerateInvoices) {
      const result = await generateInvoicesForWeddings({
        types: ["deposit", "balance"],
        weddingIds: [created.id],
        issuer: buildIssuerFromSettings(settings),
        vatRate: settings.invoiceTemplate.defaultVatRate,
        dueInDays: settings.invoiceTemplate.defaultDueDays,
        template: settings.invoiceTemplate,
      })
      invoicesCreated = result.created.length
    }

    return NextResponse.json(
      {
        wedding: {
          ...created,
          activeAutomationCount: counts.get(created.id) ?? 0,
        },
        invoicesCreated,
      },
      { status: 201 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur interne"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
