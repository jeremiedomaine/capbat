"use client"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import {
  getStoredCompanyName,
  getStoredManagerName,
  setStoredCompanyName,
  setStoredManagerName,
} from "@/lib/profile-local-storage"

export default function ParametresPage() {
  const [companyName, setCompanyName] = useState("Domaine des Roses")
  const [managerName, setManagerName] = useState("Marie Clement")
  const [email, setEmail] = useState("contact@domainedesroses.fr")
  const [phone, setPhone] = useState("+33 6 12 34 56 78")

  const [emailNotif, setEmailNotif] = useState(true)
  const [paymentAlerts, setPaymentAlerts] = useState(true)
  const [weeklySummary, setWeeklySummary] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const managerFromStorage = getStoredManagerName()
    const companyFromStorage = getStoredCompanyName()
    if (managerFromStorage?.trim()) {
      setManagerName(managerFromStorage.trim())
    }
    if (companyFromStorage?.trim()) {
      setCompanyName(companyFromStorage.trim())
    }
  }, [])

  const handleSave = () => {
    persistManagerName(managerName)
    persistCompanyName(companyName)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleCompanyChange = (value: string) => {
    setCompanyName(value)
    persistCompanyName(value)
  }

  const handleManagerChange = (value: string) => {
    setManagerName(value)
    persistManagerName(value)
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="p-8 max-w-5xl mx-auto space-y-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold text-gray-900">Parametres</h1>
            <p className="text-sm text-gray-500">
              Configurez les parametres generaux de votre espace Guestflow.
            </p>
          </header>

          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle>Informations generales</CardTitle>
              <CardDescription>
                Renseignez les informations principales de votre etablissement.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-800">Nom de l&apos;etablissement</label>
                <Input value={companyName} onChange={(e) => handleCompanyChange(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-800">Responsable</label>
                <Input value={managerName} onChange={(e) => handleManagerChange(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-800">Email de contact</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-800">Telephone</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle>Notifications et interface</CardTitle>
              <CardDescription>Activez les options globales de confort et de suivi.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SettingToggle
                title="Notifications e-mail"
                description="Recevoir les alertes importantes par e-mail."
                checked={emailNotif}
                onCheckedChange={setEmailNotif}
              />
              <SettingToggle
                title="Alertes paiements"
                description="Etre notifie des acomptes et soldes en attente."
                checked={paymentAlerts}
                onCheckedChange={setPaymentAlerts}
              />
              <SettingToggle
                title="Resume hebdomadaire"
                description="Recevoir un recapitulatif chaque lundi matin."
                checked={weeklySummary}
                onCheckedChange={setWeeklySummary}
              />
              <SettingToggle
                title="Mode sombre"
                description="Activer une interface sombre dans le dashboard."
                checked={darkMode}
                onCheckedChange={setDarkMode}
              />
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave}>Enregistrer les parametres</Button>
            {saved && <span className="text-sm text-emerald-600">Parametres enregistres.</span>}
          </div>
        </div>
      </main>
    </div>
  )
}

function persistManagerName(value: string) {
  setStoredManagerName(value)
}

function persistCompanyName(value: string) {
  setStoredCompanyName(value)
}

type SettingToggleProps = {
  title: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

function SettingToggle({
  title,
  description,
  checked,
  onCheckedChange,
}: SettingToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4 border border-gray-100 rounded-lg p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-800">{title}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}
