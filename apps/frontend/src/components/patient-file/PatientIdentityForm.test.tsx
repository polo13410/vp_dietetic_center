import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../../lib/api';
import { patient, PATIENT_ID, renderWithProviders } from '../../test/patient-fixtures';

import { PatientIdentityForm } from './PatientIdentityForm';

vi.mock('../../lib/api', () => ({ default: { patch: vi.fn() } }));
const patch = vi.mocked(api.patch);

describe('PatientIdentityForm', () => {
  beforeEach(() => {
    patch.mockReset();
    patch.mockResolvedValue({ data: {} });
  });

  it('saves a field when leaving it', async () => {
    renderWithProviders(<PatientIdentityForm patient={patient} />);
    const phone = screen.getByLabelText('Téléphone');
    fireEvent.change(phone, { target: { value: '06 11 22 33 44' } });
    fireEvent.blur(phone);
    await waitFor(() => expect(patch).toHaveBeenCalledWith(`/patients/${PATIENT_ID}`, { phone: '06 11 22 33 44' }));
    expect(await screen.findByText(/Enregistré à/)).toBeInTheDocument();
  });

  it('clears an optional field', async () => {
    renderWithProviders(<PatientIdentityForm patient={patient} />);
    const email = screen.getByLabelText('E-mail');
    fireEvent.change(email, { target: { value: '' } });
    fireEvent.blur(email);
    await waitFor(() => expect(patch).toHaveBeenCalledWith(`/patients/${PATIENT_ID}`, { email: null }));
  });

  it('refuses an empty name or a wrong e-mail, without saving', async () => {
    renderWithProviders(<PatientIdentityForm patient={patient} />);
    const lastName = screen.getByLabelText(/^Nom/);
    fireEvent.change(lastName, { target: { value: ' ' } });
    fireEvent.blur(lastName);
    expect(screen.getByText('Le nom est obligatoire.')).toBeInTheDocument();

    const email = screen.getByLabelText('E-mail');
    fireEvent.change(email, { target: { value: 'martine@' } });
    fireEvent.blur(email);
    expect(screen.getByText('L’adresse e-mail n’est pas valide.')).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
  });
});
