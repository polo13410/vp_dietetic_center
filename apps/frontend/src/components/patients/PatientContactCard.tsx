import { Mail, MapPin, Phone, UserRound } from 'lucide-react';

import type { Patient } from '../../lib/patient-file';
import { Section } from '../shared/Section';

/** Contact details only, for the assistant's administrative view (no clinical data). */
export function PatientContactCard({ patient }: { patient: Patient }) {
  const address = [patient.address, [patient.zipCode, patient.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const rows = [
    { icon: Phone, label: 'Téléphone', value: patient.phone, href: patient.phone && `tel:${patient.phone.replace(/[^\d+]/g, '')}` },
    { icon: Mail, label: 'E-mail', value: patient.email, href: patient.email && `mailto:${patient.email}` },
    { icon: MapPin, label: 'Adresse', value: address || null, href: null },
  ];
  return (
    <Section size="compact" icon={UserRound} area="patients" title="Coordonnées">
      <dl className="space-y-1.5">
        {rows.map(({ icon: Icon, label, value, href }) => (
          <div key={label} className="flex items-start gap-3">
            <dt className="pt-0.5 text-muted-foreground">
              <Icon className="size-5" aria-hidden />
              <span className="sr-only">{label}</span>
            </dt>
            <dd className="min-w-0 flex-1 break-words">
              {!value ? (
                <span className="text-muted-foreground">{label} : non renseigné</span>
              ) : href ? (
                <a href={href} className="-my-2 inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">
                  {value}
                </a>
              ) : (
                value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
