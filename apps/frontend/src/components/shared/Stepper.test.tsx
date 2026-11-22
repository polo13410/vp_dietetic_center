import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Stepper } from './Stepper';

const steps = [{ label: 'Identité' }, { label: 'Dossier médical' }, { label: 'Premier rendez-vous' }];

describe('Stepper', () => {
  it('renders every step and marks the current one', () => {
    render(<Stepper steps={steps} current={1} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Dossier médical').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByText('Étape 1 sur 3, terminée')).toBeInTheDocument();
    expect(screen.getByText('Étape 3 sur 3, à venir')).toBeInTheDocument();
  });

  it('is not clickable without onStepClick', () => {
    render(<Stepper steps={steps} current={2} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('lets the user go back to a finished step only', async () => {
    const onStepClick = vi.fn();
    render(<Stepper steps={steps} current={1} onStepClick={onStepClick} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    await userEvent.setup().click(buttons[0]);
    expect(onStepClick).toHaveBeenCalledWith(0);
  });
});
