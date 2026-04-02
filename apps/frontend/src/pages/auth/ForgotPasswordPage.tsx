import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';

import api from '../../lib/api';
import { Button } from '../../components/ui/button';

const schema = z.object({ email: z.string().email('Email invalide') });
type Form = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: Form) => {
    await api.post('/auth/forgot-password', data);
    setSent(true);
  };

  if (sent) {
    return (
      <div className="text-center">
        <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">✉️</span>
        </div>
        <h2 className="text-lg font-semibold mb-2">Email envoyé</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.
        </p>
        <Link to="/login" className="text-sm text-primary hover:underline">
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-1">Mot de passe oublié</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Entrez votre email pour recevoir un lien de réinitialisation.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Email</label>
          <input
            type="email"
            {...register('email')}
            className="w-full px-3 py-2 text-sm border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Envoyer le lien'}
        </Button>
      </form>
      <div className="mt-4 text-center">
        <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Retour à la connexion
        </Link>
      </div>
    </div>
  );
}
