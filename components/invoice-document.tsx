"use client"

import { useEffect, useRef, useState } from "react"
import localFont from "next/font/local"
import { formatEuroDocument, type InvoiceDocumentModel } from "@/lib/invoice-document"
import { cn } from "@/lib/utils"
import styles from "./invoice-document.module.css"

const serif = localFont({
  src: [
    { path: "../public/fonts/CormorantGaramond-Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/CormorantGaramond-Medium.ttf", weight: "500", style: "normal" },
    { path: "../public/fonts/CormorantGaramond-Italic.ttf", weight: "400", style: "italic" },
  ],
  variable: "--font-invoice-serif",
  display: "swap",
})

const sans = localFont({
  src: [
    { path: "../public/fonts/Jost-Light.ttf", weight: "300", style: "normal" },
    { path: "../public/fonts/Jost-Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/Jost-Medium.ttf", weight: "500", style: "normal" },
  ],
  variable: "--font-invoice-sans",
  display: "swap",
})

const PAGE_WIDTH = 794
const PAGE_HEIGHT = 1123
const LOGO_SRC = "/logo-domaine.png"

export function InvoiceDocument({ model }: { model: InvoiceDocumentModel }) {
  const hasVat = model.vatRate > 0
  const isOther = model.occasion === "other"

  return (
    <div
      className={cn(
        styles.page,
        isOther && styles.pageOther,
        serif.variable,
        sans.variable
      )}
    >
      <header className={styles.brand}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_SRC} alt={model.issuer.name} />
        <div>
          <div className={cn(styles.serif, styles.brandName)}>{model.issuer.name}</div>
          {model.issuer.tagline ? <div className={styles.tagline}>{model.issuer.tagline}</div> : null}
          {model.issuer.lines.length ? (
            <div className={styles.brandAddress}>
              {model.issuer.lines.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      <div className={cn(styles.serif, styles.kind, isOther && styles.kindOther)}>
        {model.title}
        {model.titleAccent ? (
          <>
            {" "}
            {isOther ? (
              <span>{model.titleAccent}</span>
            ) : (
              <em>{model.titleAccent}</em>
            )}
          </>
        ) : null}
      </div>

      <div className={styles.ornament}>
        <span />
        {isOther ? <span className={styles.ornamentDot} /> : <FernIcon />}
        <span />
      </div>

      <section className={styles.parties}>
        <div className={styles.infoBlock}>
          <div className={styles.label}>Facturé à</div>
          <div className={cn(styles.serif, styles.clientName)}>{model.client.name}</div>
          <div className={styles.details}>
            {model.client.lines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </div>
        <div className={styles.infoBlock}>
          <div className={styles.label}>Facture</div>
          <dl className={styles.meta}>
            <dt>N°</dt>
            <dd>{model.number}</dd>
            <dt>Émise le</dt>
            <dd>{model.issuedLabel}</dd>
            <dt>Échéance</dt>
            <dd>{model.dueLabel}</dd>
          </dl>
        </div>
      </section>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Désignation</th>
            <th className={styles.num}>Qté</th>
            <th className={styles.num}>Prix unitaire</th>
            <th className={styles.num}>Montant TTC</th>
          </tr>
        </thead>
        <tbody>
          {model.lines.map((line, index) => (
            <tr key={`${index}-${line.label}`} className={line.isDiscount ? styles.discount : undefined}>
              <td>
                <div className={styles.item}>{line.label || "—"}</div>
                {line.periodLabel ? <div className={styles.period}>{line.periodLabel}</div> : null}
                {line.description ? <div className={styles.sub}>{line.description}</div> : null}
              </td>
              <td className={styles.num}>{line.quantity}</td>
              <td className={styles.num}>{formatEuroDocument(line.unitPrice)}</td>
              <td className={styles.num}>{formatEuroDocument(line.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {model.notes ? <p className={styles.notes}>{model.notes}</p> : null}

      <section className={styles.totals}>
        {hasVat ? (
          <>
            <div className={styles.totalsRow}>
              <span>Total HT</span>
              <span>{formatEuroDocument(model.amountHt)}</span>
            </div>
            <div className={styles.totalsRow}>
              <span>TVA {model.vatRate} %</span>
              <span>{formatEuroDocument(model.vatAmount)}</span>
            </div>
          </>
        ) : null}
        <div className={styles.grand}>
          <span className={styles.grandLabel}>{hasVat ? "Total TTC" : "Total"}</span>
          <span className={cn(styles.serif, styles.grandValue)}>
            {formatEuroDocument(model.amountTtc)}
          </span>
        </div>
      </section>

      <section className={cn(styles.payment, !model.bank && styles.paymentSingle)}>
        <div>
          <p>{model.paymentText}</p>
        </div>
        {model.bank ? (
          <div>
            <div className={styles.label}>Coordonnées bancaires</div>
            <p>
              <span className={styles.iban}>{model.bank.iban}</span>
              <br />
              {[model.bank.bic ? `BIC ${model.bank.bic}` : null, model.bank.holder]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        ) : null}
      </section>

      {model.thanks.message || model.thanks.signature ? (
        <section className={cn(styles.thanks, isOther && styles.thanksOther)}>
          {model.thanks.message ? (
            <div
              className={cn(
                isOther ? styles.thanksMessageOther : cn(styles.serif, styles.thanksMessage)
              )}
            >
              {model.thanks.message}
            </div>
          ) : null}
          {model.thanks.signature ? (
            <div className={cn(styles.serif, styles.signature)}>{model.thanks.signature}</div>
          ) : null}
        </section>
      ) : null}

      <footer className={styles.footer}>
        <div>{model.issuer.footerLine}</div>
        {model.legalLines.map((line) => (
          <div key={line} className={styles.legal}>
            {line}
          </div>
        ))}
      </footer>
    </div>
  )
}

/** Page A4 mise à l'échelle de son conteneur. */
export function InvoicePreview({ model, className }: { model: InvoiceDocumentModel; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.6)
  const [pageHeight, setPageHeight] = useState(PAGE_HEIGHT)

  useEffect(() => {
    const container = containerRef.current
    const page = pageRef.current
    if (!container || !page) return
    const update = () => {
      setScale(Math.min(1, container.clientWidth / PAGE_WIDTH))
      setPageHeight(Math.max(PAGE_HEIGHT, page.offsetHeight))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(container)
    observer.observe(page)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className={cn("w-full", className)}>
      <div
        className="relative overflow-hidden rounded-sm shadow-[0_8px_30px_rgba(59,55,47,0.12)] ring-1 ring-black/5"
        style={{ width: PAGE_WIDTH * scale, height: pageHeight * scale }}
      >
        <div ref={pageRef} style={{ width: PAGE_WIDTH, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <InvoiceDocument model={model} />
        </div>
      </div>
    </div>
  )
}

function FernIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <path d="M12 21V5" />
      <path d="M12 8c-2-1-4-1-5.5 0M12 8c2-1 4-1 5.5 0" />
      <path d="M12 12c-2.4-1.2-4.8-1.2-6.8 0M12 12c2.4-1.2 4.8-1.2 6.8 0" />
      <path d="M12 16c-2-1-4-1-5.5 0M12 16c2-1 4-1 5.5 0" />
    </svg>
  )
}
