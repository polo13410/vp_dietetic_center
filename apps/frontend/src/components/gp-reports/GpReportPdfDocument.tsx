import { Document, Page, pdf, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { GpReportDocumentDto } from '@vp/types';

import { paragraphs, printable } from '../../lib/gp-reports';

/** Same paper as the invoices: black on white, the practice's green for its name and the rule. */
const GREEN = '#3D7A2C';
const GREY = '#56655B';

const styles = StyleSheet.create({
  page: { padding: 56, paddingBottom: 72, fontSize: 11, fontFamily: 'Helvetica', color: '#1B2A21', lineHeight: 1.45 },
  letterhead: { borderBottomWidth: 1.5, borderBottomColor: GREEN, paddingBottom: 10, marginBottom: 28 },
  practiceName: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: GREEN, marginBottom: 2 },
  muted: { fontSize: 9.5, color: GREY },
  paragraph: { marginBottom: 10 },
  footer: { position: 'absolute', bottom: 32, left: 56, right: 56, fontSize: 8, color: GREY, textAlign: 'center' },
});

/** The report to the GP on the practice's letterhead, as she wrote it. */
export function GpReportPdfDocument({ report }: { report: GpReportDocumentDto }) {
  const [name, ...details] = report.letterhead;
  const patient = `${report.patient.firstName} ${report.patient.lastName}`;
  return (
    <Document title={`Compte rendu — ${patient}`} author={name} language="fr-FR">
      <Page size="A4" style={styles.page}>
        {name && (
          <View style={styles.letterhead}>
            <Text style={styles.practiceName}>{name}</Text>
            {details.map((line) => (
              <Text key={line} style={styles.muted}>
                {line}
              </Text>
            ))}
          </View>
        )}

        {paragraphs(printable(report.content)).map((text, i) => (
          <Text key={i} style={styles.paragraph}>
            {text}
          </Text>
        ))}

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            totalPages > 1 ? `Compte rendu — ${patient} — page ${pageNumber} / ${totalPages}` : ''
          }
        />
      </Page>
    </Document>
  );
}

/** The PDF file of a report. */
export function renderGpReportPdf(report: GpReportDocumentDto): Promise<Blob> {
  return pdf(<GpReportPdfDocument report={report} />).toBlob();
}
