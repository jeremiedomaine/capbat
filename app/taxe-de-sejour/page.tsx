import { Sidebar } from "@/components/sidebar"
import { TouristTaxDashboard } from "@/components/tourist-tax-dashboard"

export default function TouristTaxPage() {
  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl space-y-6 p-8">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold text-gray-900">Taxe de séjour</h1>
            <p className="text-sm text-gray-500">
              Factures liées aux événements — 1,52&nbsp;€ / adulte / nuitée, numérotation TDS.
            </p>
          </header>
          <TouristTaxDashboard />
        </div>
      </main>
    </div>
  )
}
