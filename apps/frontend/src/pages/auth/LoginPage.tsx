import { GoogleLogin } from '@react-oauth/google';
import type { TwoFactorChallengeDto } from '@vp/types';
import { Loader2 } from 'lucide-react';
import { type FormEvent, useLayoutEffect, useRef, useState } from 'react';

import { AuthError, AuthTitle } from '../../components/layout/AuthLayout';
import { Field } from '../../components/shared/Field';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useDevLogin, useGoogleLogin } from '../../hooks/useAuth';
import { apiErrorMessage } from '../../hooks/useMe';

import { TwoFactorStep } from './TwoFactorStep';

const NETWORK_ERROR = 'La connexion n’a pas abouti. Vérifiez votre connexion à internet, puis réessayez.';

/** What to tell her when the API refused the sign-in (not registered, deactivated…). */
function signInError(error: unknown): string {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 400 || status === 401 ? apiErrorMessage(error, NETWORK_ERROR) : NETWORK_ERROR;
}

/** Google only lets its button be 200 to 400 px wide: as wide as the card allows. */
function useButtonWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  useLayoutEffect(() => {
    const available = ref.current?.clientWidth;
    if (available) setWidth(Math.max(200, Math.min(400, Math.floor(available))));
  }, []);
  return { ref, width };
}

export default function LoginPage() {
  const { mutate: googleLogin, isPending, error, reset } = useGoogleLogin();
  const [googleFailed, setGoogleFailed] = useState(false);
  const [challenge, setChallenge] = useState<TwoFactorChallengeDto>();
  const button = useButtonWidth();

  // Google is done: the code of her authenticator app opens the session
  if (challenge) {
    return (
      <TwoFactorStep
        challenge={challenge}
        onRestart={() => {
          reset();
          setChallenge(undefined);
        }}
      />
    );
  }

  return (
    <div>
      <AuthTitle title="Connexion">
        Utilisez le compte Google dont l’adresse a été enregistrée pour vous, puis le code de votre
        application d’authentification. Aucun mot de passe à retenir.
      </AuthTitle>

      <div ref={button.ref} className="flex min-h-14 items-center justify-center">
        {isPending ? (
          <p role="status" className="flex items-center gap-2 text-base text-muted-foreground">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            Connexion en cours…
          </p>
        ) : (
          <GoogleLogin
            onSuccess={({ credential }) => {
              setGoogleFailed(false);
              if (credential) googleLogin(credential, { onSuccess: setChallenge });
            }}
            onError={() => setGoogleFailed(true)}
            text="signin_with"
            size="large"
            shape="rectangular"
            width={button.width}
          />
        )}
      </div>

      {(error || googleFailed) && (
        <div className="mt-5">
          <AuthError>{error ? signInError(error) : 'Google n’a pas pu vous connecter. Réessayez.'}</AuthError>
        </div>
      )}

      <p className="mt-6 text-sm text-muted-foreground">
        Pas encore de compte ? Demandez à l’administratrice de l’application de l’ajouter avec
        l’adresse de votre compte Google.
      </p>

      {/* Removed from production builds; the API has the route only with DEV_LOGIN=true */}
      {import.meta.env.DEV && <DevLoginForm />}
    </div>
  );
}

/** Local development and end-to-end tests: sign in with a registered e-mail, without Google. */
function DevLoginForm() {
  const { mutate: devLogin, isPending, error } = useDevLogin();
  const [email, setEmail] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (email.trim()) devLogin(email.trim());
  };
  const status = (error as { response?: { status?: number } } | null)?.response?.status;

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 border-t border-dashed border-border pt-6" noValidate>
      <p className="text-sm font-medium text-muted-foreground">Développement local uniquement</p>
      <Field label="Adresse e-mail d’un compte enregistré">
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="praticienne@vp-dietetic.fr"
        />
      </Field>
      {error && (
        <AuthError>
          {status === 404
            ? 'La connexion de développement est désactivée : ajoutez DEV_LOGIN=true dans apps/api/.env, puis relancez l’API.'
            : signInError(error)}
        </AuthError>
      )}
      <Button type="submit" variant="outline" className="w-full" disabled={isPending}>
        {isPending && <Loader2 className="animate-spin" aria-hidden />}
        Connexion de développement
      </Button>
    </form>
  );
}
