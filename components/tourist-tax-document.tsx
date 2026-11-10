"use client"

import {
  buildTouristTaxBodyRows,
  formatTouristTaxEuro,
  type TouristTaxDocumentModel,
} from "@/lib/tourist-tax-document"
import styles from "./tourist-tax-document.module.css"

export function TouristTaxDocument({ model }: { model: TouristTaxDocumentModel }) {
  const bodyRows = buildTouristTaxBodyRows(model)

  return (
    <div className={styles.page}>
      <div className={styles.frame}>
        <div className={styles.top}>
          <div className={styles.issuer}>
            <div className={styles.issuerName}>{model.issuer.name}</div>
            {model.issuer.addressLines.map((line) => (
              <div key={line} className={styles.issuerLine}>
                {line}
              </div>
            ))}
            {model.issuer.contactLine ? (
              <div className={styles.issuerLine}>{model.issuer.contactLine}</div>
            ) : null}
            {model.issuer.vatLine ? (
              <div className={styles.issuerLine}>{model.issuer.vatLine}</div>
            ) : null}
          </div>

          <div className={styles.rightCol}>
            <div className={styles.numberBlock}>
              <div className={styles.numberLabel}>FACTURE N°</div>
              <div className={styles.numberValue}>{model.number}</div>
            </div>
            <div className={styles.clientBlock}>
              <div className={styles.clientLabel}>Client</div>
              <div className={styles.clientName}>{model.clientName}</div>
            </div>
          </div>
        </div>

        <div className={styles.dateRow}>
          <strong>LE</strong>
          {model.dateLabel}
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Désignation</th>
              <th>Quantité</th>
              <th>Prix unitaire H.T.</th>
              <th>Total H.T.</th>
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row, index) => {
              if (row.kind === "title") {
                return (
                  <tr key={`title-${index}`}>
                    <td className={styles.desigTitle}>{row.text}</td>
                    <td />
                    <td />
                    <td />
                  </tr>
                )
              }
              if (row.kind === "period") {
                return (
                  <tr key={`period-${index}`}>
                    <td className={styles.desigPeriod}>{row.text}</td>
                    <td />
                    <td />
                    <td />
                  </tr>
                )
              }
              if (row.kind === "occupancy") {
                return (
                  <tr key={`occ-${index}-${row.label}`}>
                    <td>{row.label}</td>
                    <td>{row.quantityLabel}</td>
                    <td className={styles.struckCell}>—</td>
                    <td>{formatTouristTaxEuro(row.total)}</td>
                  </tr>
                )
              }
              return (
                <tr key={`empty-${index}`} className={styles.emptyRow}>
                  <td />
                  <td />
                  <td />
                  <td />
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className={styles.footer}>
          <div className={styles.payment}>
            <div className={styles.paymentTitle}>Règlement</div>
            <div className={styles.paymentRow}>
              <span>Date de règlement :</span>
              <span className={styles.paymentValue}>{model.paymentDateLabel || "……………"}</span>
            </div>
            <div className={styles.paymentRow}>
              <span>Mode de règlement :</span>
              <span className={styles.paymentValue}>{model.paymentMethod || "……………"}</span>
            </div>
          </div>

          <div className={styles.totals}>
            <div className={styles.totalRow}>
              <div className={styles.totalLabel}>TOTAL H.T.</div>
              <div className={`${styles.totalValue} ${styles.struck}`}>—</div>
            </div>
            <div className={styles.totalRow}>
              <div className={styles.totalLabel}>T.V.A.</div>
              <div className={`${styles.totalValue} ${styles.struck}`}>—</div>
            </div>
            <div className={`${styles.totalRow} ${styles.ttc}`}>
              <div className={styles.totalLabel}>TOTAL T.T.C.</div>
              <div className={styles.totalValue}>{formatTouristTaxEuro(model.amountTtc)}</div>
            </div>
          </div>
        </div>
      </div>

      <p className={styles.legal}>{model.legalNotice}</p>
    </div>
  )
}

export function TouristTaxPreview({ model }: { model: TouristTaxDocumentModel }) {
  return (
    <div className="overflow-auto rounded-lg border border-[#c5d9cb] bg-[#eef4ef] p-4">
      <div className="mx-auto w-fit origin-top scale-[0.72] shadow-sm sm:scale-[0.82] lg:scale-90">
        <TouristTaxDocument model={model} />
      </div>
    </div>
  )
}
