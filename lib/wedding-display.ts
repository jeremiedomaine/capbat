import { isWeddingEventType, type EventType } from "@/lib/event-types"

type SpouseInput = {
  eventType: EventType
  eventName: string
  spouse1FirstName: string
  spouse2FirstName: string
  contactName?: string
}

export function buildDashboardCouple(input: SpouseInput): string {
  if (isWeddingEventType(input.eventType)) {
    const first = input.spouse1FirstName.trim()
    const second = input.spouse2FirstName.trim()
    if (first && second) return `${first} & ${second}`
    if (first) return first
    if (second) return second
  }
  return input.eventName.trim()
}

export function buildPrimaryContactName(input: {
  eventType: EventType
  spouse1FirstName: string
  spouse1LastName: string
  contactName?: string
}): string {
  if (isWeddingEventType(input.eventType)) {
    return [input.spouse1FirstName, input.spouse1LastName]
      .map((part) => part.trim())
      .filter(Boolean)
      .join(" ")
  }
  return input.contactName?.trim() ?? ""
}

export function formatSpouseName(firstName: string, lastName: string): string {
  return [firstName, lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
}
