import { useQuery } from '@tanstack/react-query';
import { Download, Eye, FileText, Upload } from 'lucide-react';
import { useState } from 'react';

import api from '../../lib/api';
import { previewKind } from '../../lib/documents';
import { formatLongDate } from '../../lib/utils';
import { DocumentPreviewDialog, downloadDocument, type PreviewableDocument } from '../documents/DocumentPreviewDialog';
import { DocumentUploadDialog } from '../documents/DocumentUploadDialog';
import { EmptyState } from '../shared/EmptyState';
import { Section } from '../shared/Section';
import { StatusBadge } from '../shared/StatusBadge';
import { Button } from '../ui/button';
import { toast } from '../ui/toaster';

type PatientDocument = PreviewableDocument & { type: string; createdAt: string };

/** The patient's documents (analyses, prescriptions…): shown, downloaded, added. */
export function PatientDocuments({ patientId }: { patientId: string }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewing, setPreviewing] = useState<PreviewableDocument | null>(null);
  const { data: documents = [] } = useQuery({
    queryKey: ['documents', { patientId }],
    queryFn: async () => (await api.get<PatientDocument[]>('/documents', { params: { patientId } })).data,
  });

  const download = async (doc: PreviewableDocument) => {
    try {
      await downloadDocument(doc);
    } catch {
      toast({ title: 'Le document n’a pas pu être téléchargé. Réessayez.', variant: 'destructive' });
    }
  };

  const addButton = (
    <Button variant="outline" onClick={() => setUploadOpen(true)}>
      <Upload aria-hidden /> Ajouter un document
    </Button>
  );

  return (
    <Section
      icon={FileText}
      area="patients"
      title="Documents"
      description={documents.length > 0 && `${documents.length} document${documents.length > 1 ? 's' : ''}`}
      action={documents.length > 0 && addButton}
      flush={documents.length > 0}
    >
      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          area="patients"
          title="Aucun document pour l’instant"
          description="Analyses, ordonnances, comptes rendus : ajoutez-les ici pour les retrouver."
          action={addButton}
        />
      ) : (
        <ul className="divide-y border-t">
          {documents.map((doc) => {
            const viewable = !!previewKind(doc.mimeType);
            return (
              <li key={doc.id} className="flex min-h-16 flex-wrap items-center gap-3 px-5 py-2 sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{doc.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatLongDate(doc.createdAt)} · {doc.originalName}
                  </p>
                </div>
                <StatusBadge status={doc.type} />
                <div className="flex items-center gap-1">
                  {viewable && (
                    <Button size="icon" variant="ghost" aria-label={`Afficher ${doc.name}`} onClick={() => setPreviewing(doc)}>
                      <Eye aria-hidden />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" aria-label={`Télécharger ${doc.name}`} onClick={() => download(doc)}>
                    <Download aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <DocumentUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} defaultPatientId={patientId} />
      <DocumentPreviewDialog doc={previewing} onOpenChange={(open) => !open && setPreviewing(null)} />
    </Section>
  );
}
