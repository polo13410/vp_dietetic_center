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
  badge: { fontSize: 9, padding: '2 6', borderRadius: 4, backgroundColor: '#f0f0f0', alignSelf: 'flex-start' },
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
  notes: any[];
}

export function PatientPdfDocument({ patient, appointments, notes }: PatientPdfDocumentProps) {
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
          <Text style={[styles.badge, { marginTop: 6 }]}>{patient.status}</Text>
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
              <InfoRow label="Source" value={patient.referralSource} />
            </View>
          </View>
        </View>

        {/* Emergency Contact */}
        {(patient.emergencyContactName || patient.emergencyContactPhone) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact d'urgence</Text>
            <InfoRow label="Nom" value={patient.emergencyContactName} />
            <InfoRow label="Telephone" value={patient.emergencyContactPhone} />
            <InfoRow label="Lien" value={patient.emergencyContactRelationship} />
          </View>
        )}

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

        {/* Recent Notes */}
        {notes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dernieres notes ({notes.length})</Text>
            {notes.slice(0, 10).map((n: any) => (
              <View key={n.id} style={[styles.row, { marginBottom: 6 }]}>
                <Text style={[styles.label, { width: 80 }]}>{formatDate(n.createdAt)}</Text>
                <Text style={{ flex: 1 }}>{n.title || 'Note sans titre'}</Text>
                <Text style={[styles.badge]}>{n.status}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Private Note */}
        {patient.privateNote && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Note privee praticienne</Text>
            <Text>{patient.privateNote}</Text>
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
