"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, LineChart, CalendarHeart, Zap, Settings, LogOut, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { getPublicAppName } from "@/lib/branding-public"
import {
  getStoredCompanyName,
  getStoredManagerName,
  PROFILE_EVENTS,
} from "@/lib/profile-local-storage"

const navItems = [
  { label: "Tableau de bord", icon: LayoutDashboard, href: "/" },
  { label: "Performance", icon: LineChart, href: "/performance" },
  { label: "Liste des Événements", icon: CalendarHeart, href: "/evenements" },
  { label: "Automatisations", icon: Zap, href: "/automatisations" },
  { label: "Paramètres", icon: Settings, href: "/parametres" },
]

export function Sidebar() {
  const pathname = usePathname()
  const [managerName, setManagerName] = useState("Marie Clément")
  const [companyName, setCompanyName] = useState("Domaine des Roses")
  const [logoutPending, setLogoutPending] = useState(false)

  useEffect(() => {
    const applyProfile = () => {
      const managerFromStorage = getStoredManagerName()
      const companyFromStorage = getStoredCompanyName()
      setManagerName(managerFromStorage?.trim() || "Marie Clément")
      setCompanyName(companyFromStorage?.trim() || "Domaine des Roses")
    }

    applyProfile()
    window.addEventListener(PROFILE_EVENTS.manager, applyProfile)
    window.addEventListener(PROFILE_EVENTS.company, applyProfile)
    window.addEventListener("storage", applyProfile)
    return () => {
      window.removeEventListener(PROFILE_EVENTS.manager, applyProfile)
      window.removeEventListener(PROFILE_EVENTS.company, applyProfile)
      window.removeEventListener("storage", applyProfile)
    }
  }, [])

  const handleLogout = async () => {
    setLogoutPending(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()
      if (error) {
        toast.error("Déconnexion impossible", { description: error.message })
        return
      }
      window.location.href = "/login"
    } catch {
      toast.error("Déconnexion impossible", {
        description: "Une erreur réseau est survenue.",
      })
    } finally {
      setLogoutPending(false)
    }
  }

  const managerInitials = useMemo(() => {
    const parts = managerName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
    if (!parts.length) return "MC"
    return parts.map((part) => part[0]?.toUpperCase() ?? "").join("")
  }, [managerName])

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-gray-100 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <CalendarHeart className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-semibold text-gray-900 tracking-tight">
            {getPublicAppName()}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive =
            item.href !== "#" &&
            (pathname === item.href || pathname.startsWith(`${item.href}/`))

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 shrink-0",
                  isActive ? "text-blue-600" : "text-gray-400"
                )}
              />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-5 border-t border-gray-100 space-y-3">
        <button
          type="button"
          onClick={handleLogout}
          disabled={logoutPending}
          aria-busy={logoutPending}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:pointer-events-none disabled:opacity-60"
        >
          {logoutPending ? (
            <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <LogOut className="w-4 h-4 shrink-0" aria-hidden />
          )}
          Déconnexion
        </button>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-semibold text-gray-600">
            {managerInitials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{managerName}</p>
            <p className="text-xs text-gray-400 truncate">{companyName}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
