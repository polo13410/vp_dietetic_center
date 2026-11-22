import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';

import { AuthDone, AuthError, AuthTitle } from '../../components/layout/AuthLayout';
import { Field } from '../../components/shared/Field';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import api from '../../lib/api';

const schema = z.object({ email: z.string().email('L’adresse e-mail n’est pas valide.') });
type Form = z.infer<typeof schema>;

const backToLogin = (
  <Link
    to="/login"
    className="inline-flex min-h-11 items-center gap-2 text-base font-medium text-muted-foreground hover:text-foreground"
  >
    <ArrowLeft className="size-5" aria-hidden /> Retour à la connexion
  </Link>
);

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    try {
      await api.post('/auth/forgot-password', data);
      setSent(true);
    } catch {
      setError('root', { message: 'Le lien n’a pas pu être envoyé. Réessayez dans un instant.' });
    }
  };

  if (sent) {
    return (
      <AuthDone icon={MailCheck} title="Regardez vos e-mails" action={backToLogin}>
        Si un compte existe avec cette adresse, vous allez recevoir un lien pour choisir un nouveau mot de passe.
      </AuthDone>
    );
  }

  return (
    <div>
      <AuthTitle title="Mot de passe oublié">
        Indiquez votre adresse e-mail : vous recevrez un lien pour choisir un nouveau mot de passe.
      </AuthTitle>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <Field label="Adresse e-mail" error={errors.email?.message}>
          <Input type="email" inputMode="email" autoComplete="email" {...register('email')} />
        </Field>
        {errors.root && <AuthError>{errors.root.message}</AuthError>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          Envoyer le lien
        </Button>
      </form>
      <div className="mt-4 text-center">{backToLogin}</div>
    </div>
  );
}
