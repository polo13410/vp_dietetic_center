import type { MeDto } from '@vp/types';
import { CheckCircle2, LockKeyhole } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link } from 'react-router';

import { apiErrorMessage, useChangePassword } from '../../hooks/useMe';
import { Field } from '../shared/Field';
import { Section } from '../shared/Section';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

type Errors = { current?: string; next?: string; confirm?: string; form?: string };

/** Same rule as the API: 8 characters or more, a capital letter and a digit. */
function newPasswordError(password: string): string | undefined {
  if (password.length < 8) return 'Le nouveau mot de passe doit compter au moins 8 caractères.';
  if (!/[A-Z]/.test(password) || !/\d/.test(password)) {
    return 'Le nouveau mot de passe doit contenir au moins une majuscule et un chiffre.';
  }
  return undefined;
}

export function SecuritySection({ me }: { me: MeDto }) {
  return (
    <Section
      icon={LockKeyhole}
      area="settings"
      title="Sécurité"
      description={me.hasPassword ? 'Votre mot de passe.' : 'Votre façon de vous connecter.'}
    >
      {me.hasPassword ? (
        <PasswordForm googleLinked={me.googleLinked} />
      ) : (
        <p className="rounded-lg bg-muted p-4 text-base">
          Vous vous connectez avec Google ({me.email}). Ce compte n’a pas de mot de passe : il n’y a
          rien à changer ici.
        </p>
      )}
    </Section>
  );
}

function PasswordForm({ googleLinked }: { googleLinked: boolean }) {
  const { mutateAsync: changePassword, isPending } = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setDone(false);
    const found: Errors = {
      current: current ? undefined : 'Indiquez votre mot de passe actuel.',
      next: newPasswordError(next),
      confirm: confirm === next ? undefined : 'Les deux mots de passe ne sont pas identiques.',
    };
    setErrors(found);
    if (found.current || found.next || found.confirm) return;
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
    } catch (error) {
      const message = apiErrorMessage(error, 'Le mot de passe n’a pas été changé. Vérifiez votre connexion et réessayez.');
      setErrors(message.includes('actuel') ? { current: message } : { form: message });
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-5">
      {googleLinked && (
        <p className="text-base text-muted-foreground">Vous pouvez aussi vous connecter avec Google.</p>
      )}
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Mot de passe actuel" error={errors.current}>
          <Input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <Field
          label="Nouveau mot de passe"
          hint="8 caractères ou plus, dont une majuscule et un chiffre."
          error={errors.next}
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </Field>
        <Field label="Nouveau mot de passe, encore une fois" error={errors.confirm}>
          <Input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
      </div>
      {errors.form && (
        <p role="alert" className="text-base font-medium text-destructive">
          {errors.form}
        </p>
      )}
      {done && (
        <p role="status" className="flex items-center gap-2 text-base text-success">
          <CheckCircle2 className="size-5 shrink-0" aria-hidden />
          Mot de passe changé. Vos autres appareils ont été déconnectés.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Button type="submit" disabled={isPending}>
          Changer le mot de passe
        </Button>
        <Link
          to="/forgot-password"
          className="inline-flex min-h-11 items-center text-base text-primary underline-offset-4 hover:underline"
        >
          Mot de passe actuel oublié ?
        </Link>
      </div>
    </form>
  );
}
