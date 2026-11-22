import { ArrowLeft, CircleCheck, HeartPulse, Loader2, type LucideIcon, Phone, UserRound, Users } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { useStartSession } from '../../components/patient-file/useStartSession';
import { IdentityFields } from '../../components/patients/IdentityFields';
import { ContactStep, MedicalStep, SituationStep, SummaryStep } from '../../components/patients/NewPatientSteps';
import { EmptyState } from '../../components/shared/EmptyState';
import { PageHeader } from '../../components/shared/PageHeader';
import { Section } from '../../components/shared/Section';
import { Stepper } from '../../components/shared/Stepper';
import { Button } from '../../components/ui/button';
import { toast } from '../../components/ui/toaster';
import { focusNextOnEnter, useKeepFieldVisible } from '../../hooks/useKeepFieldVisible';
import api from '../../lib/api';
import {
  changedFields,
  changedFileFields,
  contactErrors,
  type ContactDraft,
  contactFromPatient,
  EMPTY_IDENTITY,
  type IdentityDraft,
  identityErrors,
  identityFromPatient,
  identityPayload,
  type MedicalDraft,
  medicalErrors,
  medicalFromServer,
  parseHeight,
  type SituationDraft,
  situationFromPatient,
} from '../../lib/new-patient';
import {
  type Measurement,
  type Patient,
  useFileSections,
  useInvalidatePatientFile,
  useMeasurements,
  usePatient,
} from '../../lib/patient-file';
import { todayISO } from '../../lib/utils';

interface Drafts {
  identity: IdentityDraft;
  contact: ContactDraft;
  situation: SituationDraft;
  medical: MedicalDraft;
}

const EMPTY: Drafts = {
  identity: EMPTY_IDENTITY,
  contact: contactFromPatient(),
  situation: situationFromPatient(),
  medical: medicalFromServer(undefined),
};

const STEPS: { label: string; description: string; icon: LucideIcon }[] = [
  { label: 'Qui est-ce ?', description: 'Le prénom et le nom suffisent pour créer le dossier.', icon: UserRound },
  { label: 'Le joindre', description: 'Pour les rendez-vous et les factures.', icon: Phone },
  { label: 'Sa situation', description: 'Ce qui aide à comprendre son quotidien.', icon: Users },
  {
    label: 'Dossier médical',
    description: 'Remplissez ce que vous savez déjà : le reste se complète au bilan.',
    icon: HeartPulse,
  },
  { label: 'C’est prêt', description: 'Voici ce qui est enregistré.', icon: CircleCheck },
];
const SUMMARY = STEPS.length - 1;
const KEYS = ['identity', 'contact', 'situation', 'medical'] as const;

const errorsOf = (step: number, drafts: Drafts): Record<string, string | undefined> => {
  if (step === 0) return identityErrors(drafts.identity);
  if (step === 1) return contactErrors(drafts.contact);
  if (step === 3) return medicalErrors(drafts.medical);
  return {};
};

const apiMessage = (error: unknown): string | undefined => {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  return Array.isArray(message) ? message.join(' ') : message;
};

/**
 * « Nouveau patient »: a wizard of five short steps (docs/REFONTE.md lot 6). The patient is created
 * at the end of the first one and each next step is saved when moving on, so stopping half-way
 * loses nothing. The patient and the step are kept in the address, so a reload resumes there.
 */
export default function PatientNewPage() {
  const [params, setParams] = useSearchParams();
  const patientId = params.get('patient') ?? undefined;
  const asked = Number.parseInt(params.get('step') ?? '', 10);
  const step = !patientId ? 0 : Number.isNaN(asked) ? 1 : Math.min(Math.max(asked, 0), SUMMARY);

  const patient = usePatient(patientId);
  const sections = useFileSections(patientId);
  const measurements = useMeasurements(patientId);
  const invalidate = useInvalidatePatientFile();
  const startSession = useStartSession(patientId ?? '');
  const { ref, keyboardInset } = useKeepFieldVisible<HTMLDivElement>();

  // What was last saved, and what is being typed (kept when going back and forth)
  const [saved, setSaved] = useState<Drafts | null>(patientId ? null : EMPTY);
  const [drafts, setDrafts] = useState<Drafts | null>(saved);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  // Today's height measurement, corrected rather than added again when the step is saved twice
  const heightToday = useRef<Measurement | null>(null);
  // The patient the drafts belong to: another address (« Nouveau patient » again) starts over
  const owner = useRef(patientId);

  useEffect(() => {
    if (owner.current === patientId) return;
    owner.current = patientId;
    heightToday.current = null;
    setSaved(patientId ? null : EMPTY);
    setDrafts(patientId ? null : EMPTY);
  }, [patientId]);

  // Resuming a patient created earlier (reload, or back from another page)
  useEffect(() => {
    if (saved || !patient.data || !sections.data || !measurements.data) return;
    const p: Patient = patient.data;
    const fromServer: Drafts = {
      identity: identityFromPatient(p),
      contact: contactFromPatient(p),
      situation: situationFromPatient(p),
      medical: medicalFromServer(p, sections.data, measurements.data),
    };
    const height = measurements.data.filter((m) => m.type === 'HEIGHT').at(-1);
    heightToday.current = height && height.measuredAt.slice(0, 10) === todayISO() ? height : null;
    setSaved(fromServer);
    setDrafts(fromServer);
  }, [saved, patient.data, sections.data, measurements.data]);

  const goTo = (next: number, id = patientId) => {
    setShowErrors(false);
    owner.current = id;
    if (id) setParams({ patient: id, step: String(next) }, { replace: true });
    ref.current?.scrollIntoView?.({ block: 'start' });
  };

  /** Saves the current step; returns the patient's id, or undefined when nothing could be saved. */
  const save = async (current: Drafts, last: Drafts): Promise<string | undefined> => {
    const key = KEYS[step];
    if (step === 0) {
      const body = identityPayload(current.identity);
      if (!patientId) return (await api.post<Patient>('/patients', body)).data.id;
      if (JSON.stringify(body) !== JSON.stringify(identityPayload(last.identity))) {
        await api.patch(`/patients/${patientId}`, body);
      }
      return patientId;
    }
    if (!patientId) return undefined;
    if (key === 'contact' || key === 'situation') {
      const changes = changedFields<Record<string, string>>(current[key], last[key]);
      if (Object.keys(changes).length > 0) await api.patch(`/patients/${patientId}`, changes);
    }
    if (key === 'medical') await saveMedical(patientId, current.medical, last.medical);
    return patientId;
  };

  const saveMedical = async (id: string, current: MedicalDraft, last: MedicalDraft) => {
    if (current.consultationReason.trim() !== last.consultationReason.trim()) {
      await api.patch(`/patients/${id}`, { consultationReason: current.consultationReason.trim() || null });
    }
    const cm = parseHeight(current.height);
    if (current.height.trim() !== last.height.trim()) {
      const today = heightToday.current;
      if (cm && today) {
        await api.patch(`/patients/${id}/measurements/${today.id}`, { value: cm });
      } else if (cm) {
        const { data } = await api.post<Measurement>(`/patients/${id}/measurements`, { type: 'HEIGHT', value: cm });
        heightToday.current = data;
      } else if (today) {
        await api.delete(`/patients/${id}/measurements/${today.id}`);
        heightToday.current = null;
      }
    }
    for (const field of changedFileFields(current, last)) {
      await api.put(`/patients/${id}/file/${field}`, { content: current.file[field].trim() });
    }
  };

  /**
   * Leaves the current step for `target`. Moving on saves (and stops on a mistake to correct);
   * going back saves what is valid; skipping forgets what was typed in this step.
   */
  const leave = async (target: number, mode: 'next' | 'back' | 'skip') => {
    if (!drafts || !saved || busy) return;
    const key = KEYS[step];
    if (mode === 'skip') {
      setDrafts({ ...drafts, [key]: saved[key] });
      return goTo(target);
    }
    const hasErrors = Object.values(errorsOf(step, drafts)).some(Boolean);
    if (hasErrors) {
      if (mode === 'next') return setShowErrors(true);
      return goTo(target);
    }
    setBusy(true);
    try {
      const id = await save(drafts, saved);
      setSaved({ ...saved, [key]: drafts[key] });
      if (id) invalidate(id);
      goTo(target, id);
    } catch (error) {
      toast({
        title: step === 0 && !patientId ? 'Impossible de créer le dossier' : 'Impossible d’enregistrer cette étape',
        description: apiMessage(error) ?? 'Vérifiez la connexion et réessayez.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void leave(step + 1, 'next');
  };

  const meta = STEPS[step];
  const name = saved && patientId ? `${saved.identity.firstName} ${saved.identity.lastName}` : null;
  const errors = showErrors && drafts ? errorsOf(step, drafts) : {};
  const failed = patientId && (patient.isError || sections.isError || measurements.isError);

  return (
    <div ref={ref} style={keyboardInset ? { paddingBottom: keyboardInset } : undefined}>
      <PageHeader
        title="Nouveau patient"
        subtitle={
          name
            ? `Le dossier de ${name} est créé. La suite est facultative : chaque étape peut être passée.`
            : 'En cinq petites étapes. Seuls le prénom et le nom sont obligatoires.'
        }
        back={{ to: '/patients', label: 'Patients' }}
        area="patients"
      />

      {failed ? (
        <EmptyState
          illustration="pear-calm"
          title="Ce dossier est introuvable."
          description="Il a peut-être été supprimé. Vous pouvez recommencer depuis la liste des patients."
          action={
            <Button asChild>
              <Link to="/patients">Voir les patients</Link>
            </Button>
          }
        />
      ) : !drafts || !saved ? (
        <div className="flex justify-center py-16" aria-label="Chargement">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          <Stepper
            steps={STEPS.map(({ label }) => ({ label }))}
            current={step}
            onStepClick={patientId ? (index) => void leave(index, 'back') : undefined}
          />
          <p className="sr-only" aria-live="polite">
            {`Étape ${step + 1} sur ${STEPS.length} : ${meta.label}`}
          </p>

          <Section icon={meta.icon} area="patients" title={meta.label} description={meta.description}>
            {step === SUMMARY && patientId ? (
              <SummaryStep
                patientId={patientId}
                saved={saved}
                onEdit={goTo}
                onStartSession={() => startSession.mutate({})}
                starting={startSession.isPending}
              />
            ) : (
              <form onSubmit={submit} onKeyDown={focusNextOnEnter} noValidate className="space-y-8">
                {step === 0 && (
                  <IdentityFields
                    value={drafts.identity}
                    onChange={(identity) => setDrafts({ ...drafts, identity })}
                    errors={errors}
                    autoFocus={!patientId}
                  />
                )}
                {step === 1 && (
                  <ContactStep
                    value={drafts.contact}
                    onChange={(contact) => setDrafts({ ...drafts, contact })}
                    errors={errors}
                  />
                )}
                {step === 2 && (
                  <SituationStep
                    value={drafts.situation}
                    onChange={(situation) => setDrafts({ ...drafts, situation })}
                    errors={errors}
                  />
                )}
                {step === 3 && (
                  <MedicalStep
                    value={drafts.medical}
                    onChange={(medical) => setDrafts({ ...drafts, medical })}
                    errors={errors}
                  />
                )}

                {/* In the page's flow, not fixed: the keyboard never covers a field (DESIGN.md § 5) */}
                <div className="flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:items-center">
                  {step === 0 && !patientId ? (
                    <Button type="button" variant="outline" asChild>
                      <Link to="/patients">Annuler</Link>
                    </Button>
                  ) : step > 0 ? (
                    <Button type="button" variant="outline" onClick={() => void leave(step - 1, 'back')} disabled={busy}>
                      <ArrowLeft />
                      Retour
                    </Button>
                  ) : null}
                  <div className="flex flex-col-reverse gap-3 sm:ml-auto sm:flex-row">
                    {step > 0 && (
                      <Button type="button" variant="ghost" onClick={() => void leave(step + 1, 'skip')} disabled={busy}>
                        Passer cette étape
                      </Button>
                    )}
                    <Button type="submit" disabled={busy}>
                      {busy && <Loader2 className="animate-spin" />}
                      {step === 0 && !patientId ? 'Créer le dossier' : 'Enregistrer et continuer'}
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
