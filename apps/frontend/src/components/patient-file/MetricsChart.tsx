import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { type LifeEvent, type Measurement, METRICS, type MetricType } from '../../lib/patient-file';
import { cn, formatDate, formatLongDate, formatNumber } from '../../lib/utils';

const DAY = 86_400_000;

/**
 * One measurement over time (the weight curve, or the extra measurements), with the patient's life
 * events drawn on it and listed underneath, so a change can be read against what was happening.
 */
export function MetricsChart({
  measurements,
  events = [],
  types,
  className,
}: {
  measurements: Measurement[];
  events?: LifeEvent[];
  /** The measurements that can be shown; a choice appears when there are several */
  types: MetricType[];
  /** Height of the chart (default h-64) */
  className?: string;
}) {
  const available = useMemo(() => {
    const present = new Set(measurements.map((m) => m.type));
    return types.filter((t) => present.has(t));
  }, [measurements, types]);
  const [selected, setSelected] = useState<MetricType | null>(null);
  const series = selected && available.includes(selected) ? selected : available[0];

  const data = useMemo(
    () =>
      measurements
        .filter((m) => m.type === series)
        .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
        .map((m) => ({ t: new Date(m.measuredAt).getTime(), value: m.value })),
    [series, measurements],
  );

  if (!series) return null;

  const { unit, label } = METRICS[series];
  const values = data.map((d) => d.value);
  const pad = Math.max((Math.max(...values) - Math.min(...values)) * 0.2, 1);
  const domain: [number, number] = [Math.floor(Math.min(...values) - pad), Math.ceil(Math.max(...values) + pad)];
  const first = data[0].t;
  const last = data[data.length - 1].t;
  const shownEvents = events.filter((e) => {
    const t = new Date(e.date).getTime();
    return t >= first - 30 * DAY && t <= last + 30 * DAY;
  });

  return (
    <div className="space-y-2">
      {available.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Mesure affichée">
          {available.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={t === series}
              onClick={() => setSelected(t)}
              className={cn(
                'min-h-11 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                t === series
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-card text-foreground hover:bg-accent',
              )}
            >
              {METRICS[t].label}
            </button>
          ))}
        </div>
      )}

      <div className={cn('h-64 w-full', className)} role="img" aria-label={`Courbe : ${label}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={[first - 7 * DAY, last + 7 * DAY]}
              // Over a long history (weights entered from years before) the year matters more than the day
              tickFormatter={(t) => formatDate(new Date(t), last - first > 300 * DAY ? 'MM/yyyy' : 'dd/MM')}
              tick={{ fontSize: 13, fill: 'hsl(var(--muted-foreground))' }}
              stroke="hsl(var(--border))"
            />
            <YAxis
              domain={domain}
              tick={{ fontSize: 13, fill: 'hsl(var(--muted-foreground))' }}
              stroke="hsl(var(--border))"
              width={44}
            />
            <Tooltip
              labelFormatter={(t) => formatLongDate(new Date(Number(t)))}
              formatter={(v) => [`${formatNumber(Number(v), 1)} ${unit}`, label]}
              contentStyle={{ fontSize: 14, borderRadius: 8 }}
            />
            {shownEvents.map((e) => (
              <ReferenceLine
                key={e.id}
                x={new Date(e.date).getTime()}
                stroke="hsl(var(--info))"
                strokeDasharray="4 3"
                label={{ value: '◆', position: 'top', fill: 'hsl(var(--info))', fontSize: 12 }}
              />
            ))}
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              dot={{ r: 4, fill: 'hsl(var(--primary))' }}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Values and events in words too: nothing is only readable on hover */}
      <p className="sr-only">
        {data.map((d) => `${formatLongDate(new Date(d.t))} : ${formatNumber(d.value, 1)} ${unit}`).join(' ; ')}
      </p>
      {shownEvents.length > 0 && (
        <ul className="space-y-0.5 text-sm text-muted-foreground">
          {shownEvents.map((e) => (
            <li key={e.id}>
              <span className="text-info" aria-hidden>
                ◆
              </span>{' '}
              {formatLongDate(e.date, true)} · {e.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
