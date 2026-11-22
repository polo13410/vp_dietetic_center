import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders the title as the page heading, with subtitle and actions', () => {
    render(
      <PageHeader
        title="Utilisateurs"
        subtitle="3 comptes"
        actions={<button>Nouveau compte</button>}
      />,
      { wrapper: MemoryRouter },
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Utilisateurs' })).toBeInTheDocument();
    expect(screen.getByText('3 comptes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nouveau compte' })).toBeInTheDocument();
  });

  it('renders a back link to the given page', () => {
    render(<PageHeader title="Marie Dupont" back={{ to: '/patients', label: 'Patients' }} />, {
      wrapper: MemoryRouter,
    });
    expect(screen.getByRole('link', { name: 'Patients' })).toHaveAttribute('href', '/patients');
  });

  it('colours the icon with the area colour', () => {
    const { container } = render(<PageHeader title="Patients" area="patients" />, {
      wrapper: MemoryRouter,
    });
    expect(container.querySelector('.text-area-patients')).toBeInTheDocument();
  });

  it('shows no icon without an area', () => {
    const { container } = render(<PageHeader title="Sans espace" />, { wrapper: MemoryRouter });
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });
});
