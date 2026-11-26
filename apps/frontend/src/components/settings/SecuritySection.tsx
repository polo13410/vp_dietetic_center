import type { MeDto } from '@vp/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ExternalLink, LockKeyhole } from 'lucide-react';

import { Section } from '../shared/Section';

/** Google's page where two-step verification is turned on. */
export const GOOGLE_TWO_STEP_URL = 'https://myaccount.google.com/signinoptions/two-step-verification';

function codesLeft(count: number) {
  return count === 0 ? 'aucun code de secours restant' : `${count} code${count > 1 ? 's' : ''} de secours restant${count > 1 ? 's' : ''}`;
}

/**
 * No password in the app: she signs in with Google, then a code of her authenticator app.
 * Information only (a lost phone is reset by the administrator).
 */
export function SecuritySection({ me }: { me: MeDto }) {
  return (
    <Section icon={LockKeyhole} area="settings" title="Sécurité" description="Votre façon de vous connecter.">
      <div className="space-y-4 rounded-lg bg-muted p-4 text-base">
        <p>
          Vous vous connectez avec votre compte Google <strong className="break-all">{me.email}</strong>, puis
          le code de votre application d’authentification.
        </p>
        {me.twoFactorEnabledAt && (
          <p>
            Double authentification active depuis le{' '}
            {format(new Date(me.twoFactorEnabledAt), 'd MMMM yyyy', { locale: fr })}, {codesLeft(me.recoveryCodesLeft)}.
            Téléphone perdu ou plus de codes : demandez à l’administratrice de la réinitialiser.
          </p>
        )}
        <p>Pour plus de sécurité, activez aussi la validation en deux étapes sur votre compte Google.</p>
        <a
          href={GOOGLE_TWO_STEP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 font-medium text-primary underline-offset-4 hover:underline"
        >
          Activer la validation en deux étapes sur Google
          <ExternalLink className="size-4 shrink-0" aria-hidden />
          <span className="sr-only">(s’ouvre dans un nouvel onglet)</span>
        </a>
      </div>
    </Section>
  );
}
