import { ChevronDown, ClipboardList, Play } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useShowPractices } from '../../hooks/useMe';
import {
  type Consultation,
  formatDelta,
  formatPrice,
  PAYMENT_METHODS,
  sessionName,
  useConsultations,
} from '../../lib/patient-file';
import { cn, formatLongDate, formatNumber } from '../../lib/utils';
import { EmptyState } from '../shared/EmptyState';
import { Section } from '../shared/Section';
import { StatusBadge } from '../shared/StatusBadge';
import { Button } from '../ui/button';
import { LoadingSpinner } from '../ui/loading-screen';

const NUMBERS = ['Poids', 'IMC', 'MB (MJ)', 'MB (kcal)'];
/** Her columns; « Cabinet » only when she consults in several practices */
const columns = (withPractice: boolean) => [
  'Séance',
  'Date',
  'Formule',
  ...(withPractice ? ['Cabinet'] : []),
  'Paiement',
  ...NUMBERS,
];

/**
 * Her « Suivi » sheet: one row per session, Bilan first, with the figures computed by the API. A row
 * opens the session; its arrow unfolds the texts to read them here.
 */
export function SessionsPanel({
  patientId,
  onStart,
  starting,
}: {
  patientId: string;
  /** Starts a new session (the page knows if there is an appointment today) */
  onStart: () => void;
  starting?: boolean;
}) {
  const { data: latestFirst = [], isLoading } = useConsultations(patientId);
  const sessions = [...latestFirst].reverse();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const showPractice = useShowPractices();
  const COLUMNS = columns(showPractice);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // The header already has the green « Nouvelle séance »: here it is secondary, except to start the bilan
  const startButton = (
    <Button onClick={onStart} disabled={starting} variant={sessions.length === 0 ? 'default' : 'outline'}>
      <Play aria-hidden /> {sessions.length === 0 ? 'Démarrer le bilan' : 'Nouvelle séance'}
    </Button>
  );

  if (isLoading) return <LoadingSpinner />;

  return (
    <Section
      icon={ClipboardList}
      area="patients"
      title="Suivi"
      description={sessions.length > 0 && `${sessions.length} séance${sessions.length > 1 ? 's' : ''}`}
      action={sessions.length > 0 && startButton}
      flush
    >
      {sessions.length === 0 ? (
        <EmptyState illustration="pear" title="Aucune séance pour l’instant" action={startButton} />
      ) : (
        <div className="overflow-x-auto border-t">
          <table className="w-full min-w-[46rem] text-base">
            <thead className="bg-muted text-left text-sm text-muted-foreground">
              <tr>
                {COLUMNS.map((c, i) => (
                  <th key={c} scope="col" className={cn('whitespace-nowrap px-3 py-3 font-medium', NUMBERS.includes(c) && 'text-right', i === 0 && 'pl-5')}>
                    {c}
                  </th>
                ))}
                <th scope="col" className="w-14 pr-3">
                  <span className="sr-only">Textes de la séance</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const expanded = open.has(s.id);
                return (
                  <Fragment key={s.id}>
                    <tr
                      className="h-14 cursor-pointer border-t transition-colors hover:bg-accent/50"
                      onClick={() => navigate(`/consultations/${s.id}`)}
                    >
                      <td className="whitespace-nowrap py-2 pl-5 pr-3 font-medium">
                        <Link
                          to={`/consultations/${s.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {sessionName(s.sequence)}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">{formatLongDate(s.date)}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {s.formulaLabel ? (
                          <>
                            {s.formulaLabel}
                            {s.priceCents !== null && (
                              <span className="text-muted-foreground"> · {formatPrice(s.priceCents)}</span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      {showPractice && (
                        <td className="whitespace-nowrap px-3 py-2">
                          {s.practice?.name ?? <span className="text-muted-foreground">—</span>}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-3 py-2">
                        {s.paymentMethod === 'NONE' ? (
                          <StatusBadge status="UNPAID" tone="warning" label={PAYMENT_METHODS.NONE} />
                        ) : (
                          PAYMENT_METHODS[s.paymentMethod]
                        )}
                      </td>
                      <WeightCell session={s} />
                      <NumberCell value={s.figures.bmi?.value} />
                      <NumberCell value={s.figures.bmr?.mj} />
                      <NumberCell value={s.figures.bmr?.kcal} digits={1} />
                      <td className="py-1 pr-3 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-expanded={expanded}
                          aria-label={`${expanded ? 'Replier' : 'Lire'} les textes : ${sessionName(s.sequence)}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle(s.id);
                          }}
                        >
                          <ChevronDown className={cn('transition-transform', expanded && 'rotate-180')} aria-hidden />
                        </Button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-background">
                        <td colSpan={COLUMNS.length + 1} className="px-5 pb-5 pt-2">
                          <SessionTexts session={s} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {sessions.some((s) => s.figures.bmr?.adultFormulaForMinor) && (
            <p className="border-t px-5 py-3 text-sm text-muted-foreground">
              Avant 18 ans, le MB est calculé avec la formule de Black, une formule adulte.
            </p>
          )}
        </div>
      )}
    </Section>
  );
}

function NumberCell({ value, digits = 2 }: { value?: number | null; digits?: number }) {
  return (
    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
      {value != null ? formatNumber(value, digits) : <span className="text-muted-foreground">—</span>}
    </td>
  );
}

function WeightCell({ session }: { session: Consultation }) {
  const { weight } = session.figures;
  const delta = session.weightChange.sincePrevious;
  return (
    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
      {weight !== null ? (
        <>
          {formatNumber(weight, 1)} kg
          {delta !== null && <span className="block text-sm text-muted-foreground">{formatDelta('WEIGHT', delta)}</span>}
        </>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </td>
  );
}

/** The session's texts, in the order of her sheet. */
function SessionTexts({ session }: { session: Consultation }) {
  const texts = [
    ['Habitudes et évolution', session.habits],
    ['Travail en consultation', session.sessionWork],
    ['Conseils diététiques', session.advice],
  ] as const;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {texts.map(([label, text]) => (
        <div key={label}>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="whitespace-pre-line leading-relaxed">
            {text || <span className="text-muted-foreground">Rien d’écrit</span>}
          </p>
        </div>
      ))}
    </div>
  );
}
