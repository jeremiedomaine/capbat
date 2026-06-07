"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import type { InvoiceCatalogItem, InvoiceTemplate } from "@/lib/invoice-template"
import { DEFAULT_INVOICE_TEMPLATE } from "@/lib/invoice-template"
import { loadWorkspaceSettings, persistWorkspaceSettings } from "@/lib/workspace-settings-client"

function newCatalogId() {
  return `item-${Date.now().toString(36)}`
}

export function InvoiceTemplateCard() {
  const [template, setTemplate] = useState<InvoiceTemplate>(DEFAULT_INVOICE_TEMPLATE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadWorkspaceSettings()
      .then((settings) => setTemplate(settings.invoiceTemplate))
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await persistWorkspaceSettings({ invoiceTemplate: template })
      toast.success("Modèle de facture enregistré")
    } catch (e) {
      toast.error("Enregistrement impossible", {
        description: e instanceof Error ? e.message : "Réessayez.",
      })
    } finally {
      setSaving(false)
    }
  }

  const updateCatalogItem = useCallback((id: string, patch: Partial<InvoiceCatalogItem>) => {
    setTemplate((prev) => ({
      ...prev,
      catalog: prev.catalog.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }))
  }, [])

  const addCatalogItem = (kind: "extra" | "discount") => {
    setTemplate((prev) => ({
      ...prev,
      catalog: [
        ...prev.catalog,
        {
          id: newCatalogId(),
          label: kind === "discount" ? "Remise" : "Extra",
          unitPrice: kind === "discount" ? -100 : 100,
          kind,
        },
      ],
    }))
  }

  const removeCatalogItem = (id: string) => {
    setTemplate((prev) => ({
      ...prev,
      catalog: prev.catalog.filter((item) => item.id !== id),
    }))
  }

  if (loading) {
    return (
      <Card className="bg-white border-gray-100 shadow-sm">
        <CardContent className="py-12 flex justify-center text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Chargement du modèle…
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-white border-gray-100 shadow-sm">
      <CardHeader>
        <CardTitle>Modèle de facture</CardTitle>
        <CardDescription>
          Personnalisez l&apos;apparence et les libellés par défaut. Variables :{" "}
          <code className="text-xs bg-gray-100 px-1 rounded">{"{{couple}}"}</code>,{" "}
          <code className="text-xs bg-gray-100 px-1 rounded">{"{{date}}"}</code>,{" "}
          <code className="text-xs bg-gray-100 px-1 rounded">{"{{event_type}}"}</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Couleur principale">
            <div className="flex gap-2">
              <Input
                type="color"
                value={template.primaryColor}
                onChange={(e) => setTemplate((p) => ({ ...p, primaryColor: e.target.value }))}
                className="w-14 h-10 p-1"
              />
              <Input
                value={template.primaryColor}
                onChange={(e) => setTemplate((p) => ({ ...p, primaryColor: e.target.value }))}
              />
            </div>
          </Field>
          <Field label="TVA par défaut (%)">
            <Input
              type="number"
              min={0}
              max={100}
              value={template.defaultVatRate}
              onChange={(e) =>
                setTemplate((p) => ({ ...p, defaultVatRate: Number(e.target.value) || 0 }))
              }
            />
          </Field>
          <Field label="Échéance par défaut (jours)">
            <Input
              type="number"
              min={1}
              value={template.defaultDueDays}
              onChange={(e) =>
                setTemplate((p) => ({ ...p, defaultDueDays: Number(e.target.value) || 30 }))
              }
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Field label="Libellé acompte">
            <Input
              value={template.depositLabel}
              onChange={(e) => setTemplate((p) => ({ ...p, depositLabel: e.target.value }))}
            />
          </Field>
          <Field label="Libellé solde">
            <Input
              value={template.balanceLabel}
              onChange={(e) => setTemplate((p) => ({ ...p, balanceLabel: e.target.value }))}
            />
          </Field>
          <Field label="Libellé facture globale">
            <Input
              value={template.fullLabel}
              onChange={(e) => setTemplate((p) => ({ ...p, fullLabel: e.target.value }))}
            />
          </Field>
        </div>

        <Field label="Mentions légales (pied de page PDF)">
          <Textarea
            value={template.legalNotice}
            onChange={(e) => setTemplate((p) => ({ ...p, legalNotice: e.target.value }))}
            rows={2}
          />
        </Field>
        <Field label="Texte pied de page (optionnel)">
          <Input
            value={template.footerText}
            onChange={(e) => setTemplate((p) => ({ ...p, footerText: e.target.value }))}
            placeholder="Ex: Merci pour votre confiance."
          />
        </Field>

        <div className="flex items-center justify-between rounded-lg border border-gray-100 p-4">
          <div>
            <p className="text-sm font-medium text-gray-800">Créer les factures brouillon à la création d&apos;un événement</p>
            <p className="text-xs text-gray-500">Acompte et solde générés automatiquement si les montants sont renseignés.</p>
          </div>
          <Switch
            checked={template.autoGenerateOnEventCreate}
            onCheckedChange={(checked) =>
              setTemplate((p) => ({ ...p, autoGenerateOnEventCreate: checked }))
            }
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-800">Catalogue extras & remises</p>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => addCatalogItem("extra")}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Extra
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => addCatalogItem("discount")}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Remise
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {template.catalog.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-1 md:grid-cols-[1fr_120px_100px_auto] gap-2 items-center rounded-lg border border-gray-100 p-3"
              >
                <Input
                  value={item.label}
                  onChange={(e) => updateCatalogItem(item.id, { label: e.target.value })}
                  placeholder="Libellé"
                />
                <Input
                  type="number"
                  value={item.unitPrice}
                  onChange={(e) =>
                    updateCatalogItem(item.id, { unitPrice: Number(e.target.value) || 0 })
                  }
                  placeholder="Montant"
                />
                <span
                  className={`text-xs font-medium px-2 py-1 rounded ${
                    item.kind === "discount"
                      ? "bg-red-50 text-red-700"
                      : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {item.kind === "discount" ? "Remise" : "Extra"}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-red-600"
                  onClick={() => removeCatalogItem(item.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <Button type="button" onClick={save} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Enregistrer le modèle
        </Button>
      </CardContent>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-800">{label}</label>
      {children}
    </div>
  )
}
