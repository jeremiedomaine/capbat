import Link from "next/link"
import { Sidebar } from "@/components/sidebar"
import { WeddingsTable } from "@/components/weddings-table"
import { Button } from "@/components/ui/button"

export default function EventsPage() {
  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto space-y-6">
          <header className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-gray-900">Liste des Événements</h1>
              <p className="text-sm text-gray-500">
                Retrouvez ici tous vos événements planifiés, filtrables par année (saison). Cliquez
                sur un événement pour ouvrir sa fiche détaillée.
              </p>
            </div>
            <Button
              asChild
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm h-9 px-4 shadow-sm shrink-0"
            >
              <Link href="/evenements/nouveau">+ Nouvel événement</Link>
            </Button>
          </header>
          <WeddingsTable mode="list" />
        </div>
      </main>
    </div>
  )
}
