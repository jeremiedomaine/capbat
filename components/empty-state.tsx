import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description: string
  children?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-8 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-100">
        <Icon className="h-7 w-7 text-gray-400" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-500">{description}</p>
      {children ? <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{children}</div> : null}
    </div>
  )
}
