import { Sidebar } from "@/components/sidebar"
import { TouristTaxReport } from "@/components/tourist-tax-report"

export default function TouristTaxPage() {
  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-5xl mx-auto space-y-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold text-gray-900">Taxe de séjour</h1>
            <p className="text-sm text-gray-500">
              Totaux mensuels des mariages et gîtes, pour la déclaration à l&apos;agglo.
            </p>
          </header>
          <TouristTaxReport />
        </div>
      </main>
    </div>
  )
}
