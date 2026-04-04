import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders title and description when open', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Delete item?"
        description="This cannot be undone."
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText('Delete item?')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        onOpenChange={vi.fn()}
        title="Delete item?"
        description="This cannot be undone."
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.queryByText('Delete item?')).not.toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Delete?"
        description="Sure?"
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByText('Confirmer'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onOpenChange(false) when cancel is clicked', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        title="Delete?"
        description="Sure?"
        onConfirm={vi.fn()}
      />,
    );

    await user.click(screen.getByText('Annuler'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows loading state', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Delete?"
        description="Sure?"
        onConfirm={vi.fn()}
        loading={true}
      />,
    );

    expect(screen.getByText('Chargement...')).toBeInTheDocument();
  });

  it('uses custom labels', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Delete?"
        description="Sure?"
        onConfirm={vi.fn()}
        confirmLabel="Supprimer"
        cancelLabel="Non"
      />,
    );

    expect(screen.getByText('Supprimer')).toBeInTheDocument();
    expect(screen.getByText('Non')).toBeInTheDocument();
  });
});
