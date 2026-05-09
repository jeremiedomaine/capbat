"use client"

import { Bell } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function DashboardHeader() {
  const latestNotifications = [
    {
      id: "n1",
      title: "Acompte recu",
      description: "Sophie Martin a regle 1 200 EUR pour Mariage - 12 juin.",
      time: "il y a 6 min",
    },
    {
      id: "n2",
      title: "Relance envoyee",
      description: "Email de rappel automatique envoye a Lucas Bernard.",
      time: "il y a 28 min",
    },
    {
      id: "n3",
      title: "Evenement confirme",
      description: "Le devis de Anniversaire - Emma (4 mai) vient d'etre valide.",
      time: "il y a 1 h",
    },
  ]

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
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="relative w-9 h-9 border-gray-200 text-gray-500">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span className="sr-only">Notifications</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            <DropdownMenuLabel className="px-4 py-3 text-sm font-semibold text-gray-900">
              Dernieres notifications
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="py-1">
              {latestNotifications.map((notification) => (
                <div key={notification.id} className="px-4 py-2.5 hover:bg-gray-50">
                  <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{notification.description}</p>
                  <p className="mt-1 text-[11px] text-gray-400">{notification.time}</p>
                </div>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          asChild
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm h-9 px-4 shadow-sm"
        >
          <Link href="/evenements/nouveau">+ Nouvel événement</Link>
        </Button>
      </div>
    </div>
  )
}
