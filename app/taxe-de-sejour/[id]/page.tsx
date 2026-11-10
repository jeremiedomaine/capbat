import { Sidebar } from "@/components/sidebar"
import { TouristTaxEditor } from "@/components/tourist-tax-editor"

type Props = {
  params: Promise<{ id: string }>
}

export default async function TouristTaxEditPage({ params }: Props) {
  const { id } = await params

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-8">
          <TouristTaxEditor invoiceId={id} />
        </div>
      </main>
    </div>
  )
}
