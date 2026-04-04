import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, User } from 'lucide-react';
import { useState } from 'react';

import api from '../../lib/api';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
}

interface PatientComboboxProps {
  value?: string;
  onChange: (patientId: string | undefined, patient?: Patient) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function PatientCombobox({
  value,
  onChange,
  placeholder = 'Selectionner un patient...',
  disabled = false,
  className,
}: PatientComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data } = useQuery({
    queryKey: ['patients', 'combobox', search],
    queryFn: async () => {
      const res = await api.get('/patients', { params: { search, limit: 10 } });
      return res.data.data as Patient[];
    },
    enabled: open,
  });

  const patients = data ?? [];
  const selectedPatient = patients.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground', className)}
        >
          {selectedPatient ? (
            <span className="flex items-center gap-2">
              <User className="h-4 w-4 shrink-0" />
              {selectedPatient.firstName} {selectedPatient.lastName}
            </span>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Rechercher un patient..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>Aucun patient trouve.</CommandEmpty>
            <CommandGroup>
              {patients.map((patient) => (
                <CommandItem
                  key={patient.id}
                  value={patient.id}
                  onSelect={() => {
                    onChange(patient.id === value ? undefined : patient.id, patient);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn('mr-2 h-4 w-4', value === patient.id ? 'opacity-100' : 'opacity-0')}
                  />
                  {patient.firstName} {patient.lastName}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
