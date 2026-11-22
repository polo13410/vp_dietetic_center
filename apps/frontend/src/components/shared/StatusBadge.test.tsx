import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders appointment status', () => {
    render(<StatusBadge status="SCHEDULED" />);
    expect(screen.getByText('Planifie')).toBeInTheDocument();
  });

  it('renders document types in French', () => {
    render(<StatusBadge status="PRESCRIPTION" />);
    expect(screen.getByText('Ordonnance')).toBeInTheDocument();
  });

  it('renders task status', () => {
    render(<StatusBadge status="PENDING" />);
    expect(screen.getByText('En attente')).toBeInTheDocument();
  });

  it('falls back to raw status for unknown values', () => {
    render(<StatusBadge status="UNKNOWN_STATUS" />);
    expect(screen.getByText('UNKNOWN_STATUS')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<StatusBadge status="SCHEDULED" className="my-class" />);
    expect(container.firstChild).toHaveClass('my-class');
  });
});
