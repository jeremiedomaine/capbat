"use client"

import { useEffect, useState } from "react"
import { Loader2, Minus, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { BillingProfile } from "@/lib/billing-local-storage"
import type { InvoiceCatalogItem, InvoiceTemplate } from "@/lib/invoice-template"
import type { WorkspaceSettings } from "@/lib/workspace-settings"
import { persistWorkspaceSettings } from "@/lib/workspace-settings-client"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: WorkspaceSettings
  onSaved: (settings: WorkspaceSettings) => void
}

function newCatalogId() {
  return `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`
}

export function InvoiceSettingsSheet({ open, onOpenChange, settings, onSaved }: Props) {
  const [billing, setBilling] = useState<BillingProfile>(settings.billing)
  const [template, setTemplate] = useState<InvoiceTemplate>(settings.invoiceTemplate)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setBilling(settings.billing)
    setTemplate(settings.invoiceTemplate)
  }, [open, settings])

  const patchTemplate = (patch: Partial<InvoiceTemplate>) => setTemplate((prev) => ({ ...prev, ...patch }))
  const patchBilling = (patch: Partial<BillingProfile>) => setBilling((prev) => ({ ...prev, ...patch }))

  const updateCatalogItem = (id: string, patch: Partial<InvoiceCatalogItem>) =>
    setTemplate((prev) => ({
      ...prev,
      catalog: prev.catalog.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }))

  const addCatalogItem = (kind: InvoiceCatalogItem["kind"]) =>
    setTemplate((prev) => ({
      ...prev,
      catalog: [
        ...prev.catalog,
        {
          id: newCatalogId(),
          label: kind === "discount" ? "Remise" : "Nouvel extra",
          unitPrice: kind === "discount" ? -100 : 100,
          kind,
        },
      ],
    }))

  const removeCatalogItem = (id: string) =>
    setTemplate((prev) => ({ ...prev, catalog: prev.catalog.filter((item) => item.id !== id) }))

  const save = async () => {
    setSaving(true)
    try {
      const saved = await persistWorkspaceSettings({ billing, invoiceTemplate: template })
      onSaved(saved)
      toast.success("Réglages des factures enregistrés")
      onOpenChange(false)
    } catch (e) {
      toast.error("Enregistrement impossible", {
        description: e instanceof Error ? e.message : "Réessayez.",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Réglages des factures</SheetTitle>
          <SheetDescription>
            Le design est fixe. Ces informations s&apos;appliquent à toutes les factures en brouillon.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-8 px-4 pb-4">
          <Section title="Coordonnées du domaine" hint={`Nom et e-mail : Paramètres (${settings.companyName}).`}>
            <Field label="Adresse" className="sm:col-span-2">
              <Input value={billing.addressLine} onChange={(e) => patchBilling({ addressLine: e.target.value })} />
            </Field>
            <Field label="Code postal">
              <Input value={billing.postalCode} onChange={(e) => patchBilling({ postalCode: e.target.value })} />
            </Field>
            <Field label="Ville">
              <Input value={billing.city} onChange={(e) => patchBilling({ city: e.target.value })} />
            </Field>
            <Field label="SIRET">
              <Input value={billing.siret} onChange={(e) => patchBilling({ siret: e.target.value })} />
            </Field>
            <Field label="N° TVA intracommunautaire">
              <Input value={billing.vatNumber} onChange={(e) => patchBilling({ vatNumber: e.target.value })} />
            </Field>
            <Field label="Téléphone sur les factures" className="sm:col-span-2">
              <Input
                value={billing.phone}
                placeholder={settings.contactPhone || "Téléphone de Paramètres"}
                onChange={(e) => patchBilling({ phone: e.target.value })}
              />
            </Field>
          </Section>

          <Section title="Règlement" hint="Sans IBAN, le bloc « Coordonnées bancaires » n'apparaît pas.">
            <Field label="IBAN" className="sm:col-span-2">
              <Input
                value={template.bankIban}
                placeholder="FR76 …"
                onChange={(e) => patchTemplate({ bankIban: e.target.value })}
              />
            </Field>
            <Field label="BIC">
              <Input value={template.bankBic} onChange={(e) => patchTemplate({ bankBic: e.target.value })} />
            </Field>
            <Field label="Titulaire du compte">
              <Input
                value={template.bankHolder}
                placeholder={settings.companyName}
                onChange={(e) => patchTemplate({ bankHolder: e.target.value })}
              />
            </Field>
            <Field label="Échéance par défaut (jours)">
              <Input
                type="number"
                min={1}
                value={template.defaultDueDays}
                onChange={(e) => patchTemplate({ defaultDueDays: Math.max(1, Number(e.target.value) || 30) })}
              />
            </Field>
            <Field label="TVA par défaut (%)">
              <Input
                type="number"
                min={0}
                max={100}
                value={template.defaultVatRate}
                onChange={(e) => patchTemplate({ defaultVatRate: Math.max(0, Number(e.target.value) || 0) })}
              />
            </Field>
          </Section>

          <Section title="Textes de la facture">
            <Field label="Sous le nom du domaine" className="sm:col-span-2">
              <Input value={template.tagline} onChange={(e) => patchTemplate({ tagline: e.target.value })} />
            </Field>
            <Field label="Message de remerciement" className="sm:col-span-2">
              <Input
                value={template.thankYouMessage}
                onChange={(e) => patchTemplate({ thankYouMessage: e.target.value })}
              />
            </Field>
            <Field label="Signature">
              <Input
                value={template.signature}
                placeholder={settings.managerName}
                onChange={(e) => patchTemplate({ signature: e.target.value })}
              />
            </Field>
            <div />
            <Field label="Mentions légales (pied de page)" className="sm:col-span-2">
              <Textarea
                rows={2}
                value={template.legalNotice}
                onChange={(e) => patchTemplate({ legalNotice: e.target.value })}
              />
            </Field>
            <Field label="Ligne d'acompte" className="sm:col-span-2">
              <Input value={template.depositLabel} onChange={(e) => patchTemplate({ depositLabel: e.target.value })} />
            </Field>
            <Field label="Ligne de solde" className="sm:col-span-2">
              <Input value={template.balanceLabel} onChange={(e) => patchTemplate({ balanceLabel: e.target.value })} />
            </Field>
            <Field label="Ligne de facture globale" className="sm:col-span-2">
              <Input value={template.fullLabel} onChange={(e) => patchTemplate({ fullLabel: e.target.value })} />
            </Field>
            <p className="sm:col-span-2 text-xs text-gray-500">
              Variables des lignes : <code>{"{{couple}}"}</code>, <code>{"{{date}}"}</code>,{" "}
              <code>{"{{event_type}}"}</code>, <code>{"{{event_name}}"}</code>.
            </p>
          </Section>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Catalogue d&apos;extras</h3>
                <p className="text-xs text-gray-500">Proposés en un clic sur chaque facture.</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => addCatalogItem("extra")}>
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Extra
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => addCatalogItem("discount")}>
                  <Minus className="w-3.5 h-3.5 mr-1" />
                  Remise
                </Button>
              </div>
            </div>
            {template.catalog.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_110px_auto] gap-2 items-center">
                <Input
                  value={item.label}
                  onChange={(e) => updateCatalogItem(item.id, { label: e.target.value })}
                  placeholder="Libellé"
                />
                <Input
                  type="number"
                  step={0.01}
                  value={item.unitPrice}
                  onChange={(e) => {
                    const unitPrice = Number(e.target.value) || 0
                    updateCatalogItem(item.id, { unitPrice, kind: unitPrice < 0 ? "discount" : "extra" })
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-red-600"
                  onClick={() => removeCatalogItem(item.id)}
                  title="Retirer du catalogue"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-100 p-4">
            <div>
              <p className="text-sm font-medium text-gray-800">Créer les brouillons à la création d&apos;un événement</p>
              <p className="text-xs text-gray-500">Acompte et solde, si les montants sont renseignés.</p>
            </div>
            <Switch
              checked={template.autoGenerateOnEventCreate}
              onCheckedChange={(checked) => patchTemplate({ autoGenerateOnEventCreate: checked })}
            />
          </div>
        </div>

        <SheetFooter className="border-t border-gray-100">
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Enregistrer les réglages
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </section>
  )
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className ? `space-y-1.5 ${className}` : "space-y-1.5"}>
      <label className="text-xs font-medium text-gray-700">{label}</label>
      {children}
    </div>
  )
}
