"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

export function DashboardHeader() {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight text-balance">
          Vue d&apos;ensemble financière
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Suivi des acomptes et relances automatiques.
        </p>
      </div>
      <Button
        asChild
        className="bg-blue-600 hover:bg-blue-700 text-white text-sm h-9 px-4 shadow-sm"
      >
        <Link href="/evenements/nouveau">+ Nouvel événement</Link>
      </Button>
    </div>
  )
}
