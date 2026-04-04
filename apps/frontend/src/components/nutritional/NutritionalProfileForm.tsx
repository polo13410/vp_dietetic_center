import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit, Loader2, Save, X } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import api from '../../lib/api';
import { Button } from '../ui/button';
import { toast } from '../ui/toaster';

interface ProfileData {
  objectives?: string | null;
  dietaryHabits?: string | null;
  foodRelationship?: string | null;
  emotionalTriggers?: string | null;
  allergies?: string | null;
  intolerances?: string | null;
  supplements?: string | null;
  medications?: string | null;
  activityLevel?: string | null;
  sleepPattern?: string | null;
  stressLevel?: string | null;
}

interface NutritionalProfileFormProps {
  patientId: string;
  profile: ProfileData;
}

const FIELDS: { key: keyof ProfileData; label: string }[] = [
  { key: 'objectives', label: 'Objectifs' },
  { key: 'dietaryHabits', label: 'Habitudes alimentaires' },
  { key: 'foodRelationship', label: 'Relation a l\'alimentation' },
  { key: 'emotionalTriggers', label: 'Declencheurs emotionnels' },
  { key: 'allergies', label: 'Allergies' },
  { key: 'intolerances', label: 'Intolerances' },
  { key: 'supplements', label: 'Supplements' },
  { key: 'medications', label: 'Medications' },
  { key: 'activityLevel', label: 'Niveau d\'activite' },
  { key: 'sleepPattern', label: 'Habitudes de sommeil' },
  { key: 'stressLevel', label: 'Niveau de stress' },
];

export function NutritionalProfileForm({ patientId, profile }: NutritionalProfileFormProps) {
  const [editing, setEditing] = useState(false);
  const queryClient = useQueryClient();

  const { register, handleSubmit, reset } = useForm<ProfileData>({
    defaultValues: Object.fromEntries(FIELDS.map(({ key }) => [key, profile[key] ?? ''])),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: ProfileData) => api.patch(`/nutritional/profile/${patientId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutritional-profile', patientId] });
      toast({ title: 'Profil mis a jour' });
      setEditing(false);
    },
  });

  const inputClass =
    'w-full px-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 resize-none';

  if (!editing) {
    return (
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium">Profil nutritionnel</h2>
          <Button size="sm" variant="ghost" onClick={() => { reset(); setEditing(true); }}>
            <Edit className="w-3 h-3 mr-1" /> Modifier
          </Button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {FIELDS.map(({ key, label }) => {
            const value = profile[key];
            if (!value) return null;
            return (
              <div key={key}>
                <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
                <p className="text-sm text-foreground whitespace-pre-line">{value}</p>
              </div>
            );
          })}
        </div>
        {FIELDS.every(({ key }) => !profile[key]) && (
          <p className="text-sm text-muted-foreground text-center py-4">Profil non renseigne</p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit((d) => mutate(d))}
      className="bg-card rounded-xl border border-border p-5 space-y-3"
    >
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium">Modifier le profil</h2>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            <X className="w-3 h-3" /> Annuler
          </Button>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Save className="w-3 h-3" /> Enregistrer</>}
          </Button>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {FIELDS.map(({ key, label }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
            <textarea {...register(key)} rows={2} className={inputClass} />
          </div>
        ))}
      </div>
    </form>
  );
}
