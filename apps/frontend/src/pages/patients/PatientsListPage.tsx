import { useQuery } from '@tanstack/react-query';
import type { PaginatedResponse, PatientListItemDto } from '@vp/types';
import { Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { BmiBadge } from '../../components/patient-file/BmiBadge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { useIsRole } from '../../hooks/useAuth';
import api from '../../lib/api';
import { calculateAge, formatDate } from '../../lib/utils';

export default function PatientsListPage() {
  const isAssistant = useIsRole('ASSISTANTE');
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');

  const page = parseInt(searchParams.get('page') ?? '1');
  const archived = searchParams.get('archived') === 'true';

  const { data, isLoading } = useQuery<PaginatedResponse<PatientListItemDto>>({
    queryKey: ['patients', { page, search, archived }],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (archived) params.set('archived', 'true');
      const { data } = await api.get(`/patients?${params}`);
      return data;
    },
    keepPreviousData: true,
  } as any);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams((p) => {
      p.set('search', search);
      p.set('page', '1');
      return p;
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Patients</h1>
          {data && (
            <p className="text-sm text-muted-foreground">
              {data.meta.total} patient{data.meta.total > 1 ? 's' : ''}
            </p>
          )}
        </div>
        {!isAssistant && (
          <Button asChild>
            <Link to="/patients/new">
              <Plus className="w-4 h-4" /> Nouveau patient
            </Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
      <CardContent className="p-4 flex items-center gap-4">
        <form onSubmit={handleSearch} className="flex-1 relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </form>
        <div className="flex items-center gap-2">
          {[false, true].map((a) => (
            <button
              key={String(a)}
              onClick={() =>
                setSearchParams((p) => {
                  if (a) {
                    p.set('archived', 'true');
                  } else {
                    p.delete('archived');
                  }
                  p.set('page', '1');
                  return p;
                })
              }
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                archived === a
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {a ? 'Archivés' : 'Suivis'}
            </button>
          ))}
        </div>
      </CardContent>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <LoadingSpinner />
        ) : !data?.data.length ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">Aucun patient trouvé</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                  Nom
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                  Âge
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                  IMC
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                  Contact
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                  Dernier RDV
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.data.map((patient) => (
                <tr key={patient.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      to={`/patients/${patient.id}`}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {patient.lastName} {patient.firstName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {calculateAge(patient.dateOfBirth ?? null)}
                  </td>
                  <td className="px-4 py-3">
                    {patient.bmi ? <BmiBadge bmi={patient.bmi} /> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {patient.email ?? patient.phone ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {patient.lastAppointmentAt ? formatDate(patient.lastAppointmentAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Pagination */}
      {data && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Page {data.meta.page} sur {data.meta.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() =>
                setSearchParams((p) => {
                  p.set('page', String(page - 1));
                  return p;
                })
              }
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.meta.totalPages}
              onClick={() =>
                setSearchParams((p) => {
                  p.set('page', String(page + 1));
                  return p;
                })
              }
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
