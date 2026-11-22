import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';

import { AuthDone, AuthError, AuthTitle } from '../../components/layout/AuthLayout';
import { Field } from '../../components/shared/Field';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import api from '../../lib/api';

const schema = z
  .object({
    password: z.string().min(8, 'Choisissez au moins 8 caractères.'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Les deux mots de passe ne sont pas identiques.',
    path: ['confirm'],
  });

type Form = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<Form>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!token) navigate('/forgot-password', { replace: true });
  }, [token, navigate]);

  const onSubmit = async (data: Form) => {
    try {
      await api.post('/auth/reset-password', { token, password: data.password });
      setDone(true);
    } catch {
      setError('root', { message: 'Ce lien n’est plus valable. Demandez-en un nouveau.' });
    }
  };

  if (done) {
    return (
      <AuthDone
        icon={CheckCircle2}
        title="Mot de passe changé"
        action={
          <Button asChild className="w-full">
            <Link to="/login">Se connecter</Link>
          </Button>
        }
      >
        Vous pouvez vous connecter avec votre nouveau mot de passe.
      </AuthDone>
    );
  }

  return (
    <div>
      <AuthTitle title="Nouveau mot de passe">Au moins 8 caractères, que vous n’utilisez pas ailleurs.</AuthTitle>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <Field label="Nouveau mot de passe" error={errors.password?.message}>
          <Input type="password" autoComplete="new-password" {...register('password')} />
        </Field>
        <Field label="Confirmez le mot de passe" error={errors.confirm?.message}>
          <Input type="password" autoComplete="new-password" {...register('confirm')} />
        </Field>
        {errors.root && (
          <AuthError>
            {errors.root.message}{' '}
            <Link to="/forgot-password" className="font-medium underline">
              Demander un lien
            </Link>
          </AuthError>
        )}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          Changer le mot de passe
        </Button>
      </form>
    </div>
  );
}
