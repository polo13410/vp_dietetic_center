import { Document, Page, pdf, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { InvoiceDto } from '@vp/types';

import { invoiceDocumentContent } from '../../lib/invoice-document';

/** Printed in black on white; the practice's green for the title and rules only. */
const GREEN = '#3D7A2C';
const GREY = '#56655B';

const styles = StyleSheet.create({
  page: { padding: 48, paddingBottom: 72, fontSize: 10, fontFamily: 'Helvetica', color: '#1B2A21', lineHeight: 1.4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  practice: { maxWidth: '55%' },
  practiceName: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  muted: { color: GREY },
  titleBlock: { alignItems: 'flex-end' },
  title: { fontSize: 22, lineHeight: 1.2, fontFamily: 'Helvetica-Bold', color: GREEN, marginBottom: 4 },
  label: { fontSize: 9, color: GREY, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  patient: { marginLeft: '55%', marginBottom: 28 },
  patientName: { fontFamily: 'Helvetica-Bold' },
  references: { marginBottom: 16 },
  table: { borderTopWidth: 1.5, borderTopColor: GREEN, marginBottom: 12 },
  tableHead: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#D9E0D3' },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#D9E0D3' },
  cellLabel: { flex: 1 },
  cellAmount: { width: 110, textAlign: 'right' },
  totalRow: { flexDirection: 'row', paddingVertical: 8 },
  total: { fontFamily: 'Helvetica-Bold', fontSize: 12 },
  paid: { fontFamily: 'Helvetica-Bold', color: GREEN, marginBottom: 12 },
  mention: { marginBottom: 6 },
  footer: { position: 'absolute', bottom: 32, left: 48, right: 48, fontSize: 8, color: GREY, textAlign: 'center' },
});

/** An invoice or a credit note, on one A4 page, from its copies only. */
export function InvoicePdfDocument({ invoice }: { invoice: InvoiceDto }) {
  const c = invoiceDocumentContent(invoice);
  return (
    <Document title={`${c.title} ${c.number}`} author={c.practice[0]} language="fr-FR">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.practice}>
            {c.practice.map((line, i) => (
              <Text key={line} style={i === 0 ? styles.practiceName : undefined}>
                {line}
              </Text>
            ))}
            {c.identifiers.map((line) => (
              <Text key={line} style={styles.muted}>
                {line}
              </Text>
            ))}
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{c.title}</Text>
            <Text>N° {c.number}</Text>
            <Text style={styles.muted}>Émise le {c.issuedOn}</Text>
          </View>
        </View>

        <View style={styles.patient}>
          <Text style={styles.label}>Patient</Text>
          {c.patient.map((line, i) => (
            <Text key={line} style={i === 0 ? styles.patientName : undefined}>
              {line}
            </Text>
          ))}
        </View>

        {c.references.length > 0 && (
          <View style={styles.references}>
            {c.references.map((line) => (
              <Text key={line}>{line}</Text>
            ))}
          </View>
        )}

        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.cellLabel, styles.label]}>Prestation</Text>
            <Text style={[styles.cellAmount, styles.label]}>Montant</Text>
          </View>
          <View style={styles.tableRow}>
            <View style={styles.cellLabel}>
              <Text style={styles.patientName}>{c.service.label}</Text>
              <Text style={styles.muted}>{c.service.date}</Text>
            </View>
            <Text style={styles.cellAmount}>{c.service.amount}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.cellLabel, styles.total]}>Total</Text>
            <Text style={[styles.cellAmount, styles.total]}>{c.total}</Text>
          </View>
        </View>

        {c.paid && <Text style={styles.paid}>{c.paid}</Text>}
        {c.vatMention && <Text style={styles.mention}>{c.vatMention}</Text>}

        {c.footer && (
          <Text style={styles.footer} fixed>
            {c.footer}
          </Text>
        )}
      </Page>
    </Document>
  );
}

/** The PDF file of an invoice or credit note. */
export function renderInvoicePdf(invoice: InvoiceDto): Promise<Blob> {
  return pdf(<InvoicePdfDocument invoice={invoice} />).toBlob();
}
