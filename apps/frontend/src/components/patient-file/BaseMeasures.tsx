import { Ruler } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';

import { useAutosave } from '../../hooks/useAutosave';
import api from '../../lib/api';
import {
  bmrConstant,
  FILE_ANCHORS,
  formatMetric,
  type Measurement,
  missingMessage,
  type Patient,
  patientTabLink,
  useInvalidatePatientFile,
  useMeasurements,
  usePatient,
  usePatientBrief,
} from '../../lib/patient-file';
import { ageInYears, formatLongDate, formatNumber, todayISO } from '../../lib/utils';
import { DatePicker } from '../shared/DatePicker';
import { Field } from '../shared/Field';
import { SaveIndicator } from '../shared/SaveIndicator';
import { Section } from '../shared/Section';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

import { AdultFormulaNote, BmiBadge } from './BmiBadge';

/**
 * The top of her « Dossier médical » sheet, in her order: age, sex, weight, height, then the
 * constant, BMI and BMR computed by the API. Age, sex and height are edited here.
 */
export function BaseMeasures({ patientId }: { patientId: string }) {
  const { data: patient } = usePatient(patientId);
  const { data: brief } = usePatientBrief(patientId);
  const { data: measurements = [], isSuccess } = useMeasurements(patientId);
  // Wait for everything: the fields start from these values
  if (!patient || !brief || !isSuccess) return null;

  const weight = brief.metrics.find((m) => m.type === 'WEIGHT')?.latest;
  const heights = measurements.filter((m) => m.type === 'HEIGHT');
  const height = heights.at(-1);
  const constant = bmrConstant(patient.sex);
  const missing = [missingMessage(brief.missing, 'bmi'), missingMessage(brief.missing, 'bmr')].filter(
    (m, i, all): m is string => !!m && all.indexOf(m) === i,
  );

  return (
    <Section
      size="compact"
      icon={Ruler}
      area="patients"
      title="Mesures"
      id={FILE_ANCHORS.baseMeasures}
      action={
        <Button size="sm" variant="ghost" asChild>
          <Link to={patientTabLink(patientId, 'mesures', FILE_ANCHORS.timeline)}>Voir toutes les mesures</Link>
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AgeField patient={patient} />
          <SexField patient={patient} />
          <Field label="Poids" hint="Pesé à chaque séance">
            <p className="flex min-h-11 items-center text-lg font-semibold tabular-nums" aria-live="polite">
              {weight ? (
                <>
                  {formatMetric('WEIGHT', weight.value)}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    le {formatLongDate(weight.measuredAt, true)}
                  </span>
                </>
              ) : (
                <span className="text-base font-normal text-muted-foreground">Pas encore pesé</span>
              )}
            </p>
          </Field>
          <HeightField patientId={patientId} height={height} />
        </div>

        <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Figure label="Constante" value={constant !== null ? formatNumber(constant) : null} />
          <Figure label="IMC" value={brief.bmi.current ? formatNumber(brief.bmi.current.value) : null}>
            <BmiBadge bmi={brief.bmi.current} short />
          </Figure>
          <Figure label="MB (MJ/jour)" value={brief.bmr ? formatNumber(brief.bmr.mj) : null}>
            <AdultFormulaNote bmr={brief.bmr} />
          </Figure>
          <Figure label="MB (kcal/jour)" value={brief.bmr ? formatNumber(brief.bmr.kcal, 1) : null}>
            <AdultFormulaNote bmr={brief.bmr} />
          </Figure>
        </dl>
        {missing.length > 0 && <p className="text-sm text-muted-foreground">{missing.join('. ')}.</p>}
      </div>
    </Section>
  );
}

function Figure({ label, value, children }: { label: string; value: string | null; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="flex flex-wrap items-center gap-2 text-xl font-semibold tabular-nums">
        {value ?? '—'}
        {children}
      </dd>
    </div>
  );
}

function usePatientPatch(patientId: string) {
  const invalidate = useInvalidatePatientFile();
  return useAutosave(async (body: Record<string, unknown>) => {
    await api.patch(`/patients/${patientId}`, body);
    invalidate(patientId);
  }, 600);
}

/** Birth date, or the age alone when she does not know it (§ 3.1: an estimated birth year is kept). */
function AgeField({ patient }: { patient: Patient }) {
  const [ageOnly, setAgeOnly] = useState(patient.birthDateEstimated);
  const [date, setDate] = useState(!patient.birthDateEstimated ? (patient.dateOfBirth?.slice(0, 10) ?? '') : '');
  const knownAge = ageInYears(patient.dateOfBirth);
  const [age, setAge] = useState(patient.birthDateEstimated && knownAge !== null ? String(knownAge) : '');
  const [error, setError] = useState<string>();
  const save = usePatientPatch(patient.id);

  const switchButton = (
    <Button
      size="sm"
      variant="link"
      className="h-auto min-h-11 px-0"
      onClick={() => {
        setAgeOnly(!ageOnly);
        setError(undefined);
      }}
    >
      {ageOnly ? 'Saisir la date de naissance' : 'Je ne connais que son âge'}
    </Button>
  );

  if (ageOnly) {
    return (
      <div>
        <Field
          label="Âge"
          hint={patient.birthDateEstimated ? 'Âge déclaré' : 'Si la date de naissance est inconnue'}
          error={error}
        >
          <Input
            inputMode="numeric"
            value={age}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '');
              setAge(value);
              const n = Number(value);
              if (!value) return setError(undefined);
              if (n > 120) return setError('Indiquez un âge entre 0 et 120 ans.');
              setError(undefined);
              save.schedule({ age: n });
            }}
            onBlur={() => void save.flush()}
            className="max-w-[8rem]"
          />
        </Field>
        <div className="flex flex-wrap items-center gap-x-3">
          {switchButton}
          <SaveIndicator state={save.state} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Field label="Date de naissance" hint={knownAge !== null && !patient.birthDateEstimated ? `${knownAge} ans` : undefined}>
        <DatePicker
          birthDate
          max={todayISO()}
          value={date}
          onChange={(day) => {
            setDate(day);
            // While the year is being typed the browser gives years like 0019: wait for a real one
            if (!day) save.schedule({ dateOfBirth: null });
            else if (Number(day.slice(0, 4)) >= 1900) save.schedule({ dateOfBirth: day });
          }}
          onBlur={() => void save.flush()}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-x-3">
        {switchButton}
        <SaveIndicator state={save.state} />
      </div>
    </div>
  );
}

function SexField({ patient }: { patient: Patient }) {
  const [sex, setSex] = useState<string | null>(patient.sex);
  const save = usePatientPatch(patient.id);
  const choose = (value: 'F' | 'M') => {
    setSex(value);
    save.schedule({ sex: value });
    void save.flush();
  };
  return (
    <div className="space-y-1.5">
      <p className="text-base font-medium" id="sex-label">
        Sexe
      </p>
      <p className="text-sm text-muted-foreground">Pour calculer le MB</p>
      <div role="group" aria-labelledby="sex-label" className="flex gap-2">
        {(['F', 'M'] as const).map((value) => (
          <Button
            key={value}
            type="button"
            variant={sex === value ? 'default' : 'outline'}
            aria-pressed={sex === value}
            onClick={() => choose(value)}
            className="flex-1"
          >
            {value === 'F' ? 'Femme' : 'Homme'}
          </Button>
        ))}
      </div>
      <SaveIndicator state={save.state} />
    </div>
  );
}

/**
 * Height in cm, kept as a measurement (the latest one counts). Typing it again the same day corrects
 * today's measurement; another day adds a new one.
 */
function HeightField({ patientId, height }: { patientId: string; height?: Measurement }) {
  const invalidate = useInvalidatePatientFile();
  const [value, setValue] = useState(height ? String(height.value).replace('.', ',') : '');
  const [error, setError] = useState<string>();
  // Today's measurement, corrected rather than added again
  const todayId = useRef(height && height.measuredAt.slice(0, 10) === todayISO() ? height.id : null);
  const save = useAutosave(async (cm: number) => {
    if (todayId.current) {
      await api.patch(`/patients/${patientId}/measurements/${todayId.current}`, { value: cm });
    } else {
      const { data } = await api.post<Measurement>(`/patients/${patientId}/measurements`, { type: 'HEIGHT', value: cm });
      todayId.current = data.id;
    }
    invalidate(patientId);
  });

  return (
    <div>
      <Field
        label="Taille (cm)"
        hint={height ? `Mesurée le ${formatLongDate(height.measuredAt, true)}` : 'Pour calculer l’IMC et le MB'}
        error={error}
      >
        <Input
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            const cm = Number(e.target.value.replace(',', '.'));
            if (!e.target.value.trim()) return setError(undefined);
            if (!Number.isFinite(cm) || cm < 30 || cm > 250) {
              return setError('Indiquez la taille en centimètres, par exemple 159.');
            }
            setError(undefined);
            save.schedule(cm);
          }}
          onBlur={() => void save.flush()}
          className="max-w-[8rem]"
        />
      </Field>
      <SaveIndicator state={save.state} className="mt-1" />
    </div>
  );
}
