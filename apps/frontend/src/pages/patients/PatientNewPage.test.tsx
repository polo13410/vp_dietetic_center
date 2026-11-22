import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import api from '../../lib/api';
import { apiGet, patient, PATIENT_ID, ROUTES } from '../../test/patient-fixtures';

import PatientNewPage from './PatientNewPage';

vi.mock('../../lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
const { get, post, patch, put } = vi.mocked(api);

const NEW_ID = 'p-new';
const created = {
  ...patient,
  id: NEW_ID,
  firstName: 'Claire',
  lastName: 'Martin',
  sex: null,
  dateOfBirth: null,
  email: null,
  phone: null,
  address: null,
  city: null,
  zipCode: null,
  familySituation: null,
  profession: null,
  gpName: null,
  consultationReason: null,
  referralSource: null,
};

function Where() {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{pathname + search}</p>;
}

function renderWizard(entry = '/patients/new') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/patients/new" element={<PatientNewPage />} />
          <Route path="*" element={<OtherPage />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
function OtherPage() {
  return <p>Page : {useLocation().pathname}</p>;
}

const type = (label: RegExp | string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const heading = (name: string) => screen.findByRole('heading', { name });

async function createClaire() {
  type(/^Prénom/, ' Claire ');
  type(/^Nom/, 'Martin');
  click('Créer le dossier');
  await heading('Le joindre');
}

describe('PatientNewPage (new patient wizard)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockImplementation(
      apiGet({
        ...ROUTES,
        [`/patients/${NEW_ID}`]: created,
        [`/patients/${NEW_ID}/file`]: [],
        [`/patients/${NEW_ID}/measurements`]: [],
      }) as never,
    );
    post.mockImplementation((async (url: string) => {
      if (url === '/patients') return { data: created };
      if (url.endsWith('/consultations')) return { data: { id: 'c-new' } };
      return { data: { id: 'm-new' } };
    }) as never);
    patch.mockResolvedValue({ data: {} });
    put.mockResolvedValue({ data: {} });
  });

  it('asks for the first and last name only, then creates the patient at the end of step 1', async () => {
    renderWizard();
    expect(screen.getAllByText('obligatoire')).toHaveLength(2);
    expect(screen.getAllByText(/Pour calculer le MB/).length).toBeGreaterThanOrEqual(2);

    click('Créer le dossier');
    expect(screen.getByText('Indiquez le prénom.')).toBeInTheDocument();
    expect(screen.getByText('Indiquez le nom.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    await createClaire();
    expect(post).toHaveBeenCalledWith('/patients', {
      firstName: 'Claire',
      lastName: 'Martin',
      sex: null,
      dateOfBirth: null,
    });
    // The address keeps the patient: a reload resumes on this step
    expect(screen.getByTestId('where')).toHaveTextContent(`/patients/new?patient=${NEW_ID}&step=1`);
    expect(screen.getByText(/Le dossier de Claire Martin est créé/)).toBeInTheDocument();
  });

  it('sends the sex and the declared age when the birth date is unknown', async () => {
    renderWizard();
    type(/^Prénom/, 'Claire');
    type(/^Nom/, 'Martin');
    click('Femme');
    expect(screen.getByRole('button', { name: 'Femme' })).toHaveAttribute('aria-pressed', 'true');
    click('Je ne connais que son âge');
    type(/^Âge/, '56');
    click('Créer le dossier');
    await heading('Le joindre');
    expect(post).toHaveBeenCalledWith('/patients', { firstName: 'Claire', lastName: 'Martin', sex: 'F', age: 56 });
  });

  it('lets every other step be skipped, without saving anything, and ends on the file', async () => {
    renderWizard();
    await createClaire();
    type('Téléphone', '06 11 22 33 44');
    click('Passer cette étape');
    await heading('Sa situation');
    click('Passer cette étape');
    await heading('Dossier médical');
    click('Passer cette étape');
    await heading('C’est prêt');

    expect(patch).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect(screen.getByText('Le dossier de Claire Martin est prêt.')).toBeInTheDocument();
    expect(screen.getByText(/Il manque le sexe, l’âge et la taille pour calculer le MB/)).toBeInTheDocument();
    // A skipped step forgets what was typed
    expect(screen.queryByText('06 11 22 33 44')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Ouvrir le dossier' }));
    expect(await screen.findByText(`Page : /patients/${NEW_ID}`)).toBeInTheDocument();
  });

  it('saves each step when moving on, keeps it when going back, and can start the bilan', async () => {
    renderWizard();
    await createClaire();

    type('Téléphone', '06 11 22 33 44');
    type('E-mail', 'claire@');
    click('Enregistrer et continuer');
    expect(await screen.findByText('L’adresse e-mail n’est pas valide.')).toBeInTheDocument();
    expect(patch).not.toHaveBeenCalled();
    type('E-mail', 'claire@example.com');
    click('Enregistrer et continuer');
    await heading('Sa situation');
    expect(patch).toHaveBeenCalledWith(`/patients/${NEW_ID}`, {
      phone: '06 11 22 33 44',
      email: 'claire@example.com',
    });

    type('Profession', 'Infirmière');
    click('Retour');
    await heading('Le joindre');
    expect(screen.getByLabelText('Téléphone')).toHaveValue('06 11 22 33 44');
    // Going back saved the step left, and nothing changed here: no new write
    expect(patch).toHaveBeenLastCalledWith(`/patients/${NEW_ID}`, { profession: 'Infirmière' });
    patch.mockClear();
    click('Enregistrer et continuer');
    await heading('Sa situation');
    expect(patch).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Profession')).toHaveValue('Infirmière');
    click('Enregistrer et continuer');

    await heading('Dossier médical');
    type('Taille (cm)', '1,59');
    click('Enregistrer et continuer');
    expect(await screen.findByText(/Indiquez la taille en centimètres/)).toBeInTheDocument();
    type('Taille (cm)', '159');
    type('Allergies', 'Arachide');
    type('Motif de consultation', 'Perte de poids');
    click('Enregistrer et continuer');

    await heading('C’est prêt');
    expect(post).toHaveBeenCalledWith(`/patients/${NEW_ID}/measurements`, { type: 'HEIGHT', value: 159 });
    expect(put).toHaveBeenCalledWith(`/patients/${NEW_ID}/file/ALLERGIES`, { content: 'Arachide' });
    expect(put).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith(`/patients/${NEW_ID}`, { consultationReason: 'Perte de poids' });
    expect(screen.getByText('claire@example.com')).toBeInTheDocument();
    expect(screen.getByText('159 cm')).toBeInTheDocument();
    expect(screen.getByText('Arachide')).toBeInTheDocument();

    click('Démarrer le bilan');
    await waitFor(() => expect(post).toHaveBeenCalledWith(`/patients/${NEW_ID}/consultations`, {}));
    expect(await screen.findByText('Page : /consultations/c-new')).toBeInTheDocument();
  });

  it('goes back to step 1 to correct the name without creating the patient twice', async () => {
    renderWizard();
    await createClaire();
    click('Retour');
    await heading('Qui est-ce ?');
    type(/^Prénom/, 'Clara');
    click('Enregistrer et continuer');
    await heading('Le joindre');
    expect(post).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith(`/patients/${NEW_ID}`, {
      firstName: 'Clara',
      lastName: 'Martin',
      sex: null,
      dateOfBirth: null,
    });
  });

  it('resumes a patient created earlier from the address', async () => {
    renderWizard(`/patients/new?patient=${PATIENT_ID}&step=1`);
    await heading('Le joindre');
    expect(screen.getByLabelText('Téléphone')).toHaveValue(patient.phone);
    click('Passer cette étape');
    await heading('Sa situation');
    expect(screen.getByLabelText('Médecin traitant')).toHaveValue(patient.gpName);
  });
});
