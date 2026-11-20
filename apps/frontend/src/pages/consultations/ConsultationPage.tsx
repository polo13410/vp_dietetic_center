import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Check, Flag, Lock, PanelLeftClose, PanelLeftOpen, Ruler, Target, Trash2, Utensils, X } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { GoalForm } from '../../components/patient-file/GoalsPanel';
import { fieldClass, LifeEventForm } from '../../components/patient-file/LifeEventsPanel';
import { MeasurementsForm } from '../../components/patient-file/MeasurementsForm';
import { PatientBrief } from '../../components/patient-file/PatientBrief';
import { TopicNoteForm } from '../../components/patient-file/TopicsPanel';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { LoadingSpinner } from '../../components/ui/loading-screen';
import { toast } from '../../components/ui/toaster';
import api from '../../lib/api';
import {
  type Consultation,
  EVENT_CATEGORIES,
  formatMetric,
  GOAL_STATUSES,
  type GoalStatus,
  METRICS,
  type PatientTopic,
  TOPIC_TYPES,
  TOPICS,
  useConsultation,
  useGoals,
  useInvalidatePatientFile,
  useMeasurements,
  usePatientFileMutation,
} from '../../lib/patient-file';
import { cn, formatDate, formatDateTime } from '../../lib/utils';

/**
 * A session with the patient. The summary of the file stays on the left; on the right, what
 * happens in the session: the report, measurements, topic updates, life events, the review of
 * previous goals and new ones. Finalizing locks it and marks the appointment as done.
 */
export default function ConsultationPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session, isLoading } = useConsultation(id);
  const [briefOpen, setBriefOpen] = useState(true);

  if (isLoading) return <LoadingSpinner />;
  if (!session) return <p className="text-muted-foreground">Séance introuvable</p>;

  const locked = session.status === 'FINALIZED';
  const patientId = session.patientId;

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
            <PatientBrief patientId={patientId} compact />
          </aside>
        )}

        <div className="space-y-4">
          {!briefOpen && (
            <Button size="sm" variant="outline" onClick={() => setBriefOpen(true)}>
              <PanelLeftOpen className="h-4 w-4" /> Afficher le résumé du dossier
            </Button>
          )}
          <Report session={session} locked={locked} />
          <MeasurementsBlock session={session} locked={locked} />
          <GoalsReview session={session} locked={locked} />
          <TopicsBlock session={session} locked={locked} />
          <EventsBlock session={session} locked={locked} />
        </div>
      </div>
    </div>
  );
}

// ─── Header & actions ─────────────────────────────────────────────────────────

function Header({ session }: { session: Consultation }) {
  const navigate = useNavigate();
  const invalidate = useInvalidatePatientFile();
  const [confirm, setConfirm] = useState<'finalize' | 'discard' | null>(null);
  const patient = session.patient!;

  const finalize = useMutation({
    mutationFn: () => api.post(`/consultations/${session.id}/finalize`),
    onSuccess: () => {
      invalidate(session.patientId);
      toast({ title: 'Séance finalisée', description: 'Le rendez-vous est marqué comme terminé.' });
      setConfirm(null);
    },
  });
  const discard = useMutation({
    mutationFn: () => api.delete(`/consultations/${session.id}`),
    onSuccess: () => {
      invalidate(session.patientId);
      toast({ title: 'Brouillon abandonné' });
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
          Séance · {patient.firstName} {patient.lastName}
        </h1>
        <p className="text-xs text-muted-foreground">
          {session.appointment ? formatDateTime(session.appointment.startAt) : formatDate(session.date)}
          {session.appointment?.reason && ` · ${session.appointment.reason}`}
        </p>
      </div>
      <StatusBadge status={session.status} />
      {session.status === 'DRAFT' && (
        <>
          <Button variant="ghost" size="sm" onClick={() => setConfirm('discard')}>
            <Trash2 className="h-4 w-4" /> Abandonner
          </Button>
          <Button size="sm" onClick={() => setConfirm('finalize')}>
            <Lock className="h-4 w-4" /> Finaliser la séance
          </Button>
        </>
      )}

      <ConfirmDialog
        open={confirm === 'finalize'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Finaliser la séance ?"
        description="La séance et ce qui y a été saisi ne pourront plus être modifiés. Le rendez-vous sera marqué comme terminé."
        confirmLabel="Finaliser"
        loading={finalize.isPending}
        onConfirm={() => finalize.mutate()}
      />
      <ConfirmDialog
        open={confirm === 'discard'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Abandonner ce brouillon ?"
        description="La séance et tout ce qui y a été saisi (mesures, notes, événements, objectifs) seront supprimés."
        confirmLabel="Abandonner"
        variant="destructive"
        loading={discard.isPending}
        onConfirm={() => discard.mutate()}
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

/** Summary and advice, saved when leaving each field. */
function Report({ session, locked }: { session: Consultation; locked: boolean }) {
  const invalidate = useInvalidatePatientFile();
  const [summary, setSummary] = useState(session.summary ?? '');
  const [advice, setAdvice] = useState(session.advice ?? '');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  useEffect(() => {
    setSummary(session.summary ?? '');
    setAdvice(session.advice ?? '');
  }, [session.summary, session.advice]);

  const save = useMutation({
    mutationFn: (body: { summary?: string; advice?: string }) => api.patch(`/consultations/${session.id}`, body),
    onSuccess: () => {
      setSavedAt(new Date());
      invalidate(session.patientId);
    },
    onError: () => toast({ title: 'Enregistrement impossible', variant: 'destructive' }),
  });

  if (locked) {
    return (
      <Block icon={<Lock />} title="Compte rendu">
        <ReadOnly label="Déroulé" text={session.summary} />
        <ReadOnly label="Conseils donnés" text={session.advice} />
      </Block>
    );
  }

  return (
    <Block
      icon={<Check />}
      title="Compte rendu"
      aside={
        <span className="text-xs text-muted-foreground">
          {save.isPending ? 'Enregistrement…' : savedAt ? `Enregistré à ${formatDate(savedAt, 'HH:mm')}` : ''}
        </span>
      }
    >
      <label className="block">
        <span className="block text-xs font-medium text-muted-foreground mb-1">Déroulé de la séance</span>
        <textarea
          rows={5}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          onBlur={() => summary !== (session.summary ?? '') && save.mutate({ summary })}
          placeholder="Ce qui s’est dit, ce que le patient rapporte, vos observations…"
          className={`${fieldClass} resize-y`}
        />
      </label>
      <label className="block">
        <span className="block text-xs font-medium text-muted-foreground mb-1">Conseils et plan donnés au patient</span>
        <textarea
          rows={3}
          value={advice}
          onChange={(e) => setAdvice(e.target.value)}
          onBlur={() => advice !== (session.advice ?? '') && save.mutate({ advice })}
          placeholder="Ce que vous lui avez conseillé pour la suite"
          className={`${fieldClass} resize-y`}
        />
      </label>
    </Block>
  );
}

function ReadOnly({ label, text }: { label: string; text: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm whitespace-pre-line">{text || '—'}</p>
    </div>
  );
}

// ─── Measurements ─────────────────────────────────────────────────────────────

function MeasurementsBlock({ session, locked }: { session: Consultation; locked: boolean }) {
  const { data: all = [] } = useMeasurements(session.patientId);
  const remove = usePatientFileMutation(session.patientId, (id: string) => ({
    method: 'delete',
    url: `/patients/${session.patientId}/measurements/${id}`,
  }));
  const taken = session.measurements ?? [];

  return (
    <Block icon={<Ruler />} title="Mesures">
      {taken.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {taken.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-sm">
              {formatMetric(m.type, m.value)}
              <span className="text-xs text-muted-foreground">{METRICS[m.type].label.toLowerCase()}</span>
              {!locked && <RemoveButton onClick={() => remove.mutate(m.id)} />}
            </span>
          ))}
        </div>
      )}
      {locked ? (
        taken.length === 0 && <p className="text-sm text-muted-foreground">Aucune mesure prise.</p>
      ) : (
        <MeasurementsForm
          patientId={session.patientId}
          consultationId={session.id}
          needsHeight={!all.some((m) => m.type === 'HEIGHT')}
        />
      )}
    </Block>
  );
}

// ─── Goals ────────────────────────────────────────────────────────────────────

const REVIEW_CHOICES: GoalStatus[] = ['IN_PROGRESS', 'PARTIAL', 'ACHIEVED', 'ABANDONED'];

/** Review of the goals set in previous sessions, then the new goals of this one. */
function GoalsReview({ session, locked }: { session: Consultation; locked: boolean }) {
  const { data: goals = [] } = useGoals(session.patientId);
  const reviews = new Map((session.goalReviews ?? []).map((r) => [r.goal?.id, r]));
  const toReview = goals.filter(
    (g) => g.consultationId !== session.id && (reviews.has(g.id) || g.status === 'IN_PROGRESS' || g.status === 'PARTIAL'),
  );
  const created = session.goals ?? [];
  const removeGoal = usePatientFileMutation(session.patientId, (id: string) => ({
    method: 'delete',
    url: `/patients/${session.patientId}/goals/${id}`,
  }));

  return (
    <Block icon={<Target />} title="Objectifs">
      {toReview.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Point sur les objectifs précédents</p>
          {toReview.map((goal) => (
            <GoalReviewRow
              key={goal.id}
              session={session}
              goalId={goal.id}
              title={goal.title}
              review={reviews.get(goal.id)}
              locked={locked}
            />
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Nouveaux objectifs</p>
        {created.map((g) => (
          <div key={g.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
            {g.title}
            {!locked && <RemoveButton onClick={() => removeGoal.mutate(g.id)} />}
          </div>
        ))}
        {!locked && <GoalForm patientId={session.patientId} consultationId={session.id} />}
        {locked && created.length === 0 && <p className="text-sm text-muted-foreground">Aucun.</p>}
      </div>
    </Block>
  );
}

function GoalReviewRow({
  session,
  goalId,
  title,
  review,
  locked,
}: {
  session: Consultation;
  goalId: string;
  title: string;
  review?: { status: GoalStatus; comment?: string | null };
  locked: boolean;
}) {
  const [comment, setComment] = useState(review?.comment ?? '');
  const save = usePatientFileMutation(session.patientId, (body: { status: GoalStatus; comment?: string }) => ({
    method: 'put',
    url: `/consultations/${session.id}/goal-reviews/${goalId}`,
    body,
  }));

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {REVIEW_CHOICES.map((status) => (
          <button
            key={status}
            disabled={locked}
            onClick={() => save.mutate({ status, comment: comment || undefined })}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition-colors disabled:cursor-default',
              review?.status === status
                ? GOAL_STATUSES[status].className
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {GOAL_STATUSES[status].label}
          </button>
        ))}
      </div>
      {review && !locked && (
        <input
          placeholder="Commentaire (facultatif)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onBlur={() => comment !== (review.comment ?? '') && save.mutate({ status: review.status, comment })}
          className={fieldClass}
        />
      )}
      {locked && review?.comment && <p className="text-xs text-muted-foreground">« {review.comment} »</p>}
      {!review && locked && <p className="text-xs text-muted-foreground">Pas revu pendant cette séance.</p>}
    </div>
  );
}

// ─── Topics ───────────────────────────────────────────────────────────────────

function TopicsBlock({ session, locked }: { session: Consultation; locked: boolean }) {
  const [topic, setTopic] = useState<PatientTopic | null>(null);
  const notes = session.topicNotes ?? [];
  const remove = usePatientFileMutation(session.patientId, (id: string) => ({
    method: 'delete',
    url: `/patients/${session.patientId}/topic-notes/${id}`,
  }));

  return (
    <Block icon={<Utensils />} title="Thématiques">
      {notes.map((n) => (
        <div key={n.id} className="rounded-lg border border-border px-3 py-2 text-sm">
          <div className="flex items-center justify-between">
            <Badge variant="outline">{TOPICS[n.topic].label}</Badge>
            {!locked && <RemoveButton onClick={() => remove.mutate(n.id)} />}
          </div>
          <p className="mt-1 whitespace-pre-line">{n.content}</p>
        </div>
      ))}
      {!locked && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {TOPIC_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setTopic(topic === t ? null : t)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs transition-colors',
                  topic === t ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {TOPICS[t].label}
              </button>
            ))}
          </div>
          {topic && (
            <TopicNoteForm
              key={topic}
              patientId={session.patientId}
              topic={topic}
              consultationId={session.id}
              onDone={() => setTopic(null)}
            />
          )}
        </>
      )}
      {locked && notes.length === 0 && <p className="text-sm text-muted-foreground">Aucune mise à jour.</p>}
    </Block>
  );
}

// ─── Life events ──────────────────────────────────────────────────────────────

function EventsBlock({ session, locked }: { session: Consultation; locked: boolean }) {
  const events = session.lifeEvents ?? [];
  const remove = usePatientFileMutation(session.patientId, (id: string) => ({
    method: 'delete',
    url: `/patients/${session.patientId}/life-events/${id}`,
  }));
  return (
    <Block icon={<Flag />} title="Événements de vie">
      {events.map((e) => (
        <div key={e.id} className="flex items-start justify-between gap-3 text-sm">
          <span>
            <span className="text-xs text-muted-foreground">{formatDate(e.date)}</span> · {e.title}{' '}
            <span className="text-xs text-muted-foreground">({EVENT_CATEGORIES[e.category]})</span>
          </span>
          {!locked && <RemoveButton onClick={() => remove.mutate(e.id)} />}
        </div>
      ))}
      {!locked && <LifeEventForm patientId={session.patientId} consultationId={session.id} />}
      {locked && events.length === 0 && <p className="text-sm text-muted-foreground">Aucun.</p>}
    </Block>
  );
}
