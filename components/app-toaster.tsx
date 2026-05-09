"use client"

import { Toaster } from "sonner"

/** Toasts globaux (succès / erreur) — compatible sans ThemeProvider. */
export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "font-sans border-gray-200 shadow-lg",
          title: "font-medium",
          description: "text-gray-600",
        },
      }}
    />
  )
}
