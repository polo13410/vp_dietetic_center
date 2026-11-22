import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useGrowingTextarea } from './useGrowingTextarea';

function Note({ value }: { value: string }) {
  const ref = useGrowingTextarea(value);
  return <textarea ref={ref} aria-label="Note" value={value} readOnly />;
}

/** jsdom does no layout: the text's height and the area's width are given by the test. */
function layout(el: HTMLElement, { height, width }: { height: number; width: number }) {
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: height });
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: width });
}

describe('useGrowingTextarea', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('grows with the text', () => {
    const { rerender } = render(<Note value="" />);
    const note = screen.getByRole('textbox', { name: 'Note' });
    layout(note, { height: 300, width: 400 });
    rerender(<Note value={'Une ligne\nPuis une autre\nEt une troisième'} />);
    expect(note.style.height).toBe('302px');
  });

  it('measures again when its width changes, not when only its height does', () => {
    let notify = () => {};
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notify = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    render(<Note value="Petit-déjeuner tous les matins" />);
    const note = screen.getByRole('textbox', { name: 'Note' });

    // Squeezed while the « Rappel » slid beside it, then given its width back
    layout(note, { height: 600, width: 40 });
    act(() => notify());
    expect(note.style.height).toBe('602px');
    layout(note, { height: 60, width: 500 });
    act(() => notify());
    expect(note.style.height).toBe('62px');

    layout(note, { height: 900, width: 500 });
    act(() => notify());
    expect(note.style.height).toBe('62px');
  });
});
