import { render, screen } from '@testing-library/react';
import { Users } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { Section } from './Section';

describe('Section', () => {
  it('renders title, description, action and content', () => {
    render(
      <Section title="Comptes" description="Qui peut se connecter" action={<button>Ajouter</button>}>
        <p>Contenu</p>
      </Section>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Comptes' })).toBeInTheDocument();
    expect(screen.getByText('Qui peut se connecter')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeInTheDocument();
    expect(screen.getByText('Contenu')).toBeInTheDocument();
  });

  it('colours the icon chip with the area colour', () => {
    const { container } = render(<Section title="Patients" icon={Users} area="patients" />);
    const chip = container.querySelector('svg')?.parentElement;
    expect(chip).toHaveClass('bg-area-patients-soft', 'text-area-patients');
  });

  it('uses the primary colours without an area', () => {
    const { container } = render(<Section title="Notes" icon={Users} />);
    expect(container.querySelector('svg')?.parentElement).toHaveClass('text-primary');
  });

  it('drops the body padding when flush', () => {
    render(
      <Section title="Tableau" flush>
        <div data-testid="body" />
      </Section>,
    );
    expect(screen.getByTestId('body').parentElement).not.toHaveClass('px-5');
  });
});
