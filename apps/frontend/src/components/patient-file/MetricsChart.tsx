import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  EVENT_CATEGORIES,
  type LifeEvent,
  type Measurement,
  METRIC_TYPES,
  METRICS,
  type MetricType,
} from '../../lib/patient-file';
import { cn, formatDate } from '../../lib/utils';

type Series = MetricType | 'BMI';

/** Background bands of the BMI chart (same thresholds as the API's categories). */
const BMI_BANDS = [
  { from: 0, to: 18.5, fill: '#38bdf8' },
  { from: 18.5, to: 25, fill: '#34d399' },
  { from: 25, to: 30, fill: '#fbbf24' },
  { from: 30, to: 40, fill: '#fb923c' },
  { from: 40, to: 80, fill: '#f87171' },
];

/**
 * One measurement over time, with the patient's life events drawn on it, so a change can be
 * read against what was happening ("weight went up after the move").
 */
export function MetricsChart({ measurements, events }: { measurements: Measurement[]; events: LifeEvent[] }) {
  const available = useMemo(() => {
    const types = new Set(measurements.map((m) => m.type));
    const list: Series[] = METRIC_TYPES.filter((t) => t !== 'HEIGHT' && types.has(t));
    if (types.has('WEIGHT') && types.has('HEIGHT')) list.splice(1, 0, 'BMI');
    return list;
  }, [measurements]);
  const [selected, setSelected] = useState<Series | null>(null);
  const series = selected && available.includes(selected) ? selected : available[0];

  const data = useMemo(() => pointsFor(series, measurements), [series, measurements]);

  if (!series) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Aucune mesure pour l’instant.</p>;
  }

  const unit = series === 'BMI' ? '' : METRICS[series].unit;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.2, 1);
  const domain: [number, number] = [Math.floor(min - pad), Math.ceil(max + pad)];
  const first = data[0]?.t ?? 0;
  const last = data[data.length - 1]?.t ?? 0;
  const visibleEvents = events.filter((e) => {
    const t = new Date(e.date).getTime();
    return t >= first - 30 * 86400000 && t <= last + 30 * 86400000;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {available.map((s) => (
          <button
            key={s}
            onClick={() => setSelected(s)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition-colors',
              s === series
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {s === 'BMI' ? 'IMC' : METRICS[s].label}
          </button>
        ))}
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 16, right: 16, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            {series === 'BMI' &&
              BMI_BANDS.map((b) => (
                <ReferenceArea
                  key={b.from}
                  y1={Math.max(b.from, domain[0])}
                  y2={Math.min(b.to, domain[1])}
                  fill={b.fill}
                  fillOpacity={0.12}
                  ifOverflow="hidden"
                />
              ))}
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[first - 7 * 86400000, last + 7 * 86400000]}
              tickFormatter={(t) => formatDate(new Date(t), 'dd/MM')}
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
            />
            <YAxis domain={domain} tick={{ fontSize: 11 }} unit={unit ? ` ${unit}` : ''} width={64} />
            <Tooltip
              labelFormatter={(t) => formatDate(new Date(Number(t)))}
              formatter={(v) => [`${Number(v).toLocaleString('fr-FR')}${unit ? ` ${unit}` : ''}`, series === 'BMI' ? 'IMC' : METRICS[series].label]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            {visibleEvents.map((e) => (
              <ReferenceLine
                key={e.id}
                x={new Date(e.date).getTime()}
                stroke="#a855f7"
                strokeDasharray="4 3"
                label={{ value: '◆', position: 'top', fill: '#a855f7', fontSize: 10 }}
              />
            ))}
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {visibleEvents.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {visibleEvents.map((e) => (
            <li key={e.id}>
              <span className="text-purple-500">◆</span> {formatDate(e.date)} · {e.title}{' '}
              {e.category && <span className="opacity-70">({EVENT_CATEGORIES[e.category]})</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function pointsFor(series: Series | undefined, measurements: Measurement[]) {
  if (!series) return [];
  const sorted = [...measurements].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  if (series !== 'BMI') {
    return sorted.filter((m) => m.type === series).map((m) => ({ t: new Date(m.measuredAt).getTime(), value: m.value }));
  }
  // BMI of each weighing, with the most recent height known at that date (or the first one)
  const heights = sorted.filter((m) => m.type === 'HEIGHT');
  return sorted
    .filter((m) => m.type === 'WEIGHT')
    .map((w) => {
      const height = [...heights].reverse().find((h) => h.measuredAt <= w.measuredAt) ?? heights[0];
      const meters = height.value / 100;
      return { t: new Date(w.measuredAt).getTime(), value: Math.round((w.value / (meters * meters)) * 10) / 10 };
    });
}
