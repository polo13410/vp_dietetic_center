import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../../lib/api';
import { patient, renderWithProviders } from '../../test/patient-fixtures';

import { AppointmentFormDialog } from './AppointmentFormDialog';

vi.mock('../../lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
const { get, post } = vi.mocked(api);
// The patient search list scrolls its active item into view, which jsdom does not do
Element.prototype.scrollIntoView ??= vi.fn();

const created = { ...patient, id: 'p-new', firstName: 'Claire', lastName: 'Martin', phone: '06 11 22 33 44' };

const type = (label: RegExp | string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('AppointmentFormDialog: « Nouveau patient » from the agenda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue({ data: { data: [] } });
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
