import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import AppointmentsPage from './AppointmentsPage';

vi.mock('../../lib/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: { data: [] } }) },
}));

function renderAgenda(url: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]}>
        <AppointmentsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AppointmentsPage week view', () => {
  it('shows the whole week, weekend included, even when nothing is booked', () => {
    // Wednesday 25 November 2026: the week runs from Monday 23 to Sunday 29
    renderAgenda('/appointments?view=week&date=2026-11-25');
    expect(screen.getByText('23 nov.')).toBeInTheDocument();
    expect(screen.getByText('28 nov.')).toBeInTheDocument();
    expect(screen.getByText('29 nov.')).toBeInTheDocument();
  });

  it('books an appointment on the Sunday slot that was clicked', () => {
    renderAgenda('/appointments?view=week&date=2026-11-25');
    fireEvent.click(screen.getByTitle('Nouveau rendez-vous le 29 nov. à 10:00'));
    expect(screen.getByDisplayValue('2026-11-29T10:00')).toBeInTheDocument();
  });
});
