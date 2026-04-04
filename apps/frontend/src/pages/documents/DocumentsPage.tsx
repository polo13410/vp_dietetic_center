import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, MoreHorizontal, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { DocumentUploadDialog } from '../../components/documents/DocumentUploadDialog';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Button } from '../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { toast } from '../../components/ui/toaster';
import api from '../../lib/api';
import { formatDate } from '../../lib/utils';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function DocumentsPage() {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patientId') || '';
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['documents', { patientId }],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (patientId) params.patientId = patientId;
      const { data } = await api.get('/documents', { params });
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({ title: 'Document supprime' });
      setDeleteTarget(null);
    },
  });

  const handleDownload = async (id: string, originalName: string) => {
    try {
      const res = await api.get(`/documents/${id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', originalName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Erreur lors du telechargement', variant: 'destructive' });
    }
  };

  const documents = data ?? [];

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Documents</h1>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="w-4 h-4" /> Uploader
        </Button>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : documents.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Aucun document</p>
          <Button variant="outline" className="mt-4" onClick={() => setUploadOpen(true)}>
            <Upload className="w-4 h-4" /> Uploader un document
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          {documents.map((doc: any) => (
            <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {doc.originalName} — {formatSize(doc.sizeBytes)} — {formatDate(doc.createdAt)}
                </p>
                {doc.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{doc.description}</p>
                )}
              </div>
              <StatusBadge status={doc.type} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleDownload(doc.id, doc.originalName)}>
                    <Download className="w-4 h-4" /> Telecharger
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setDeleteTarget({ id: doc.id, name: doc.name })}
                  >
                    <Trash2 className="w-4 h-4" /> Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      <DocumentUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        defaultPatientId={patientId || undefined}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Supprimer le document"
        description={`Etes-vous sur de vouloir supprimer "${deleteTarget?.name}" ?`}
        variant="destructive"
        confirmLabel="Supprimer"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
