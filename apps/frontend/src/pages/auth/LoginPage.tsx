import { zodResolver } from '@hookform/resolvers/zod';
import { GoogleLogin } from '@react-oauth/google';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';

import { AuthError, AuthTitle } from '../../components/layout/AuthLayout';
import { Field } from '../../components/shared/Field';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useGoogleLogin, useLogin } from '../../hooks/useAuth';

const loginSchema = z.object({
  email: z.string().email('L’adresse e-mail n’est pas valide.'),
  password: z.string().min(8, 'Le mot de passe compte au moins 8 caractères.'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { mutate: login, isPending, error } = useLogin();
  const { mutate: googleLogin, error: googleError } = useGoogleLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  return (
    <div>
      <AuthTitle title="Connexion">Accédez à votre espace.</AuthTitle>

      <form onSubmit={handleSubmit((data) => login(data))} className="space-y-5" noValidate>
        <Field label="Adresse e-mail" error={errors.email?.message}>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            {...register('email')}
            placeholder="praticienne@exemple.fr"
          />
        </Field>

        <div className="space-y-1">
          <Field label="Mot de passe" error={errors.password?.message}>
            <Input type="password" autoComplete="current-password" {...register('password')} />
          </Field>
          <Link
            to="/forgot-password"
            className="inline-flex min-h-11 items-center text-base font-medium text-primary hover:underline"
          >
            Mot de passe oublié ?
          </Link>
        </div>

        {error && <AuthError>E-mail ou mot de passe incorrect. Vérifiez-les et réessayez.</AuthError>}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" aria-hidden />}
          Se connecter
        </Button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-border" />
        </div>
        <p className="relative flex justify-center text-sm">
          <span className="bg-card px-3 text-muted-foreground">ou</span>
        </p>
      </div>

      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={(credentialResponse) => {
            if (credentialResponse.credential) {
              googleLogin(credentialResponse.credential);
            }
          }}
          onError={() => {}}
          text="signin_with"
          size="large"
        />
      </div>

      {googleError && (
        <div className="mt-4">
          <AuthError>Impossible de se connecter avec Google. Vérifiez que votre compte est autorisé.</AuthError>
        </div>
      )}
    </div>
  );
}
