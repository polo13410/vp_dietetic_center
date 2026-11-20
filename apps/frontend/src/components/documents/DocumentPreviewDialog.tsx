import { useQuery } from '@tanstack/react-query';
import { Download, Loader2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';

import api from '../../lib/api';
import { previewKind } from '../../lib/documents';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

export interface PreviewableDocument {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
}

/** Fetches a document's file (with the user's session) and saves it under its original name. */
export async function downloadDocument(doc: Pick<PreviewableDocument, 'id' | 'originalName'>) {
  const res = await api.get(`/documents/${doc.id}/download`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = doc.originalName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Shows a PDF, image or text document in the app, without downloading it. The file is fetched
 * through the API (the session is checked) and displayed from memory.
 */
export function DocumentPreviewDialog({
  doc,
  onOpenChange,
}: {
  doc: PreviewableDocument | null;
  onOpenChange: (open: boolean) => void;
}) {
  const kind = doc ? previewKind(doc.mimeType) : null;
  const { data: blob, isLoading, isError } = useQuery({
    queryKey: ['document-file', doc?.id],
    queryFn: async () => (await api.get(`/documents/${doc!.id}/download`, { responseType: 'blob' })).data as Blob,
    enabled: !!doc && !!kind,
    staleTime: 5 * 60 * 1000,
  });

  // The browser needs the right type to render it (the download is sent as an attachment)
  const url = useMemo(
    () => (blob && doc ? URL.createObjectURL(new Blob([blob], { type: doc.mimeType })) : null),
    [blob, doc],
  );
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  const { data: text } = useQuery({
    queryKey: ['document-text', doc?.id],
    queryFn: () => blob!.text(),
    enabled: kind === 'text' && !!blob,
  });

  return (
    <Dialog open={!!doc} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col gap-3">
        <DialogHeader className="flex-row items-center justify-between gap-3 space-y-0 pr-8">
          <DialogTitle className="truncate">{doc?.name}</DialogTitle>
          {doc && (
            <Button size="sm" variant="outline" onClick={() => downloadDocument(doc)}>
              <Download className="h-4 w-4" /> Télécharger
            </Button>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border bg-muted/30">
          {!kind ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Ce format ne peut pas être affiché dans le navigateur : téléchargez-le pour l’ouvrir.
            </p>
          ) : isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : isError || !url ? (
            <p className="p-8 text-center text-sm text-destructive">Impossible d’afficher ce document.</p>
          ) : kind === 'pdf' ? (
            <iframe src={url} title={doc?.name} className="h-full w-full" />
          ) : kind === 'image' ? (
            <div className="flex min-h-full items-center justify-center p-4">
              <img src={url} alt={doc?.name} className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            <pre className="whitespace-pre-wrap p-4 text-sm">{text}</pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
