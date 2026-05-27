import type { PaymentMethod } from "@/lib/payment-methods"

export type WeddingPaymentTracking = {
  depositPaidDate: string
  depositPaymentMethod: PaymentMethod | ""
  balancePaidDate: string
  balancePaymentMethod: PaymentMethod | ""
}

export const EMPTY_WEDDING_PAYMENT_TRACKING: WeddingPaymentTracking = {
  depositPaidDate: "",
  depositPaymentMethod: "",
  balancePaidDate: "",
  balancePaymentMethod: "",
}
