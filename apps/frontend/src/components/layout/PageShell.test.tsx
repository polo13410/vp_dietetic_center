import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { getPageWidth, PageShell } from './PageShell';

describe('PageShell', () => {
  it('centres the page at the default width', () => {
    render(<PageShell>contenu</PageShell>);
    const shell = screen.getByText('contenu');
    expect(shell).toHaveClass('mx-auto', 'max-w-5xl');
    expect(shell).toHaveAttribute('data-width', 'default');
  });

  it('has a wide variant', () => {
    render(<PageShell width="wide">contenu</PageShell>);
    expect(screen.getByText('contenu')).toHaveClass('max-w-screen-2xl');
  });
});

describe('getPageWidth', () => {
  it('gives the agenda and the session the wide width', () => {
    expect(getPageWidth('/appointments')).toBe('wide');
    expect(getPageWidth('/consultations/abc')).toBe('wide');
  });

  it('gives every other page the default width', () => {
    expect(getPageWidth('/appointments/abc')).toBe('default');
    expect(getPageWidth('/patients/abc')).toBe('default');
    expect(getPageWidth('/admin/users')).toBe('default');
  });
});
