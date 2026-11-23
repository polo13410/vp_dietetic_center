import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { BookingOptionsDto } from '@vp/types';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { patient, renderWithProviders } from '../../test/patient-fixtures';

import { AppointmentFormDialog } from './AppointmentFormDialog';

vi.mock('../../lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
const { get, post } = vi.mocked(api);
// The patient search list scrolls its active item into view, which jsdom does not do
Element.prototype.scrollIntoView ??= vi.fn();

const created = { ...patient, id: 'p-new', firstName: 'Claire', lastName: 'Martin', phone: '06 11 22 33 44' };

const aix = { id: 'pr-aix', name: 'Cabinet d’Aix', address: '12 rue des Oliviers', zipCode: '13100', city: 'Aix-en-Provence', isDefault: true };
const marseille = { id: 'pr-mrs', name: 'Marseille', address: '40 rue de Rome', zipCode: '13006', city: 'Marseille', isDefault: false };
const formulas: BookingOptionsDto['formulas'] = [
  { id: 'f-bilan', label: 'Bilan', priceCents: 6000, durationMinutes: 60 },
  { id: 'f-suivi', label: 'Suivi', priceCents: 5000, durationMinutes: 45 },
];
let options: BookingOptionsDto = { formulas, practices: [aix] };

/** Patients search, and what appointments are booked with */
function serve() {
  get.mockImplementation((async (url: string) =>
    url === '/appointments/options' ? { data: options } : { data: { data: [] } }) as never);
}

const type = (label: RegExp | string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('AppointmentFormDialog: « Nouveau patient » from the agenda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    options = { formulas: [], practices: [aix] };
    serve();
    useAuthStore.setState({
      user: { id: 'u1', email: 'v@example.fr', firstName: 'Valérie', lastName: 'Perrot', role: 'PRATICIENNE' as never },
      isAuthenticated: true,
    });
    post.mockImplementation((async (url: string) =>
      url === '/patients' ? { data: created } : { data: { id: 'a-1' } }) as never);
  });

  it('creates the patient with the short version, then books the appointment for them', async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(
      <AppointmentFormDialog open onOpenChange={onOpenChange} defaultValues={{ startAt: '2026-11-24T14:00' }} />,
    );

    click('Nouveau patient');
    expect(screen.getByRole('heading', { name: 'Nouveau patient' })).toBeInTheDocument();
    // Only step 1 of the wizard and the phone
    expect(screen.getByLabelText(/^Prénom/)).toBeInTheDocument();
    expect(screen.getByLabelText('Date de naissance')).toBeInTheDocument();
    expect(screen.queryByLabelText('E-mail')).not.toBeInTheDocument();

    click('Créer le patient');
    expect(screen.getByText('Indiquez le prénom.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    type(/^Prénom/, 'Claire');
    type(/^Nom/, 'Martin');
    type('Téléphone', '06 11 22 33 44');
    click('Créer le patient');

    // Back on the appointment, with the new patient selected and the time kept
    expect(await screen.findByRole('heading', { name: 'Nouveau rendez-vous' })).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/patients', {
      firstName: 'Claire',
      lastName: 'Martin',
      sex: null,
      dateOfBirth: null,
      phone: '06 11 22 33 44',
    });
    expect(screen.getAllByRole('combobox')[0]).toHaveTextContent('Claire Martin');

    click('Prendre le rendez-vous');
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/appointments',
        expect.objectContaining({ patientId: 'p-new', startAt: new Date('2026-11-24T14:00').toISOString() }),
      ),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('offers it from the patient search, with the name typed there', async () => {
    renderWithProviders(<AppointmentFormDialog open onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Choisir un patient'));
    fireEvent.change(await screen.findByPlaceholderText('Rechercher un patient…'), {
      target: { value: 'Marie Dupont' },
    });
    fireEvent.click(await screen.findByText('Nouveau patient : Marie Dupont'));
    expect(await screen.findByLabelText(/^Prénom/)).toHaveValue('Marie');
    expect(screen.getByLabelText(/^Nom/)).toHaveValue('Dupont');
  });

  it('goes back to the appointment without creating anyone', () => {
    renderWithProviders(<AppointmentFormDialog open onOpenChange={vi.fn()} />);
    click('Nouveau patient');
    click('Retour au rendez-vous');
    expect(screen.getByRole('heading', { name: 'Nouveau rendez-vous' })).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('is not offered when the appointment is edited', () => {
    renderWithProviders(<AppointmentFormDialog open onOpenChange={vi.fn()} editId="a-1" />);
    expect(screen.queryByRole('button', { name: 'Nouveau patient' })).not.toBeInTheDocument();
  });
});

describe('AppointmentFormDialog: type of appointment and practice (lot 15)', () => {
  const book = (props: Partial<Parameters<typeof AppointmentFormDialog>[0]> = {}) =>
    renderWithProviders(
      <AppointmentFormDialog
        open
        onOpenChange={vi.fn()}
        defaultValues={{ patientId: 'p-1', startAt: '2026-11-24T14:00' }}
        {...props}
      />,
    );
  const typeField = () => screen.findByLabelText(/^Type de rendez-vous/);

  beforeEach(() => {
    vi.clearAllMocks();
    options = { formulas, practices: [aix] };
    serve();
    post.mockResolvedValue({ data: { id: 'a-1' } });
    useAuthStore.setState({
      user: { id: 'u1', email: 'v@example.fr', firstName: 'Valérie', lastName: 'Perrot', role: 'PRATICIENNE' as never },
      isAuthenticated: true,
    });
  });

  it('offers her types with price and duration; the type fills the duration, still editable', async () => {
    book();
    const field = await typeField();
    expect([...(field as HTMLSelectElement).options].map((o) => o.text.replace(/\s/g, ' '))).toEqual([
      'Choisir le type…',
      'Bilan · 60 € · 1 h',
      'Suivi · 50 € · 45 min',
    ]);
    fireEvent.change(field, { target: { value: 'f-bilan' } });
    expect(screen.getByLabelText('Durée en minutes')).toHaveValue(60);
    fireEvent.change(field, { target: { value: 'f-suivi' } });
    expect(screen.getByLabelText('Durée en minutes')).toHaveValue(45);
    fireEvent.change(screen.getByLabelText('Durée en minutes'), { target: { value: '50' } });

    click('Prendre le rendez-vous');
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/appointments', {
        patientId: 'p-1',
        startAt: new Date('2026-11-24T14:00').toISOString(),
        duration: 50,
        type: 'IN_PERSON',
        formulaId: 'f-suivi',
        practiceId: 'pr-aix',
        reason: null,
      }),
    );
  });

  it('asks for the type of a new appointment', async () => {
    book();
    await typeField();
    click('Prendre le rendez-vous');
    expect(await screen.findByText('Choisissez le type de rendez-vous.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('with one practice, does not ask where: it is her default one', async () => {
    book();
    await typeField();
    expect(screen.queryByLabelText('Cabinet')).not.toBeInTheDocument();
  });

  it('with several, offers the practice prefilled with the default one, hidden by video or phone', async () => {
    options = { formulas, practices: [aix, marseille] };
    book();
    const cabinet = await screen.findByLabelText('Cabinet');
    expect(cabinet).toHaveValue('pr-aix');
    expect([...(cabinet as HTMLSelectElement).options].map((o) => o.text)).toEqual([
      'Cabinet d’Aix · 12 rue des Oliviers, 13100 Aix-en-Provence',
      'Marseille · 40 rue de Rome, 13006 Marseille',
    ]);
    fireEvent.change(cabinet, { target: { value: 'pr-mrs' } });

    fireEvent.click(screen.getByRole('button', { name: 'Vidéo' }));
    expect(screen.queryByLabelText('Cabinet')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'En cabinet' }));
    expect(screen.getByLabelText('Cabinet')).toHaveValue('pr-mrs');

    fireEvent.change(await typeField(), { target: { value: 'f-bilan' } });
    fireEvent.change(screen.getByLabelText(/^Note/), { target: { value: '  Apporter ses analyses ' } });
    click('Prendre le rendez-vous');
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/appointments',
        expect.objectContaining({ formulaId: 'f-bilan', duration: 60, practiceId: 'pr-mrs', reason: 'Apporter ses analyses' }),
      ),
    );
  });

  it('prefills the default practice when opened after the options were loaded (agenda, dashboard)', async () => {
    options = { formulas, practices: [aix, marseille] };
    function Agenda() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Ouvrir</button>
          <AppointmentFormDialog open={open} onOpenChange={setOpen} defaultValues={{ patientId: 'p-1' }} />
        </>
      );
    }
    renderWithProviders(<Agenda />);
    await waitFor(() => expect(get).toHaveBeenCalledWith('/appointments/options', expect.anything()));
    await new Promise((resolve) => setTimeout(resolve, 0));
    click('Ouvrir');
    expect(await screen.findByLabelText('Cabinet')).toHaveValue('pr-aix');
  });

  it('sends no practice for a phone appointment', async () => {
    options = { formulas, practices: [aix, marseille] };
    book();
    fireEvent.change(await typeField(), { target: { value: 'f-suivi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Téléphone' }));
    click('Prendre le rendez-vous');
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][1]).toMatchObject({ type: 'PHONE', formulaId: 'f-suivi' });
    expect(post.mock.calls[0][1]).not.toHaveProperty('practiceId');
  });

  it('keeps, when editing, a type and a practice no longer offered', async () => {
    options = { formulas, practices: [aix] };
    book({
      editId: 'a-1',
      defaultValues: { patientId: 'p-1', startAt: '2026-11-24T14:00', duration: 90, formulaId: 'f-old', practiceId: 'pr-old' },
      booked: { formula: { id: 'f-old', label: 'Forfait' }, practice: { id: 'pr-old', name: 'Salon' } },
    });
    expect(await typeField()).toHaveValue('f-old');
    expect(await screen.findByLabelText('Cabinet')).toHaveValue('pr-old');
    expect(screen.getByLabelText('Durée en minutes')).toHaveValue(90);
  });
});
