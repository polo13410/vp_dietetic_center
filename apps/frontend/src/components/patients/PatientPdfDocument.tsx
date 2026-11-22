import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a' },
  header: { marginBottom: 20 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#666' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', marginBottom: 8, color: '#333', borderBottomWidth: 1, borderBottomColor: '#e5e5e5', paddingBottom: 4 },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 120, color: '#666', fontSize: 9 },
  value: { flex: 1 },
  grid: { flexDirection: 'row', gap: 20 },
  gridCol: { flex: 1 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f5f5f5', padding: '4 8', marginBottom: 2 },
  tableRow: { flexDirection: 'row', padding: '4 8', borderBottomWidth: 0.5, borderBottomColor: '#e5e5e5' },
  tableCell: { flex: 1, fontSize: 9 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 8, color: '#999', textAlign: 'center' },
});

interface PatientPdfDocumentProps {
  patient: any;
  appointments: any[];
  sessions: any[];
}

export function PatientPdfDocument({ patient, appointments, sessions }: PatientPdfDocumentProps) {
  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR');
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{patient.lastName} {patient.firstName}</Text>
          <Text style={styles.subtitle}>
            Fiche patient — Generee le {new Date().toLocaleDateString('fr-FR')}
          </Text>
        </View>

        {/* Identity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identite</Text>
          <View style={styles.grid}>
            <View style={styles.gridCol}>
              <InfoRow label="Date de naissance" value={formatDate(patient.dateOfBirth)} />
              <InfoRow label="Email" value={patient.email} />
              <InfoRow label="Telephone" value={patient.phone} />
            </View>
            <View style={styles.gridCol}>
              <InfoRow label="Adresse" value={[patient.address, patient.zipCode, patient.city].filter(Boolean).join(', ')} />
              <InfoRow label="Adressé par" value={patient.referralSource} />
            </View>
          </View>
        </View>

        {/* Situation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Situation</Text>
          <InfoRow label="Situation familiale" value={patient.familySituation} />
          <InfoRow label="Profession" value={patient.profession} />
          <InfoRow label="Médecin traitant" value={patient.gpName} />
        </View>

        {/* Recent Appointments */}
        {appointments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Derniers rendez-vous ({appointments.length})</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCell, { fontWeight: 'bold' }]}>Date</Text>
              <Text style={[styles.tableCell, { fontWeight: 'bold' }]}>Type</Text>
              <Text style={[styles.tableCell, { fontWeight: 'bold' }]}>Duree</Text>
              <Text style={[styles.tableCell, { fontWeight: 'bold' }]}>Statut</Text>
            </View>
            {appointments.slice(0, 15).map((a: any) => (
              <View key={a.id} style={styles.tableRow}>
                <Text style={styles.tableCell}>{formatDate(a.startAt)}</Text>
                <Text style={styles.tableCell}>{a.type}</Text>
                <Text style={styles.tableCell}>{a.duration} min</Text>
                <Text style={styles.tableCell}>{a.status}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Recent sessions */}
        {sessions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dernières séances ({sessions.length})</Text>
            {sessions.slice(0, 10).map((s: any) => (
              <View key={s.id} style={[styles.row, { marginBottom: 6 }]}>
                <Text style={[styles.label, { width: 80 }]}>{formatDate(s.date)}</Text>
                <Text style={{ flex: 1 }}>{s.sessionWork || 'Rien d’écrit'}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footer}>VP Dietetic Center — Document confidentiel</Text>
      </Page>
    </Document>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || '—'}</Text>
    </View>
  );
}
