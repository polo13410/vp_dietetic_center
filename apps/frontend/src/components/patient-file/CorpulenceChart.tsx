import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { CorpulenceChartData, IotfRow } from '../../lib/patient-file';
import { cn, formatLongDate, formatNumber } from '../../lib/utils';

type CurveKey = Exclude<keyof IotfRow, 'age'>;

/** The IOTF curves, from the top, with the adult BMI each one reaches at 18. */
const CURVES: { key: CurveKey; label: string; color: string; dashed?: boolean }[] = [
  { key: 'obesity', label: 'Obésité (IMC 30 à 18 ans)', color: 'hsl(var(--danger))' },
  { key: 'overweight', label: 'Surpoids (IMC 25 à 18 ans)', color: 'hsl(var(--warning))' },
  { key: 'thinness1', label: 'Minceur grade 1 (IMC 18,5)', color: 'hsl(var(--info))', dashed: true },
  { key: 'thinness2', label: 'Minceur grade 2 (IMC 17)', color: 'hsl(var(--info))', dashed: true },
  { key: 'thinness3', label: 'Minceur grade 3 (IMC 16)', color: 'hsl(var(--muted-foreground))', dashed: true },
];

/**
 * The corpulence chart of a child or teenager (§ 3.1): their BMI against age, on the IOTF cut-off
 * curves of their sex (Cole et al. 2000 and 2007, served by the API). Values are also listed in
 * words: nothing is only readable on hover.
 */
export function CorpulenceChart({ data, className }: { data: CorpulenceChartData; className?: string }) {
  const points = data.points.map((p) => ({ age: p.ageYears, bmi: p.bmi, measuredAt: p.measuredAt }));
  const low = Math.min(...data.cutoffs.map((r) => r.thinness3), ...points.map((p) => p.bmi));
  const high = Math.max(...data.cutoffs.map((r) => r.obesity), ...points.map((p) => p.bmi));
  const domain: [number, number] = [Math.floor(low) - 1, Math.ceil(high) + 1];

  return (
    <div className="space-y-3">
      <div className={cn('h-72 w-full', className)} role="img" aria-label="Courbe de corpulence (IMC selon l’âge)">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart margin={{ top: 12, right: 12, bottom: 4, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="age"
              type="number"
              domain={[2, 18]}
              ticks={[2, 4, 6, 8, 10, 12, 14, 16, 18]}
              interval={0}
              allowDuplicatedCategory={false}
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
              labelFormatter={(age) => `${formatNumber(Number(age), 1)} ans`}
              formatter={(value, name) => [formatNumber(Number(value)), name]}
              contentStyle={{ fontSize: 14, borderRadius: 8 }}
            />
            {CURVES.map((curve) => (
              <Line
                key={curve.key}
                data={data.cutoffs}
                dataKey={curve.key}
                name={curve.label}
                stroke={curve.color}
                strokeWidth={1.5}
                strokeDasharray={curve.dashed ? '5 4' : undefined}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            ))}
            <Line
              data={points}
              dataKey="bmi"
              name="IMC"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              dot={{ r: 4, fill: 'hsl(var(--primary))' }}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground" aria-label="Légende">
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-1 w-5 rounded bg-primary" aria-hidden /> IMC du patient
        </li>
        {CURVES.map((curve) => (
          <li key={curve.key} className="flex items-center gap-1.5">
            <span
              className="inline-block w-5 border-t-2"
              style={{ borderColor: curve.color, borderTopStyle: curve.dashed ? 'dashed' : 'solid' }}
              aria-hidden
            />
            {curve.label}
          </li>
        ))}
      </ul>
      <p className="sr-only">
        {points
          .map((p) => `${formatLongDate(p.measuredAt)}, ${formatNumber(p.age, 1)} ans : IMC ${formatNumber(p.bmi)}`)
          .join(' ; ')}
      </p>
      <p className="text-sm text-muted-foreground">
        Seuils internationaux IOTF ({data.sex === 'F' ? 'filles' : 'garçons'}) : {data.sources.join(' ; ')}.
      </p>
    </div>
  );
}
