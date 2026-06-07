"use client"

import { Sidebar } from "@/components/sidebar"
import { AutomationsWorkspace } from "@/components/automations-workspace"

export default function AutomatisationsPage() {
  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-6xl mx-auto">
          <AutomationsWorkspace />
        </div>
      </main>
    </div>
  )
}
