import { Sidebar } from "@/components/sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { KpiCards } from "@/components/kpi-cards"
import { WeddingsTable } from "@/components/weddings-table"

export default function Page() {
  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto space-y-8">
          <DashboardHeader />
          <KpiCards />
          <WeddingsTable />
        </div>
      </main>
    </div>
  )
}
