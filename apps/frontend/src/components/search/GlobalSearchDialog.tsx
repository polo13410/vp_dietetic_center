import { useQuery } from '@tanstack/react-query';
import { Calendar, FileText, Loader2, Plus, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import api from '../../lib/api';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '../ui/command';

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  // Reset query when dialog opens
  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: ['search', query],
    queryFn: async () => {
      const { data } = await api.get('/search', { params: { q: query } });
      return data;
    },
    enabled: open && query.length >= 2,
    placeholderData: (prev) => prev,
  });

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const patients = data?.patients ?? [];
  const appointments = data?.appointments ?? [];
  const notes = data?.notes ?? [];
  const hasResults = patients.length > 0 || appointments.length > 0 || notes.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Rechercher un patient, rendez-vous, note..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {query.length < 2 ? (
          /* Quick actions when no query */
          <CommandGroup heading="Actions rapides">
            <CommandItem onSelect={() => go('/patients/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau patient
            </CommandItem>
            <CommandItem onSelect={() => go('/notes/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle note clinique
            </CommandItem>
            <CommandItem onSelect={() => go('/appointments')}>
              <Calendar className="mr-2 h-4 w-4" />
              Voir les rendez-vous
            </CommandItem>
          </CommandGroup>
        ) : isFetching && !hasResults ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Recherche...
          </div>
        ) : !hasResults ? (
          <CommandEmpty>Aucun resultat pour "{query}"</CommandEmpty>
        ) : (
          <>
            {patients.length > 0 && (
              <CommandGroup heading="Patients">
                {patients.map((p: any) => (
                  <CommandItem key={p.id} onSelect={() => go(`/patients/${p.id}`)}>
                    <User className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{p.lastName} {p.firstName}</span>
                    {p.email && (
                      <span className="ml-2 text-xs text-muted-foreground">{p.email}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {appointments.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Rendez-vous">
                  {appointments.map((a: any) => (
                    <CommandItem key={a.id} onSelect={() => go(`/appointments/${a.id}`)}>
                      <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>
                        {a.patient?.lastName} {a.patient?.firstName}
                      </span>
                      {a.reason && (
                        <span className="ml-2 text-xs text-muted-foreground truncate">
                          {a.reason}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {notes.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Notes">
                  {notes.map((n: any) => (
                    <CommandItem key={n.id} onSelect={() => go(`/notes/${n.id}`)}>
                      <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>{n.title || 'Note sans titre'}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
