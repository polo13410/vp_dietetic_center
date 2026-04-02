import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';

import { useLogin } from '../../hooks/useAuth';
import { Button } from '../../components/ui/button';

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Mot de passe trop court'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { mutate: login, isPending, error } = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = (data: LoginForm) => login(data);

  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground mb-1">Connexion</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Accédez à votre espace praticienne
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...register('email')}
            className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
            placeholder="praticienne@exemple.fr"
          />
          {errors.email && (
            <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Mot de passe
            </label>
            <Link
              to="/forgot-password"
              className="text-xs text-primary hover:text-primary/80"
            >
              Mot de passe oublié ?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register('password')}
            className="w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
            placeholder="••••••••"
          />
          {errors.password && (
            <p className="text-xs text-destructive mt-1">{errors.password.message}</p>
          )}
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 rounded-lg">
            <p className="text-sm text-destructive">
              Email ou mot de passe incorrect
            </p>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Connexion...
            </>
          ) : (
            'Se connecter'
          )}
        </Button>
      </form>
    </div>
  );
}
