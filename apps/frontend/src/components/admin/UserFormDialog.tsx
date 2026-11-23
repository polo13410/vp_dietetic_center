import { zodResolver } from '@hookform/resolvers/zod';
import { type CreateUserDto, type UpdateUserDto, type UserDto, UserRole } from '@vp/types';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Field } from '../shared/Field';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  firstName: z.string().trim().min(1, 'Indiquez le prénom.'),
  lastName: z.string().trim().min(1, 'Indiquez le nom.'),
  email: z.string().email('L’adresse e-mail n’est pas valide.'),
  role: z.enum(UserRole),
});

type UserFormData = z.infer<typeof schema>;

// ─── Role labels ─────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administratrice',
  PRATICIENNE: 'Praticienne',
  ASSISTANTE: 'Assistante',
};

const ROLE_HINT =
  'Les praticiennes et assistantes voient les patients ; l’administratrice gère les comptes.';

// ─── Component ───────────────────────────────────────────────────────────────

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserDto | null;
  onSubmit: (data: CreateUserDto | UpdateUserDto) => void;
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
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      role: UserRole.PRATICIENNE,
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
              role: user.role,
            }
          : {
              firstName: '',
              lastName: '',
              email: '',
              role: UserRole.PRATICIENNE,
            },
      );
    }
  }, [open, user, reset]);

  const handleFormSubmit = (data: UserFormData) => {
    onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier le compte' : 'Nouveau compte'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Les changements prennent effet à la prochaine connexion.'
              : 'La personne se connectera avec le compte Google de cette adresse, sans mot de passe.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5" noValidate>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Prénom" required error={errors.firstName?.message}>
              <Input {...register('firstName')} autoComplete="off" />
            </Field>
            <Field label="Nom" required error={errors.lastName?.message}>
              <Input {...register('lastName')} autoComplete="off" />
            </Field>
          </div>

          <Field
            label="Adresse e-mail de son compte Google"
            required
            hint="L’adresse utilisée pour se connecter à Google (Gmail ou autre)."
            error={errors.email?.message}
          >
            <Input type="email" {...register('email')} autoComplete="off" />
          </Field>

          <Field label="Rôle" required hint={ROLE_HINT}>
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
              {isPending && <Loader2 className="animate-spin" />}
              {isEdit ? 'Enregistrer' : 'Créer le compte'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
