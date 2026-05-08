import { Sidebar } from "@/components/sidebar"
import { WeddingsTable } from "@/components/weddings-table"

export default function EventsPage() {
  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto space-y-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold text-gray-900">Liste des Événements</h1>
            <p className="text-sm text-gray-500">
              Retrouvez ici tous les prochains mariages planifies.
            </p>
          </header>
          <WeddingsTable />
        </div>
      </main>
    </div>
  )
}
