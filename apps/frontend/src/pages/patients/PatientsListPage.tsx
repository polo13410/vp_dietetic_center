import { useQuery } from '@tanstack/react-query';
import type { PaginatedResponse, PatientListItemDto } from '@vp/types';
import { Archive, Plus, Search, UserX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { BmiBadge } from '../../components/patient-file/BmiBadge';
import { EmptyState } from '../../components/shared/EmptyState';
import { PageHeader } from '../../components/shared/PageHeader';
import { Pagination } from '../../components/shared/Pagination';
import { SegmentedControl } from '../../components/shared/SegmentedControl';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { useIsRole } from '../../hooks/useAuth';
import api from '../../lib/api';
import { calculateAge, formatLongDate } from '../../lib/utils';

type Filter = 'current' | 'archived';
const FILTERS = [
  { value: 'current', label: 'Suivis' },
  { value: 'archived', label: 'Archivés' },
] as const;

/** Typing pauses this long before the list is searched */
const SEARCH_DELAY_MS = 300;

/**
 * The patients: those followed by default, archived ones behind the « Archivés » filter.
 * Filter and page live in the address, so going back returns to the same list. The search term
 * does not: a URL ends up in every log (Cloud Run, nginx), and search terms are names. It is kept
 * for the browser tab only (sessionStorage).
 */
const SEARCH_KEY = 'patients-search';

function readStoredSearch(): string {
  try {
    return sessionStorage.getItem(SEARCH_KEY) ?? '';
  } catch {
    return '';
  }
}

function storeSearch(value: string) {
  try {
    if (value) sessionStorage.setItem(SEARCH_KEY, value);
    else sessionStorage.removeItem(SEARCH_KEY);
  } catch {
    // Storage unavailable (private mode): the search simply is not remembered
  }
}

export default function PatientsListPage() {
  // Assistants manage appointments: they neither create patients nor see their BMI
  const isAssistant = useIsRole('ASSISTANTE');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(readStoredSearch);
  const [typed, setTyped] = useState(search);

  const page = parseInt(searchParams.get('page') ?? '1');
  const archived = searchParams.get('archived') === 'true';

  const update = (change: (params: URLSearchParams) => void) =>
    setSearchParams(
      (params) => {
        change(params);
        return params;
      },
      { replace: true },
    );

  useEffect(() => {
    if (typed.trim() === search) return;
    const timer = setTimeout(
      () => {
        setSearch(typed.trim());
        storeSearch(typed.trim());
        update((p) => p.delete('page'));
      },
      SEARCH_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [typed, search]);

  const { data, isLoading } = useQuery<PaginatedResponse<PatientListItemDto>>({
    queryKey: ['patients', { page, search, archived }],
    queryFn: async () => {
      // A search term never goes in a URL, which every layer logs: POST with the term in the body
      if (search) return (await api.post('/patients/search', { search, page, limit: 20, archived })).data;
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (archived) params.set('archived', 'true');
      return (await api.get(`/patients?${params}`)).data;
    },
    placeholderData: (previous) => previous,
  });

  const newPatient = !isAssistant && (
    <Button asChild>
      <Link to="/patients/new">
        <Plus aria-hidden /> Nouveau patient
      </Link>
    </Button>
  );

  return (
    <>
      <PageHeader
        area="patients"
        title="Patients"
        subtitle={
          data
            ? `${data.meta.total} patient${data.meta.total > 1 ? 's' : ''} ${archived ? 'archivé' : 'suivi'}${data.meta.total > 1 ? 's' : ''}`
            : undefined
        }
        actions={newPatient}
      />

      <div className="space-y-6">
        <Card className="flex flex-wrap items-center gap-3 p-3">
          <label htmlFor="patients-search" className="sr-only">
            Rechercher un patient
          </label>
          <div className="relative min-w-[16rem] flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="patients-search"
              type="search"
              placeholder="Rechercher par nom, téléphone ou e-mail"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="pl-10"
            />
          </div>
          <SegmentedControl<Filter>
            label="Patients affichés"
            options={FILTERS}
            value={archived ? 'archived' : 'current'}
            onChange={(filter) =>
              update((p) => {
                if (filter === 'archived') p.set('archived', 'true');
                else p.delete('archived');
                p.delete('page');
              })
            }
          />
        </Card>

        <Card className="overflow-hidden">
          {isLoading ? (
            <LoadingSpinner />
          ) : !data?.data.length ? (
            search ? (
              <EmptyState
                icon={UserX}
                area="patients"
                title="Aucun patient ne correspond à cette recherche."
                description="Vérifiez l’orthographe, ou cherchez par téléphone."
                action={
                  <Button variant="outline" onClick={() => setTyped('')}>
                    Effacer la recherche
                  </Button>
                }
              />
            ) : archived ? (
              <EmptyState
                icon={Archive}
                area="patients"
                title="Aucun patient archivé."
                description="Un patient s’archive depuis son dossier, quand son suivi est terminé."
              />
            ) : (
              <EmptyState illustration="pear" title="Aucun patient pour l’instant." action={newPatient || undefined} />
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead>
                  <tr className="border-b border-border bg-muted text-left text-sm text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Nom</th>
                    <th className="px-5 py-3 font-medium">Âge</th>
                    {!isAssistant && <th className="px-5 py-3 font-medium">IMC</th>}
                    <th className="px-5 py-3 font-medium">Téléphone</th>
                    <th className="px-5 py-3 font-medium">{archived ? 'Archivé le' : 'Dernier rendez-vous'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.data.map((patient) => (
                    <tr
                      key={patient.id}
                      // The whole row opens the file; the name stays a link for the keyboard
                      onClick={() => navigate(`/patients/${patient.id}`)}
                      className="h-14 cursor-pointer transition-colors hover:bg-muted/60"
                    >
                      <td className="px-5 py-3">
                        <Link
                          to={`/patients/${patient.id}`}
                          className="font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {patient.lastName} {patient.firstName}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                        {calculateAge(patient.dateOfBirth ?? null)}
                      </td>
                      {!isAssistant && (
                        <td className="px-5 py-3">
                          {patient.bmi ? <BmiBadge bmi={patient.bmi} /> : <span className="text-muted-foreground">—</span>}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">{patient.phone ?? '—'}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-muted-foreground">
                        {archived
                          ? formatLongDate(patient.archivedAt, true)
                          : patient.lastAppointmentAt
                            ? formatLongDate(patient.lastAppointmentAt, true)
                            : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {data && (
          <Pagination
            page={data.meta.page}
            totalPages={data.meta.totalPages}
            onChange={(next) => update((p) => p.set('page', String(next)))}
          />
        )}
      </div>
    </>
  );
}
