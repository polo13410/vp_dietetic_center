import type { MeDto } from '@vp/types';
import { UserRound } from 'lucide-react';

import { useUpdateMe } from '../../hooks/useMe';
import { phoneError } from '../../lib/settings-format';
import { Section } from '../shared/Section';

import { AutosaveField, SaveIndicator, useSaveTracker } from './autosave';

export function ProfileSection({ me }: { me: MeDto }) {
  const { state, track } = useSaveTracker();
  const { mutateAsync: update } = useUpdateMe();

  return (
    <Section
      icon={UserRound}
      area="settings"
      title="Mon profil"
      description="Votre nom et votre téléphone."
      action={<SaveIndicator state={state} />}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <AutosaveField
          label="Prénom"
          value={me.firstName}
          requiredMessage="Le prénom ne peut pas être vide."
          onSave={(firstName) => update({ firstName: firstName ?? '' })}
          track={track}
          inputProps={{ autoComplete: 'given-name' }}
        />
        <AutosaveField
          label="Nom"
          value={me.lastName}
          requiredMessage="Le nom ne peut pas être vide."
          onSave={(lastName) => update({ lastName: lastName ?? '' })}
          track={track}
          inputProps={{ autoComplete: 'family-name' }}
        />
        <AutosaveField
          label="Téléphone"
          value={me.phone}
          validate={phoneError}
          onSave={(phone) => update({ phone })}
          track={track}
          inputProps={{ type: 'tel', inputMode: 'tel', autoComplete: 'tel', placeholder: '06 12 34 56 78' }}
        />
        <div className="space-y-1.5">
          <p className="text-base font-medium">Adresse e-mail</p>
          <p className="text-sm text-muted-foreground">
            {me.role === 'ADMIN'
              ? 'Elle sert à vous connecter. Elle se modifie dans « Utilisateurs ».'
              : 'Elle sert à vous connecter. Pour la changer, contactez la personne qui gère l’application.'}
          </p>
          <p className="flex min-h-11 items-center break-all rounded-lg bg-muted px-3 text-base">
            {me.email}
          </p>
        </div>
      </div>
    </Section>
  );
}
