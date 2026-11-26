import type { TwoFactorChallengeDto } from '@vp/types';
import { Loader2 } from 'lucide-react';
import QRCode from 'qrcode';
import { type FormEvent, useEffect, useState } from 'react';

import { AuthError, AuthTitle } from '../../components/layout/AuthLayout';
import { Field } from '../../components/shared/Field';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { type LoginResponse, useOpenSession, useTwoFactor } from '../../hooks/useAuth';
import { apiErrorMessage } from '../../hooks/useMe';

const FAILED = 'La vérification n’a pas abouti. Vérifiez votre connexion à internet, puis réessayez.';

/** The QR code of the link her authenticator app reads (an SVG image, nothing sent anywhere). */
function useQrCode(text: string | undefined) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    if (!text) return;
    let cancelled = false;
    QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
      .then((svg) => !cancelled && setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`))
      .catch(() => undefined); // the secret stays shown in text
    return () => {
      cancelled = true;
    };
  }, [text]);
  return src;
}

/** The secret in groups of four, easier to type into an app by hand. */
function grouped(secret: string) {
  return secret.match(/.{1,4}/g)?.join(' ') ?? secret;
}

/**
 * Second step of the sign-in, after Google: the 6-digit code of her authenticator app. The first
 * time (or after a reset), she adds the app first with the QR code; then she keeps her recovery
 * codes, shown once.
 */
export function TwoFactorStep({ challenge, onRestart }: { challenge: TwoFactorChallengeDto; onRestart: () => void }) {
  const { mutate, isPending, error } = useTwoFactor();
  const openSession = useOpenSession();
  const [code, setCode] = useState('');
  const [session, setSession] = useState<LoginResponse>();
  const qr = useQrCode(challenge.setup?.otpauthUrl);
  const status = (error as { response?: { status?: number } } | null)?.response?.status;

  if (session?.recoveryCodes?.length) {
    return <RecoveryCodes codes={session.recoveryCodes} onDone={() => openSession(session)} />;
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;
    mutate(
      { challengeToken: challenge.challengeToken, code: code.trim() },
      {
        onSuccess: (data) => (data.recoveryCodes?.length ? setSession(data) : openSession(data)),
        onError: () => setCode(''),
      },
    );
  };

  return (
    <div>
      {challenge.setup ? (
        <AuthTitle title="Protéger votre compte">
          Une seule fois : ajoutez l’application à une application d’authentification de votre téléphone
          (Google Authenticator, Microsoft Authenticator…). Elle vous donnera un code à chaque connexion.
        </AuthTitle>
      ) : (
        <AuthTitle title="Code de vérification">
          Ouvrez votre application d’authentification et tapez le code à 6 chiffres affiché pour VP Dietetic
          Center.
        </AuthTitle>
      )}

      {challenge.setup && (
        <ol className="mb-6 list-decimal space-y-4 pl-5 text-base">
          <li>
            Dans l’application, choisissez « Ajouter » ou « + », puis scannez ce code :
            <div className="mt-3 flex justify-center">
              {qr ? (
                <img src={qr} alt="QR code à scanner avec l’application d’authentification" className="size-48 rounded-lg bg-white p-2" />
              ) : (
                <div className="flex size-48 items-center justify-center rounded-lg bg-muted" aria-hidden>
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Impossible de scanner ? Saisissez cette clé dans l’application :
            </p>
            <p className="mt-1 break-all rounded-lg bg-muted px-3 py-2 text-center font-mono text-base tracking-wide">
              {grouped(challenge.setup.secret)}
            </p>
          </li>
          <li>Tapez ci-dessous le code à 6 chiffres que l’application affiche.</li>
        </ol>
      )}

      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label={challenge.setup ? 'Code affiché par l’application' : 'Code à 6 chiffres ou code de secours'}>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode={challenge.setup ? 'numeric' : 'text'}
            autoComplete="one-time-code"
            autoCapitalize="characters"
            autoFocus
            maxLength={20}
            className="text-center font-mono text-lg tracking-widest"
          />
        </Field>
        {error && <AuthError>{status === 401 || status === 400 ? apiErrorMessage(error, FAILED) : FAILED}</AuthError>}
        <Button type="submit" className="w-full" disabled={isPending || !code.trim()}>
          {isPending && <Loader2 className="animate-spin" aria-hidden />}
          Valider
        </Button>
      </form>

      <div className="mt-6 space-y-3 text-sm text-muted-foreground">
        {!challenge.setup && (
          <p>
            Téléphone perdu ? Tapez l’un de vos codes de secours. Sans eux, demandez à l’administratrice de
            réinitialiser votre double authentification.
          </p>
        )}
        <button type="button" onClick={onRestart} className="min-h-11 font-medium text-primary underline-offset-4 hover:underline">
          Recommencer avec Google
        </button>
      </div>
    </div>
  );
}

/** Shown once, right after the set-up: what to keep somewhere safe, away from the phone. */
function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [kept, setKept] = useState(false);
  return (
    <div>
      <AuthTitle title="Vos codes de secours">
        Si vous perdez votre téléphone, chacun de ces codes remplace une fois le code de l’application.
        Notez-les ou imprimez-les, et rangez-les loin du téléphone : ils ne seront plus affichés.
      </AuthTitle>
      <ul className="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-muted p-4 font-mono text-base" aria-label="Codes de secours">
        {codes.map((c) => (
          <li key={c} className="text-center tracking-wide">
            {c}
          </li>
        ))}
      </ul>
      <div className="mb-4 flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={() => window.print()}>
          Imprimer
        </Button>
      </div>
      <label className="mb-4 flex min-h-11 items-center gap-3 text-base">
        <input type="checkbox" className="size-5" checked={kept} onChange={(e) => setKept(e.target.checked)} />
        J’ai noté mes codes de secours
      </label>
      <Button type="button" className="w-full" disabled={!kept} onClick={onDone}>
        Continuer
      </Button>
    </div>
  );
}
