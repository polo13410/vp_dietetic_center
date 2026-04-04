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
    expect(screen.getByText('Planifie')).toBeInTheDocument();
  });

  it('renders note status', () => {
    render(<StatusBadge status="FINALIZED" />);
    expect(screen.getByText('Finalise')).toBeInTheDocument();
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
    const { container } = render(<StatusBadge status="ACTIVE" className="my-class" />);
    expect(container.firstChild).toHaveClass('my-class');
  });
});
