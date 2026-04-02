import { useQuery } from '@tanstack/react-query';
import { Upload, FileText } from 'lucide-react';

import api from '../../lib/api';
import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { formatDate } from '../../lib/utils';

export default function DocumentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => { const { data } = await api.get('/documents'); return data; },
  });

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Documents</h1>
        <Button size="sm"><Upload className="w-4 h-4" /> Uploader</Button>
      </div>
      {isLoading ? <LoadingSpinner /> : !data?.length ? (
        <p className="text-center text-muted-foreground py-12 text-sm">Aucun document</p>
      ) : (
        <div className="bg-white rounded-xl border border-border divide-y divide-border">
          {data.map((doc: any) => (
            <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.name}</p>
                <p className="text-xs text-muted-foreground">{doc.type} — {formatDate(doc.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
