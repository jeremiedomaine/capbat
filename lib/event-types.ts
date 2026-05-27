export type EventType = "wedding" | "other"

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  wedding: "Mariage",
  other: "Autre événement",
}

export function parseEventType(raw: unknown): EventType {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase()
  if (value === "other" || value === "autre") return "other"
  return "wedding"
}

export function getEventNameLabel(eventType: EventType): string {
  return eventType === "wedding" ? "Couple" : "Nom de l'événement"
}

export function getEventNamePlaceholder(eventType: EventType): string {
  return eventType === "wedding" ? "Ex: Laura & Mehdi" : "Ex: Séminaire entreprise ACME"
}

export function getEventDateLabel(_eventType?: EventType): string {
  return "Date"
}
