export type EventType = "wedding" | "gite" | "other"

export const EVENT_TYPES: EventType[] = ["wedding", "gite", "other"]

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  wedding: "Mariage",
  gite: "Gîte",
  other: "Autre événement",
}

export function parseEventType(raw: unknown): EventType {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase()
  if (value === "gite" || value === "gîte" || value === "gites") return "gite"
  if (value === "other" || value === "autre") return "other"
  return "wedding"
}

export function isEventType(value: string): value is EventType {
  return EVENT_TYPES.includes(value as EventType)
}

export function isWeddingEventType(eventType: EventType): boolean {
  return eventType === "wedding"
}

export function requiresContactName(eventType: EventType): boolean {
  return eventType !== "wedding"
}

export function getEventTypeBadgeClass(eventType: EventType): string {
  switch (eventType) {
    case "wedding":
      return "border-rose-200 bg-rose-50 text-rose-700"
    case "gite":
      return "border-sky-200 bg-sky-50 text-sky-700"
    case "other":
      return "border-gray-200 bg-gray-100 text-gray-600"
  }
}

export function getEventNameLabel(eventType: EventType): string {
  return isWeddingEventType(eventType) ? "Couple" : "Nom de l'événement"
}

export function getEventNamePlaceholder(eventType: EventType): string {
  switch (eventType) {
    case "wedding":
      return "Ex: Laura & Mehdi"
    case "gite":
      return "Ex: Gîte Les Roches — semaine du 12 août"
    case "other":
      return "Ex: Séminaire entreprise ACME"
  }
}

export function getNewEventNamePlaceholder(eventType: EventType): string {
  switch (eventType) {
    case "wedding":
      return "Ex: Mariage Laura & Mehdi"
    case "gite":
      return "Ex: Gîte Les Roches — famille Dupont"
    case "other":
      return "Ex: Séminaire entreprise ACME"
  }
}

export function getEventDateLabel(_eventType?: EventType): string {
  return "Date"
}
