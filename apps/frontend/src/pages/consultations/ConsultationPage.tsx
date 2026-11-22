import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Check, Flag, Heart, PanelLeftClose, PanelLeftOpen, Ruler, Trash2, X } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { FileSectionEditor } from '../../components/patient-file/FilePanel';
import { fieldClass, LifeEventForm } from '../../components/patient-file/LifeEventsPanel';
import { MeasurementsForm } from '../../components/patient-file/MeasurementsForm';
import { PatientRecap } from '../../components/patient-file/PatientRecap';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { toast } from '../../components/ui/toaster';
import api from '../../lib/api';
import {
  type Consultation,
  EVENT_CATEGORIES,
  FILE_FIELDS,
  type FileField,
  formatMetric,
  METRICS,
  PAYMENT_METHODS,
  type PaymentMethod,
  sessionName,
  useConsultation,
  useFileSections,
  useInvalidatePatientFile,
  useMeasurements,
  usePatientFileMutation,
} from '../../lib/patient-file';
import { cn, formatDate, formatDateTime } from '../../lib/utils';

/**
 * A session with the patient: one row of her follow-up sheet. The summary of the file stays on
 * the left; on the right, the session itself. Nothing is locked: a past session is corrected
 * like today's. (Temporary screen: lot 7 rebuilds it.)
 */
export default function ConsultationPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session, isLoading } = useConsultation(id);
  const [briefOpen, setBriefOpen] = useState(true);

  if (isLoading) return <LoadingSpinner />;
  if (!session) return <p className="text-muted-foreground">Séance introuvable</p>;

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <Header session={session} />

      <div className={cn('grid gap-5', briefOpen && 'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]')}>
        {briefOpen && (
          <aside className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Résumé du dossier</h2>
              <Button size="sm" variant="ghost" onClick={() => setBriefOpen(false)} title="Masquer le résumé">
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
            <PatientRecap patientId={session.patientId} size="panel" />
          </aside>
        )}

        <div className="space-y-4">
          {!briefOpen && (
            <Button size="sm" variant="outline" onClick={() => setBriefOpen(true)}>
              <PanelLeftOpen className="h-4 w-4" /> Afficher le résumé du dossier
            </Button>
          )}
          <MeasurementsBlock session={session} />
          <Report session={session} />
          <AversionsAndTastes session={session} />
          <EventsBlock session={session} />
        </div>
      </div>
    </div>
  );
}

// ─── Header & actions ─────────────────────────────────────────────────────────

function Header({ session }: { session: Consultation }) {
  const navigate = useNavigate();
  const invalidate = useInvalidatePatientFile();
  const [confirm, setConfirm] = useState(false);
  const patient = session.patient!;

  const remove = useMutation({
    mutationFn: () => api.delete(`/consultations/${session.id}`),
    onSuccess: () => {
      invalidate(session.patientId);
      toast({ title: 'Séance supprimée' });
      navigate(`/patients/${session.patientId}`);
    },
  });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link to={`/patients/${patient.id}`} className="text-muted-foreground hover:text-foreground" title="Dossier du patient">
        <ArrowLeft className="w-4 h-4" />
      </Link>
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-semibold truncate">
          {sessionName(session.sequence)} · {patient.firstName} {patient.lastName}
        </h1>
        <p className="text-xs text-muted-foreground">
          {session.appointment ? formatDateTime(session.appointment.startAt) : formatDate(session.date)}
          {session.formulaLabel && ` · ${session.formulaLabel}`}
          {session.priceCents !== null && ` · ${(session.priceCents / 100).toLocaleString('fr-FR')} €`}
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>
        <Trash2 className="h-4 w-4" /> Supprimer la séance
      </Button>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Supprimer cette séance ?"
        description="La séance et ses mesures seront supprimées. Ce qui a été écrit dans le dossier médical est conservé."
        confirmLabel="Supprimer"
        variant="destructive"
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}

function Block({ icon, title, children, aside }: { icon: ReactNode; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-muted-foreground hover:text-destructive" title="Retirer">
      <X className="h-3.5 w-3.5" />
    </button>
  );
}

// ─── Report ───────────────────────────────────────────────────────────────────

type Texts = { habits: string; sessionWork: string; advice: string };

/** Her columns of the follow-up sheet, saved when leaving each field. */
function Report({ session }: { session: Consultation }) {
  const invalidate = useInvalidatePatientFile();
  const saved: Texts = {
    habits: session.habits ?? '',
    sessionWork: session.sessionWork ?? '',
    advice: session.advice ?? '',
  };
  const [texts, setTexts] = useState<Texts>(saved);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  useEffect(() => {
    setTexts({ habits: session.habits ?? '', sessionWork: session.sessionWork ?? '', advice: session.advice ?? '' });
  }, [session.habits, session.sessionWork, session.advice]);

  const save = useMutation({
    mutationFn: (body: Partial<Texts> & { paymentMethod?: PaymentMethod }) =>
      api.patch(`/consultations/${session.id}`, body),
    onSuccess: () => {
      setSavedAt(new Date());
      invalidate(session.patientId);
    },
    onError: () => toast({ title: 'Enregistrement impossible', variant: 'destructive' }),
  });

  const field = (key: keyof Texts, label: string, rows: number, placeholder: string) => (
    <label className="block">
      <span className="block text-xs font-medium text-muted-foreground mb-1">{label}</span>
      <textarea
        rows={rows}
        value={texts[key]}
        onChange={(e) => setTexts((t) => ({ ...t, [key]: e.target.value }))}
        onBlur={() => texts[key] !== saved[key] && save.mutate({ [key]: texts[key] })}
        placeholder={placeholder}
        className={`${fieldClass} resize-y`}
      />
    </label>
  );

  return (
    <Block
      icon={<Check />}
      title="Séance"
      aside={
        <span className="text-xs text-muted-foreground">
          {save.isPending ? 'Enregistrement…' : savedAt ? `Enregistré à ${formatDate(savedAt, 'HH:mm')}` : ''}
        </span>
      }
    >
      <label className="block max-w-[14rem]">
        <span className="block text-xs font-medium text-muted-foreground mb-1">Moyen de paiement</span>
        <select
          value={session.paymentMethod}
          onChange={(e) => save.mutate({ paymentMethod: e.target.value as PaymentMethod })}
          className={fieldClass}
        >
          {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHODS[m]}
            </option>
          ))}
        </select>
      </label>
      {session.previousAdvice && (
        <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <p className="text-xs font-medium text-muted-foreground mb-0.5">Conseils de la séance précédente</p>
          <p className="whitespace-pre-line">{session.previousAdvice}</p>
        </div>
      )}
      {field('habits', 'Habitudes et évolution', 4, 'Ce que le patient rapporte depuis la dernière fois')}
      {field('sessionWork', 'Travail en consultation', 4, 'Ce qui a été travaillé pendant la séance')}
      {field('advice', 'Conseils diététiques', 3, 'Ce que vous lui avez conseillé pour la suite')}
    </Block>
  );
}

// ─── Measurements ─────────────────────────────────────────────────────────────

const MISSING_LABELS = { weight: 'le poids', height: 'la taille', sex: 'le sexe', age: "l'âge" } as const;

function MeasurementsBlock({ session }: { session: Consultation }) {
  const { data: all = [] } = useMeasurements(session.patientId);
  const remove = usePatientFileMutation(session.patientId, (id: string) => ({
    method: 'delete',
    url: `/patients/${session.patientId}/measurements/${id}`,
  }));
  const taken = session.measurements ?? [];
  const { bmi, bmr, missing } = session.figures;
  const { sincePrevious, sinceFirst } = session.weightChange;
  const kg = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString('fr-FR')} kg`;

  return (
    <Block icon={<Ruler />} title="Poids et mesures">
      {taken.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {taken.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-sm">
              {formatMetric(m.type, m.value)}
              <span className="text-xs text-muted-foreground">{METRICS[m.type].label.toLowerCase()}</span>
              <RemoveButton onClick={() => remove.mutate(m.id)} />
            </span>
          ))}
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        {bmi && <>IMC {bmi.value.toLocaleString('fr-FR')}</>}
        {bmr && (
          <>
            {' '}
            · MB {bmr.mj.toLocaleString('fr-FR')} MJ · {bmr.kcal.toLocaleString('fr-FR')} kcal
          </>
        )}
        {sincePrevious !== null && <> · {kg(sincePrevious)} depuis la dernière séance</>}
        {sinceFirst !== null && <> · {kg(sinceFirst)} depuis le bilan</>}
        {missing.length > 0 && (
          <> {bmi || bmr ? '· ' : ''}Pour calculer l’IMC et le MB, ajoutez {missing.map((m) => MISSING_LABELS[m]).join(', ')}.</>
        )}
      </p>
      <MeasurementsForm
        patientId={session.patientId}
        consultationId={session.id}
        needsHeight={!all.some((m) => m.type === 'HEIGHT')}
      />
    </Block>
  );
}

// ─── Aversions and tastes ─────────────────────────────────────────────────────

const SESSION_FIELDS: FileField[] = ['AVERSIONS', 'TASTES'];

/** The patient's aversions and tastes (sections of the file), completed during the session. */
function AversionsAndTastes({ session }: { session: Consultation }) {
  const { data: sections = [] } = useFileSections(session.patientId);
  return (
    <Block icon={<Heart />} title="Aversions · Goûts">
      {SESSION_FIELDS.map((field) => (
        <div key={field}>
          <p className="text-xs font-medium text-muted-foreground mb-1">{FILE_FIELDS[field]}</p>
          <FileSectionEditor
            patientId={session.patientId}
            field={field}
            current={sections.find((s) => s.field === field)?.current?.content ?? ''}
            consultationId={session.id}
          />
        </div>
      ))}
    </Block>
  );
}

// ─── Life events ──────────────────────────────────────────────────────────────

function EventsBlock({ session }: { session: Consultation }) {
  const events = session.lifeEvents ?? [];
  const remove = usePatientFileMutation(session.patientId, (id: string) => ({
    method: 'delete',
    url: `/patients/${session.patientId}/life-events/${id}`,
  }));
  return (
    <Block icon={<Flag />} title="Faits marquants">
      {events.map((e) => (
        <div key={e.id} className="flex items-start justify-between gap-3 text-sm">
          <span>
            <span className="text-xs text-muted-foreground">{formatDate(e.date)}</span> · {e.title}
            {e.category && <span className="text-xs text-muted-foreground"> ({EVENT_CATEGORIES[e.category]})</span>}
          </span>
          <RemoveButton onClick={() => remove.mutate(e.id)} />
        </div>
      ))}
      <LifeEventForm patientId={session.patientId} consultationId={session.id} />
    </Block>
  );
}
