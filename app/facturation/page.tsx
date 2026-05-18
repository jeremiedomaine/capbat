import { Sidebar } from "@/components/sidebar"
import { BillingDashboard } from "@/components/billing-dashboard"

export default function FacturationPage() {
  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto space-y-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold text-gray-900">Facturation</h1>
            <p className="text-sm text-gray-500">
              Gérez vos factures, générez les brouillons automatiquement et exportez les PDF.
            </p>
          </header>
          <BillingDashboard />
        </div>
      </main>
    </div>
  )
}
