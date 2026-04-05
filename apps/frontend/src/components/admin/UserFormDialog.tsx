import { zodResolver } from '@hookform/resolvers/zod';
import type { UserDto, UserRole } from '@vp/types';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

// ─── Schema ──────────────────────────────────────────────────────────────────

const createSchema = z.object({
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  email: z.string().email('Email invalide'),
  password: z
    .string()
    .min(8, 'Minimum 8 caractères')
    .regex(/[A-Z]/, 'Au moins une majuscule')
    .regex(/\d/, 'Au moins un chiffre'),
  role: z.enum(['ADMIN', 'PRATICIENNE', 'ASSISTANTE']),
});

const editSchema = z.object({
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  email: z.string().email('Email invalide'),
  password: z
    .string()
    .min(8, 'Minimum 8 caractères')
    .regex(/[A-Z]/, 'Au moins une majuscule')
    .regex(/\d/, 'Au moins un chiffre')
    .or(z.literal('')),
  role: z.enum(['ADMIN', 'PRATICIENNE', 'ASSISTANTE']),
});

type UserFormData = z.infer<typeof createSchema>;

// ─── Role labels ─────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administratrice',
  PRATICIENNE: 'Praticienne',
  ASSISTANTE: 'Assistante',
};

// ─── Component ───────────────────────────────────────────────────────────────

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserDto | null;
  onSubmit: (data: any) => void;
  isPending: boolean;
}

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  onSubmit,
  isPending,
}: UserFormDialogProps) {
  const isEdit = !!user;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      role: 'PRATICIENNE' as UserRole,
    },
  });

  useEffect(() => {
    if (open) {
      reset(
        user
          ? {
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              password: '',
              role: user.role,
            }
          : {
              firstName: '',
              lastName: '',
              email: '',
              password: '',
              role: 'PRATICIENNE' as UserRole,
            },
      );
    }
  }, [open, user, reset]);

  const handleFormSubmit = (data: UserFormData) => {
    if (isEdit) {
      const payload: Record<string, unknown> = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        role: data.role,
      };
      if (data.password) {
        payload.password = data.password;
      }
      onSubmit(payload);
    } else {
      onSubmit(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier l\u2019utilisateur' : 'Nouvel utilisateur'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Modifiez les informations du compte.'
              : 'Créez un nouveau compte utilisateur.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom *" error={errors.firstName?.message}>
              <input {...register('firstName')} placeholder="Marie" className={inputClass} />
            </Field>
            <Field label="Nom *" error={errors.lastName?.message}>
              <input {...register('lastName')} placeholder="Dupont" className={inputClass} />
            </Field>
          </div>

          <Field label="Email *" error={errors.email?.message}>
            <input
              type="email"
              {...register('email')}
              placeholder="praticienne@exemple.fr"
              className={inputClass}
            />
          </Field>

          <Field
            label={isEdit ? 'Nouveau mot de passe' : 'Mot de passe *'}
            error={errors.password?.message}
          >
            <input
              type="password"
              {...register('password')}
              placeholder={isEdit ? 'Laisser vide pour ne pas changer' : '••••••••'}
              className={inputClass}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Min. 8 caractères, 1 majuscule, 1 chiffre
            </p>
          </Field>

          <Field label="Rôle *">
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isEdit ? (
                'Enregistrer'
              ) : (
                'Créer le compte'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inputClass =
  'w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50';

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
