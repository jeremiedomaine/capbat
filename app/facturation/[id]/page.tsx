import { Sidebar } from "@/components/sidebar"
import { InvoiceEditor } from "@/components/invoice-editor"

type Props = {
  params: Promise<{ id: string }>
}

export default async function InvoiceEditPage({ params }: Props) {
  const { id } = await params

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto">
          <InvoiceEditor invoiceId={id} />
        </div>
      </main>
    </div>
  )
}
