import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SaveIndicator } from './SaveIndicator';

describe('SaveIndicator', () => {
  it('says nothing before the first change', () => {
    const { container } = render(<SaveIndicator state={{ status: 'idle', savedAt: null }} />);
    expect(container.textContent).toBe('');
  });

  it('shows when the text was saved', () => {
    render(<SaveIndicator state={{ status: 'saved', savedAt: new Date(2026, 2, 12, 14, 32) }} />);
    expect(screen.getByText(/Enregistré à 14 h 32/)).toBeInTheDocument();
  });

  it('shows that a save is running, then a failure', () => {
    const { rerender } = render(<SaveIndicator state={{ status: 'saving', savedAt: null }} />);
    expect(screen.getByText(/Enregistrement…/)).toBeInTheDocument();
    rerender(<SaveIndicator state={{ status: 'error', savedAt: null }} />);
    expect(screen.getByText(/Non enregistré/)).toBeInTheDocument();
  });
});
