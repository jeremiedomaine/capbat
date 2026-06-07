import { Sidebar } from "@/components/sidebar"
import { PerformanceDashboard } from "@/components/performance-dashboard"

export default function PerformancePage() {
  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto space-y-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
              Performance
            </h1>
            <p className="text-sm text-gray-500">
              Vue saisonnière de la trésorerie, de l&apos;activité et des encaissements.
            </p>
          </header>
          <PerformanceDashboard />
        </div>
      </main>
    </div>
  )
}

