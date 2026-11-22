import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders known status label', () => {
    render(<StatusBadge status="ACTIVE" />);
    expect(screen.getByText('Actif')).toBeInTheDocument();
  });

  it('renders appointment status', () => {
    render(<StatusBadge status="SCHEDULED" />);
    expect(screen.getByText('Planifié')).toBeInTheDocument();
  });

  it('renders session status', () => {
    render(<StatusBadge status="FINALIZED" />);
    expect(screen.getByText('Finalisée')).toBeInTheDocument();
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

  it('uses semantic tone classes instead of hard-coded colours', () => {
    render(<StatusBadge status="CANCELLED" />);
    const badge = screen.getByText('Annulé');
    expect(badge).toHaveAttribute('data-tone', 'danger');
    expect(badge).toHaveClass('bg-danger-soft', 'text-danger');
    expect(badge.className).not.toMatch(/-(red|blue|emerald|amber)-\d/);
  });

  it('falls back to the neutral tone and accepts overrides', () => {
    const { rerender } = render(<StatusBadge status="SOMETHING" />);
    expect(screen.getByText('SOMETHING')).toHaveAttribute('data-tone', 'neutral');
    rerender(<StatusBadge status="SOMETHING" label="Autre chose" tone="warning" />);
    expect(screen.getByText('Autre chose')).toHaveAttribute('data-tone', 'warning');
  });

  it('applies custom className', () => {
    const { container } = render(<StatusBadge status="ACTIVE" className="my-class" />);
    expect(container.firstChild).toHaveClass('my-class');
  });
});
