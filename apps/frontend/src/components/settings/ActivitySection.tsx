import type { ActivityDto } from '@vp/types';
import { BadgeCheck } from 'lucide-react';

import { useUpdateActivity } from '../../hooks/useMe';
import { adeliRppsError, digitsOnly, siretError } from '../../lib/settings-format';
import { Section } from '../shared/Section';

import { AutosaveField, SaveIndicator, useSaveTracker } from './autosave';

/** Who she is, printed on each invoice (lot 5). Where she consults is in « Mes cabinets ». */
export function ActivitySection({ activity }: { activity: ActivityDto }) {
  const { state, track } = useSaveTracker();
  const { mutateAsync: update } = useUpdateActivity();
  const save = (field: keyof ActivityDto) => (value: string | null) => update({ [field]: value });

  return (
    <Section
      icon={BadgeCheck}
      area="settings"
      title="Mon activité"
      description="Ces informations figurent sur toutes vos factures, quel que soit le cabinet."
      action={<SaveIndicator state={state} />}
    >
      <div className="grid gap-5 sm:grid-cols-6">
        <AutosaveField
          className="sm:col-span-6"
          label="Nom affiché sur les factures"
          hint="Par exemple : Valérie Dupont, diététicienne nutritionniste."
          value={activity.practiceName}
          onSave={save('practiceName')}
          track={track}
        />
        <AutosaveField
          className="sm:col-span-3"
          label="SIRET"
          hint="14 chiffres, sur votre avis de situation Insee."
          value={activity.siret}
          validate={siretError}
          onSave={(siret) => update({ siret: siret && digitsOnly(siret) })}
          track={track}
          inputProps={{ inputMode: 'numeric' }}
        />
        <AutosaveField
          className="sm:col-span-3"
          label="N° ADELI ou RPPS"
          hint="9 chiffres (ADELI) ou 11 chiffres (RPPS)."
          value={activity.adeliRpps}
          validate={adeliRppsError}
          onSave={(adeliRpps) => update({ adeliRpps: adeliRpps && digitsOnly(adeliRpps) })}
          track={track}
          inputProps={{ inputMode: 'numeric' }}
        />
        <AutosaveField
          className="sm:col-span-6"
          label="Mention TVA"
          hint="Celle que votre comptable vous a indiquée, par exemple « TVA non applicable, article 261-4-1° du CGI »."
          value={activity.vatMention}
          onSave={save('vatMention')}
          track={track}
        />
        <AutosaveField
          className="sm:col-span-6"
          label="Mentions en bas de facture"
          hint="Facultatif. Par exemple vos conditions de règlement."
          value={activity.invoiceFooter}
          onSave={save('invoiceFooter')}
          track={track}
          multiline
        />
      </div>
    </Section>
  );
}
