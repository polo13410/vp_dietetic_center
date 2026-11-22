import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PearMascot } from './PearMascot';

describe('PearMascot', () => {
  it('is decorative by default', () => {
    render(<PearMascot />);
    expect(screen.getByTestId('pear-mascot')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('pear-mascot')).toHaveAttribute('alt', '');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('is announced when given a title', () => {
    render(<PearMascot title="Mascotte poire" />);
    expect(screen.getByRole('img', { name: 'Mascotte poire' })).toBeInTheDocument();
    expect(screen.getByRole('img')).not.toHaveAttribute('aria-hidden');
  });

  it('uses the official site logo with its intrinsic proportions', () => {
    render(<PearMascot />);
    const mascot = screen.getByTestId('pear-mascot');
    expect(mascot.tagName).toBe('IMG');
    expect(mascot).toHaveAttribute('src', '/logo_small.png');
    expect(mascot).toHaveAttribute('width', '530');
    expect(mascot).toHaveAttribute('height', '581');
    expect(mascot).toHaveClass('h-28', 'w-auto');
  });

  it('lets callers override the size', () => {
    render(<PearMascot className="h-24" />);
    expect(screen.getByTestId('pear-mascot')).toHaveClass('h-24', 'w-auto');
    expect(screen.getByTestId('pear-mascot')).not.toHaveClass('h-28');
  });
});
