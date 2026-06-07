/** Affichage J±N pour l'UI. */
export function formatDayOffset(dayOffset: number): string {
  if (dayOffset === 0) return "J"
  if (dayOffset < 0) return `J${dayOffset}`
  return `J+${dayOffset}`
}

export function dayOffsetLabel(dayOffset: number): "before" | "after" {
  return dayOffset < 0 ? "before" : "after"
}

export function dayOffsetSectionLabel(dayOffset: number): string {
  return dayOffset < 0 ? "Avant l'événement" : "Après l'événement"
}
