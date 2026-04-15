import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';

import { Button } from '../../components/ui/button';
import api from '../../lib/api';

const schema = z
  .object({
    password: z.string().min(8, 'Minimum 8 caractères'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Les mots de passe ne correspondent pas',
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
      setError('root', { message: 'Lien invalide ou expiré. Faites une nouvelle demande.' });
    }
  };

  if (done) {
    return (
      <div className="text-center">
        <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-6 h-6 text-green-500" />
        </div>
        <h2 className="text-lg font-semibold mb-2">Mot de passe mis à jour</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
        </p>
        <Link to="/login" className="text-sm text-primary hover:underline">
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">Nouveau mot de passe</h2>
      <p className="text-sm text-muted-foreground mb-6">Choisissez un mot de passe sécurisé.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Nouveau mot de passe</label>
          <input
            type="password"
            {...register('password')}
            className="w-full px-3 py-2 text-sm border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {errors.password && (
            <p className="text-xs text-destructive mt-1">{errors.password.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Confirmer le mot de passe</label>
          <input
            type="password"
            {...register('confirm')}
            className="w-full px-3 py-2 text-sm border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {errors.confirm && (
            <p className="text-xs text-destructive mt-1">{errors.confirm.message}</p>
          )}
        </div>
        {errors.root && (
          <p className="text-xs text-destructive">{errors.root.message}</p>
        )}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mettre à jour'}
        </Button>
      </form>
    </div>
  );
}
