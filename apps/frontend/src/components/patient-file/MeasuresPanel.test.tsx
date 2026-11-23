import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../../lib/api';
import type { MeasureTimeline } from '../../lib/patient-file';
import { apiGet, measureTimeline, PATIENT_ID, renderWithProviders, ROUTES } from '../../test/patient-fixtures';

import { MeasuresPanel } from './MeasuresPanel';

vi.mock('../../lib/api', () => ({ default: { get: vi.fn(), request: vi.fn() } }));
const mocked = vi.mocked(api);

const rows = () => within(screen.getByRole('list', { name: 'Frise des mesures' })).getAllByRole('listitem');

describe('MeasuresPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.get.mockImplementation(apiGet(ROUTES) as never);
    mocked.request.mockResolvedValue({ data: {} });
  });

  it('lists every measurement and life event, latest first, with the figures of each weight', async () => {
    renderWithProviders(<MeasuresPanel patientId={PATIENT_ID} />);
    await screen.findByRole('list', { name: 'Frise des mesures' });
    const items = rows();
    expect(items).toHaveLength(6);
    expect(items[0]).toHaveTextContent('76,5 kg');
    expect(items[0]).toHaveTextContent('IMC 30,26');
    expect(items[0]).toHaveTextContent(/MB 5,77 MJ · 1\s378,9 kcal/);
    expect(within(items[0]).getByRole('link', { name: 'Prise en séance : Suivi 2' })).toHaveAttribute('href', '/consultations/c-3');
    expect(items[3]).toHaveTextContent('Taille159 cm');
    expect(items[4]).toHaveTextContent('Fait marquant · Grossesse · Santé');
    // Before the follow-up, with its note and the height measured at the bilan
    expect(items[5]).toHaveTextContent('70 kg');
    expect(items[5]).toHaveTextContent('IMC 27,69');
    expect(items[5]).toHaveTextContent('Surpoids');
    expect(items[5]).toHaveTextContent('Avant sa grossesse');
    expect(within(items[5]).queryByRole('link')).not.toBeInTheDocument();
  });

  it('adds a measurement at a past date, with a note, in place', async () => {
    renderWithProviders(<MeasuresPanel patientId={PATIENT_ID} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter une mesure' }));
    const form = screen.getByRole('form', { name: 'Ajouter une mesure' });
    fireEvent.change(within(form).getByLabelText('Date', { exact: false }), { target: { value: '2018-03-01' } });
    fireEvent.change(within(form).getByLabelText('Valeur (kg)'), { target: { value: '68,5' } });
    fireEvent.change(within(form).getByLabelText('Note', { exact: false }), { target: { value: 'Avant le traitement' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer la mesure' }));

    await waitFor(() =>
      expect(mocked.request).toHaveBeenCalledWith({
        method: 'post',
        url: `/patients/${PATIENT_ID}/measurements`,
        data: { type: 'WEIGHT', value: 68.5, measuredAt: '2018-03-01', note: 'Avant le traitement' },
      }),
    );
    // Stays open on the same date, to enter a history quickly
    expect(within(form).getByLabelText('Valeur (kg)')).toHaveValue('');
    expect(within(form).getByLabelText('Date', { exact: false })).toHaveValue('2018-03-01');
  });

  it('adds a height, in cm', async () => {
    renderWithProviders(<MeasuresPanel patientId={PATIENT_ID} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ajouter une mesure' }));
    const form = screen.getByRole('form', { name: 'Ajouter une mesure' });
    fireEvent.change(within(form).getByLabelText('Mesure'), { target: { value: 'HEIGHT' } });
    fireEvent.change(within(form).getByLabelText('Valeur (cm)'), { target: { value: '132' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer la mesure' }));
    await waitFor(() =>
      expect(mocked.request.mock.calls[0][0]).toMatchObject({ data: { type: 'HEIGHT', value: 132 } }),
    );
  });

  it('corrects a measurement in its row; a séance’s keeps the séance date', async () => {
    renderWithProviders(<MeasuresPanel patientId={PATIENT_ID} />);
    await screen.findByRole('list', { name: 'Frise des mesures' });
    fireEvent.click(screen.getByRole('button', { name: /Corriger poids du 15 novembre 2026/ }));
    const form = screen.getByRole('form', { name: 'Corriger : Poids' });
    expect(within(form).getByLabelText('Date', { exact: false })).toBeDisabled();
    fireEvent.change(within(form).getByLabelText('Poids (kg)'), { target: { value: '76,2' } });
    fireEvent.change(within(form).getByLabelText('Note'), { target: { value: 'Pesée habillée' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(mocked.request).toHaveBeenCalledWith({
        method: 'patch',
        url: `/patients/${PATIENT_ID}/measurements/m-3`,
        data: { value: 76.2, note: 'Pesée habillée' },
      }),
    );
  });

  it('corrects the date of a measurement taken outside a séance', async () => {
    renderWithProviders(<MeasuresPanel patientId={PATIENT_ID} />);
    await screen.findByRole('list', { name: 'Frise des mesures' });
    fireEvent.click(screen.getByRole('button', { name: /Corriger poids du 1(er)? mai 2019/ }));
    const form = screen.getByRole('form', { name: 'Corriger : Poids' });
    fireEvent.change(within(form).getByLabelText('Date', { exact: false }), { target: { value: '2019-06-01' } });
    fireEvent.change(within(form).getByLabelText('Note'), { target: { value: '' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(mocked.request.mock.calls[0][0]).toEqual({
        method: 'patch',
        url: `/patients/${PATIENT_ID}/measurements/m-0`,
        data: { value: 70, note: null, measuredAt: '2019-06-01' },
      }),
    );
  });

  it('deletes a row after confirmation', async () => {
    renderWithProviders(<MeasuresPanel patientId={PATIENT_ID} />);
    await screen.findByRole('list', { name: 'Frise des mesures' });
    fireEvent.click(screen.getByRole('button', { name: /Supprimer ce fait marquant du 15 janvier 2020/ }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('« Grossesse »');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }));
    await waitFor(() =>
      expect(mocked.request).toHaveBeenCalledWith({
        method: 'delete',
        url: `/patients/${PATIENT_ID}/life-events/ev-1`,
        data: undefined,
      }),
    );
  });

  it('draws the corpulence chart and names a child’s IOTF class', async () => {
    const child: MeasureTimeline = {
      lifeEvents: [],
      measurements: [
        {
          ...measureTimeline.measurements[4],
          value: 45,
          measuredAt: '2026-06-01T00:00:00.000Z',
          note: null,
          figures: {
            age: 12,
            minor: true,
            weight: 45,
            height: { value: 140, measuredAt: '2026-06-01T00:00:00.000Z' },
            bmi: {
              value: 22.96,
              category: null,
              child: { ageYears: 12, class: 'OVERWEIGHT', cutoffs: null },
            },
            bmr: { mj: 5.1, kcal: 1218.6, adultFormulaForMinor: true },
            missing: [],
          },
        },
        { ...measureTimeline.measurements[3], value: 140, measuredAt: '2026-06-01T00:00:00.000Z', session: null },
        { ...measureTimeline.measurements[3], id: 'm-h0', value: 132, measuredAt: '2024-06-01T00:00:00.000Z', session: null },
      ],
      corpulence: {
        sex: 'F',
        cutoffs: [
          { age: 12, thinness3: 13.39, thinness2: 14.28, thinness1: 15.62, overweight: 21.68, obesity: 26.67 },
          { age: 12.5, thinness3: 13.65, thinness2: 14.56, thinness1: 15.93, overweight: 22.14, obesity: 27.24 },
        ],
        points: [{ measurementId: 'm-0', measuredAt: '2026-06-01T00:00:00.000Z', ageYears: 12, bmi: 22.96 }],
        sources: ['Cole TJ et al. BMJ 2000;320:1240 (surpoids, obésité)', 'Cole TJ et al. BMJ 2007;335:194 (minceur)'],
      },
    };
    mocked.get.mockImplementation(apiGet({ ...ROUTES, [`/patients/${PATIENT_ID}/measurements/timeline`]: child }) as never);
    renderWithProviders(<MeasuresPanel patientId={PATIENT_ID} />);

    expect(await screen.findByRole('heading', { name: 'Courbe de corpulence' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Taille' })).toBeInTheDocument();
    expect(screen.getByText(/Seuils internationaux IOTF \(filles\) : Cole TJ et al\. BMJ 2000/)).toBeInTheDocument();
    const [weight] = rows();
    expect(weight).toHaveTextContent('Surpoids (IOTF)');
    expect(weight).toHaveTextContent('formule adulte');
    expect(weight).toHaveTextContent('Avec la taille de l’époque : 140 cm');
  });

  it('guides when nothing was measured yet', async () => {
    mocked.get.mockImplementation(
      apiGet({
        ...ROUTES,
        [`/patients/${PATIENT_ID}/measurements/timeline`]: { measurements: [], lifeEvents: [], corpulence: null },
      }) as never,
    );
    renderWithProviders(<MeasuresPanel patientId={PATIENT_ID} />);
    expect(await screen.findByText('Aucune mesure pour l’instant')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Courbe de corpulence' })).not.toBeInTheDocument();
  });
});
