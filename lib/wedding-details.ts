export type WeddingDetailFields = {
  eventName: string
  spouse1FirstName: string
  spouse1LastName: string
  spouse2FirstName: string
  spouse2LastName: string
  spouse1Phone: string
  spouse2Phone: string
  postalAddress: string
  comments: string
}

export const EMPTY_WEDDING_DETAILS: WeddingDetailFields = {
  eventName: "",
  spouse1FirstName: "",
  spouse1LastName: "",
  spouse2FirstName: "",
  spouse2LastName: "",
  spouse1Phone: "",
  spouse2Phone: "",
  postalAddress: "",
  comments: "",
}

export type WeddingDetailInput = WeddingDetailFields & {
  contactName?: string
}
