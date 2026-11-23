/** The « Mesures » tab's timeline: measurements and life events, in one list. */
import type { LifeEvent, MeasureTimeline, MetricType, TimelineMeasurement } from './patient-file';

export type TimelineRow =
  | { kind: 'measurement'; id: string; date: string; measurement: TimelineMeasurement }
  | { kind: 'event'; id: string; date: string; event: LifeEvent };

/**
 * One list, latest first, of every measurement and life event. On the same day a life event comes
 * first (it explains what follows), then the measurements as the API ordered them.
 */
export function timelineRows(timeline: Pick<MeasureTimeline, 'measurements' | 'lifeEvents'>): TimelineRow[] {
  const rows: (TimelineRow & { order: number })[] = [
    ...timeline.lifeEvents.map((event, order) => ({
      kind: 'event' as const,
      id: `event-${event.id}`,
      date: event.date.slice(0, 10),
      event,
      order: order - timeline.lifeEvents.length,
    })),
    ...timeline.measurements.map((measurement, order) => ({
      kind: 'measurement' as const,
      id: `measurement-${measurement.id}`,
      date: measurement.measuredAt.slice(0, 10),
      measurement,
      order,
    })),
  ];
  return rows
    .sort((a, b) => b.date.localeCompare(a.date) || a.order - b.order)
    .map(({ order: _order, ...row }) => row);
}

/** The height curve is worth showing only when the height changed (a child, a teenager). */
export function heightChanges(measurements: Pick<TimelineMeasurement, 'type' | 'value'>[]): boolean {
  return new Set(measurements.filter((m) => m.type === 'HEIGHT').map((m) => m.value)).size > 1;
}

/** Whether any measurement of these types was taken. */
export function hasAny(measurements: Pick<TimelineMeasurement, 'type'>[], types: MetricType[]): boolean {
  return measurements.some((m) => types.includes(m.type));
}

/** A number typed with a comma or a dot (« 72,5 »); null when it is not one. */
export function parseDecimal(raw: string): number | null {
  const value = Number(raw.trim().replace(',', '.'));
  return raw.trim() !== '' && Number.isFinite(value) && value > 0 ? value : null;
}
