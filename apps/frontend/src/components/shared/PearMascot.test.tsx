import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PearMascot } from './PearMascot';

describe('PearMascot', () => {
  it('is decorative by default', () => {
    render(<PearMascot />);
    expect(screen.getByTestId('pear-mascot')).toHaveAttribute('aria-hidden', 'true');
  });

  it('is announced when given a title', () => {
    render(<PearMascot title="Mascotte poire" />);
    expect(screen.getByRole('img', { name: 'Mascotte poire' })).toBeInTheDocument();
  });

  it('closes its eyes when calm', () => {
    const { container } = render(<PearMascot mood="calm" />);
    // happy: two cheeks and two eyes; calm keeps only the cheeks
    expect(container.querySelectorAll('circle')).toHaveLength(2);
  });
});
