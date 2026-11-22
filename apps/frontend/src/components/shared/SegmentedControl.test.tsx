import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Pagination } from './Pagination';
import { SegmentedControl } from './SegmentedControl';

const VIEWS = [
  { value: 'week', label: 'Semaine' },
  { value: 'day', label: 'Jour' },
] as const;

describe('SegmentedControl', () => {
  it('shows every option and marks the chosen one', () => {
    render(<SegmentedControl label="Affichage" options={VIEWS} value="day" onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'Affichage' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jour' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Semaine' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with the option touched', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Affichage" options={VIEWS} value="day" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Semaine' }));
    expect(onChange).toHaveBeenCalledWith('week');
  });
});

describe('Pagination', () => {
  it('renders nothing on a single page', () => {
    const { container } = render(<Pagination page={1} totalPages={1} onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('moves between pages and disables what is not possible', async () => {
    const onChange = vi.fn();
    render(<Pagination page={1} totalPages={3} onChange={onChange} />);
    expect(screen.getByText('Page 1 sur 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Précédent' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
