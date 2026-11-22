import { ClipboardPlus, FolderOpen, Loader2 } from 'lucide-react';
import { type InputHTMLAttributes, type ReactNode, useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router';

import {
  type ContactDraft,
  type IdentityDraft,
  joinFrench,
  type MedicalDraft,
  parseHeight,
  type SituationDraft,
} from '../../lib/new-patient';
import { FILE_FIELD_TYPES, FILE_FIELDS } from '../../lib/patient-file';
import { ageInYears, formatLongDate } from '../../lib/utils';
import { Field } from '../shared/Field';
import { PearMascot } from '../shared/PearMascot';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

type Errors<T> = Partial<Record<keyof T, string>>;

interface StepProps<T> {
  value: T;
  onChange: (value: T) => void;
  errors: Errors<T>;
}

function TextField({
  label,
  hint,
  error,
  value,
  onChange,
  className,
  ...input
}: {
  label: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      <Input value={value} onChange={(e) => onChange(e.target.value)} enterKeyHint="next" {...input} />
    </Field>
  );
}

/** A text area that grows with what is typed, so nothing scrolls inside it. */
function GrowingTextarea({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <Field label={label} className={className}>
      <Textarea
        ref={ref}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-20 resize-none overflow-hidden"
      />
    </Field>
  );
}

// ─── Step 2 ───────────────────────────────────────────────────────────────────

export function ContactStep({ value, onChange, errors }: StepProps<ContactDraft>) {
  const set = (key: keyof ContactDraft) => (v: string) => onChange({ ...value, [key]: v });
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <TextField
        label="Téléphone"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        value={value.phone}
        onChange={set('phone')}
        autoFocus
      />
      <TextField
        label="E-mail"
        type="email"
        inputMode="email"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={value.email}
        onChange={set('email')}
        error={errors.email}
      />
      <TextField
        label="Adresse"
        hint="Utile sur les factures"
        autoComplete="off"
        value={value.address}
        onChange={set('address')}
        className="sm:col-span-2"
      />
      <TextField
        label="Code postal"
        inputMode="numeric"
        autoComplete="off"
        value={value.zipCode}
        onChange={set('zipCode')}
      />
      <TextField label="Ville" autoComplete="off" value={value.city} onChange={set('city')} />
    </div>
  );
}

// ─── Step 3 ───────────────────────────────────────────────────────────────────

export function SituationStep({ value, onChange }: StepProps<SituationDraft>) {
  const set = (key: keyof SituationDraft) => (v: string) => onChange({ ...value, [key]: v });
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <TextField
        label="Situation familiale"
        hint="Par exemple : mariée, deux enfants"
        value={value.familySituation}
        onChange={set('familySituation')}
        className="sm:col-span-2"
        autoFocus
      />
      <TextField label="Profession" value={value.profession} onChange={set('profession')} />
      <TextField label="Médecin traitant" value={value.gpName} onChange={set('gpName')} />
      <TextField
        label="Adressé par"
        hint="Médecin, bouche-à-oreille, ancien patient…"
        value={value.referralSource}
        onChange={set('referralSource')}
        className="sm:col-span-2"
      />
    </div>
  );
}

// ─── Step 4 ───────────────────────────────────────────────────────────────────

export function MedicalStep({ value, onChange, errors }: StepProps<MedicalDraft>) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <GrowingTextarea
        label="Motif de consultation"
        value={value.consultationReason}
        onChange={(consultationReason) => onChange({ ...value, consultationReason })}
        className="sm:col-span-2"
      />
      <Field label="Taille (cm)" hint="Pour calculer l’IMC et le MB" error={errors.height} className="sm:col-span-2">
        <Input
          inputMode="decimal"
          value={value.height}
          onChange={(e) => onChange({ ...value, height: e.target.value })}
          enterKeyHint="next"
          className="max-w-[8rem]"
        />
      </Field>
      {FILE_FIELD_TYPES.map((field) => (
        <GrowingTextarea
          key={field}
          label={FILE_FIELDS[field]}
          value={value.file[field]}
          onChange={(text) => onChange({ ...value, file: { ...value.file, [field]: text } })}
        />
      ))}
    </div>
  );
}

// ─── Step 5 ───────────────────────────────────────────────────────────────────

interface Saved {
  identity: IdentityDraft;
  contact: ContactDraft;
  situation: SituationDraft;
  medical: MedicalDraft;
}

function identityLine(identity: IdentityDraft): string[] {
  const sex = identity.sex === 'F' ? 'Femme' : identity.sex === 'M' ? 'Homme' : null;
  let age: string | null = null;
  if (identity.ageOnly && identity.age) age = `${identity.age} ans, âge déclaré`;
  else if (!identity.ageOnly && identity.dateOfBirth) {
    age = `${ageInYears(identity.dateOfBirth)} ans (${formatLongDate(identity.dateOfBirth)})`;
  }
  return [sex, age].filter((x): x is string => !!x);
}

function SummaryGroup({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-medium">{title}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onEdit} aria-label={`Modifier : ${title}`}>
          Modifier
        </Button>
      </div>
      {children}
    </div>
  );
}

function Lines({ items }: { items: [string, string][] }) {
  const filled = items.filter(([, v]) => v.trim());
  if (filled.length === 0) return <p className="text-base text-muted-foreground">Rien pour l’instant.</p>;
  return (
    <dl className="space-y-1.5">
      {filled.map(([label, v]) => (
        <div key={label} className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground">{label} :</dt>
          <dd className="whitespace-pre-line">{v.trim()}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SummaryStep({
  patientId,
  saved,
  onEdit,
  onStartSession,
  starting,
}: {
  patientId: string;
  saved: Saved;
  onEdit: (step: number) => void;
  onStartSession: () => void;
  starting: boolean;
}) {
  const { identity, contact, situation, medical } = saved;
  const name = `${identity.firstName} ${identity.lastName}`.trim();
  const height = parseHeight(medical.height);
  const hasAge = identity.ageOnly ? !!identity.age : !!identity.dateOfBirth;
  const lacking = [!identity.sex && 'le sexe', !hasAge && 'l’âge', !height && 'la taille'].filter(
    (x): x is string => !!x,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
        <PearMascot className="h-24 shrink-0" />
        <div className="space-y-1">
          <p className="text-xl font-semibold">Le dossier de {name} est prêt.</p>
          <p className="text-base text-muted-foreground">
            {lacking.length > 0
              ? `Il manque ${joinFrench(lacking)} pour calculer le MB. Vous pourrez l’ajouter dans le dossier. Le poids se prend au bilan.`
              : 'Tout est là pour calculer l’IMC et le MB. Le poids se prend au bilan.'}
          </p>
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
            <Button variant="outline" size="lg" asChild>
              <Link to={`/patients/${patientId}`}>
                <FolderOpen />
                Ouvrir le dossier
              </Link>
            </Button>
            <Button size="lg" onClick={onStartSession} disabled={starting}>
              {starting ? <Loader2 className="animate-spin" /> : <ClipboardPlus />}
              Démarrer le bilan
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryGroup title="Qui est‑ce ?" onEdit={() => onEdit(0)}>
          <p className="text-base font-medium">{name}</p>
          {identityLine(identity).map((line) => (
            <p key={line} className="text-base">
              {line}
            </p>
          ))}
        </SummaryGroup>
        <SummaryGroup title="Le joindre" onEdit={() => onEdit(1)}>
          <Lines
            items={[
              ['Téléphone', contact.phone],
              ['E-mail', contact.email],
              ['Adresse', [contact.address, `${contact.zipCode} ${contact.city}`.trim()].filter(Boolean).join(', ')],
            ]}
          />
        </SummaryGroup>
        <SummaryGroup title="Sa situation" onEdit={() => onEdit(2)}>
          <Lines
            items={[
              ['Situation familiale', situation.familySituation],
              ['Profession', situation.profession],
              ['Médecin traitant', situation.gpName],
              ['Adressé par', situation.referralSource],
            ]}
          />
        </SummaryGroup>
        <SummaryGroup title="Dossier médical" onEdit={() => onEdit(3)}>
          <Lines
            items={[
              ['Motif', medical.consultationReason],
              ['Taille', height ? `${String(height).replace('.', ',')} cm` : ''],
              ...FILE_FIELD_TYPES.map((f) => [FILE_FIELDS[f], medical.file[f]] as [string, string]),
            ]}
          />
        </SummaryGroup>
      </div>

    </div>
  );
}
