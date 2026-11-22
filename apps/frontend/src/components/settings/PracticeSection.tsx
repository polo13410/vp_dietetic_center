import type { PracticeDto } from '@vp/types';
import { Building2 } from 'lucide-react';

import { useUpdatePractice } from '../../hooks/useMe';
import { adeliRppsError, digitsOnly, siretError, zipCodeError } from '../../lib/settings-format';
import { Section } from '../shared/Section';

import { AutosaveField, SaveIndicator, useSaveTracker } from './autosave';

/** The practice details printed on each invoice (lot 5). */
export function PracticeSection({ practice }: { practice: PracticeDto }) {
  const { state, track } = useSaveTracker();
  const { mutateAsync: update } = useUpdatePractice();
  const save = (field: keyof PracticeDto) => (value: string | null) => update({ [field]: value });

  return (
    <Section
      icon={Building2}
      area="settings"
      title="Mon cabinet"
      description="Ces informations figurent sur vos factures."
      action={<SaveIndicator state={state} />}
    >
      <div className="grid gap-5 sm:grid-cols-6">
        <AutosaveField
          className="sm:col-span-6"
          label="Nom affiché sur les factures"
          hint="Par exemple : Valérie Perrot, diététicienne nutritionniste."
          value={practice.practiceName}
          onSave={save('practiceName')}
          track={track}
        />
        <AutosaveField
          className="sm:col-span-6"
          label="Adresse"
          hint="Numéro et rue."
          value={practice.address}
          onSave={save('address')}
          track={track}
          inputProps={{ autoComplete: 'street-address' }}
        />
        <AutosaveField
          className="sm:col-span-2"
          label="Code postal"
          value={practice.zipCode}
          validate={zipCodeError}
          onSave={save('zipCode')}
          track={track}
          inputProps={{ inputMode: 'numeric', autoComplete: 'postal-code' }}
        />
        <AutosaveField
          className="sm:col-span-4"
          label="Ville"
          value={practice.city}
          onSave={save('city')}
          track={track}
          inputProps={{ autoComplete: 'address-level2' }}
        />
        <AutosaveField
          className="sm:col-span-3"
          label="SIRET"
          hint="14 chiffres, sur votre avis de situation Insee."
          value={practice.siret}
          validate={siretError}
          onSave={(siret) => update({ siret: siret && digitsOnly(siret) })}
          track={track}
          inputProps={{ inputMode: 'numeric' }}
        />
        <AutosaveField
          className="sm:col-span-3"
          label="N° ADELI ou RPPS"
          hint="9 chiffres (ADELI) ou 11 chiffres (RPPS)."
          value={practice.adeliRpps}
          validate={adeliRppsError}
          onSave={(adeliRpps) => update({ adeliRpps: adeliRpps && digitsOnly(adeliRpps) })}
          track={track}
          inputProps={{ inputMode: 'numeric' }}
        />
        <AutosaveField
          className="sm:col-span-6"
          label="Mention TVA"
          hint="Celle que votre comptable vous a indiquée, par exemple « TVA non applicable, article 261-4-1° du CGI »."
          value={practice.vatMention}
          onSave={save('vatMention')}
          track={track}
        />
        <AutosaveField
          className="sm:col-span-6"
          label="Mentions en bas de facture"
          hint="Facultatif. Par exemple vos conditions de règlement."
          value={practice.invoiceFooter}
          onSave={save('invoiceFooter')}
          track={track}
          multiline
        />
      </div>
    </Section>
  );
}
