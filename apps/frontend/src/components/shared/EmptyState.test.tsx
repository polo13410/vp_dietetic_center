import { render, screen } from '@testing-library/react';
import { UserX } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders the sentence, description and action', () => {
    render(
      <EmptyState
        title="Aucune séance pour l’instant"
        description="Le bilan ouvre le suivi."
        action={<button>Démarrer le bilan</button>}
      />,
    );
    expect(screen.getByText('Aucune séance pour l’instant')).toBeInTheDocument();
    expect(screen.getByText('Le bilan ouvre le suivi.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Démarrer le bilan' })).toBeInTheDocument();
  });

  it('shows the pear mascot as illustration', () => {
    render(<EmptyState title="Rien ici" illustration="pear" />);
    expect(screen.getByTestId('pear-mascot')).toBeInTheDocument();
  });

  it('shows a coloured icon otherwise', () => {
    const { container } = render(<EmptyState title="Aucun compte" icon={UserX} area="users" />);
    expect(screen.queryByTestId('pear-mascot')).not.toBeInTheDocument();
    expect(container.querySelector('svg')?.parentElement).toHaveClass('text-area-users');
  });
});
