import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AppLayout } from './AppLayout';

vi.mock('./Header', () => ({ Header: () => <header /> }));
vi.mock('./Sidebar', () => ({ Sidebar: () => <nav /> }));
vi.mock('../../hooks/useMe', () => ({ useThemeFromAccount: () => undefined }));

describe('AppLayout', () => {
  it('scrolls the content only, and contains absolutely positioned content such as sr-only inputs', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/settings" element={<input type="radio" className="sr-only" aria-label="Clair" />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const main = screen.getByRole('main');
    expect(main).toHaveClass('overflow-y-auto', 'relative');
    // The frame never scrolls; without `relative` here and on `main`, an sr-only input at the
    // bottom of a long page stretches the document and the whole page scrolls (Settings, lot 12).
    expect(main.closest('.h-dvh')).toHaveClass('overflow-hidden', 'relative');
    expect(main).toContainElement(screen.getByLabelText('Clair'));
  });
});
