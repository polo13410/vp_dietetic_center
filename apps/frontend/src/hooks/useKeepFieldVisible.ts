import { type KeyboardEvent, useEffect, useRef, useState } from 'react';

const MARGIN = 24;
/** Time for the iPad keyboard to slide up before measuring what it hides */
const KEYBOARD_DELAY = 350;

/**
 * How far to scroll so a field is visible between `top` and `bottom` (the part of the screen the
 * keyboard leaves free): 0 when it already is, else enough to bring it to the middle of that area.
 */
export function revealOffset(field: { top: number; bottom: number }, top: number, bottom: number): number {
  if (field.top >= top + MARGIN && field.bottom <= bottom - MARGIN) return 0;
  const middle = (field.top + field.bottom) / 2;
  const offset = middle - (top + bottom) / 2;
  // A field taller than the free area: show its top
  return field.bottom - field.top > bottom - top - 2 * MARGIN ? field.top - top - MARGIN : offset;
}

function scrollParent(el: HTMLElement): HTMLElement {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

/**
 * Keeps the field being typed in visible above the iPad's virtual keyboard (docs/DESIGN.md § 5).
 * The app scrolls inside `<main>`, which the keyboard covers without resizing: this scrolls it
 * when a field is focused, when the keyboard opens and while a text area grows. `keyboardInset`
 * is the height hidden by the keyboard, to add below the content so the last field can rise.
 */
export function useKeepFieldVisible<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const viewport = window.visualViewport;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const reveal = () => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement) || !root.contains(el) || !el.matches('input, textarea, select')) return;
      const top = viewport?.offsetTop ?? 0;
      const bottom = top + (viewport?.height ?? window.innerHeight);
      const rect = el.getBoundingClientRect();
      if (rect.height === 0) return; // not laid out (hidden)
      const offset = revealOffset(rect, top, bottom);
      if (offset === 0) return;
      const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      scrollParent(el).scrollBy?.({ top: offset, behavior: smooth ? 'smooth' : 'auto' });
    };
    const onFocus = () => {
      clearTimeout(timer);
      timer = setTimeout(reveal, KEYBOARD_DELAY);
    };
    const onInput = () => requestAnimationFrame(reveal);
    const onResize = () => {
      if (!viewport) return;
      // Zooming also shrinks the visual viewport: only count the keyboard at normal scale
      const hidden = viewport.scale > 1.01 ? 0 : window.innerHeight - viewport.height - viewport.offsetTop;
      setKeyboardInset(Math.max(0, Math.round(hidden)));
      reveal();
    };

    root.addEventListener('focusin', onFocus);
    root.addEventListener('input', onInput);
    viewport?.addEventListener('resize', onResize);
    return () => {
      clearTimeout(timer);
      root.removeEventListener('focusin', onFocus);
      root.removeEventListener('input', onInput);
      viewport?.removeEventListener('resize', onResize);
    };
  }, []);

  return { ref, keyboardInset };
}

/**
 * On a form: the keyboard's « Suivant » / Enter key goes to the next field, like on paper, and
 * only submits from the last one. Text areas keep Enter for new lines.
 */
export function focusNextOnEnter(event: KeyboardEvent<HTMLFormElement>) {
  const target = event.target;
  if (event.key !== 'Enter' || !(target instanceof HTMLInputElement) || event.nativeEvent.isComposing) return;
  const fields = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('input:not([type=hidden]):not(:disabled), textarea:not(:disabled)'),
  );
  const next = fields[fields.indexOf(target) + 1];
  if (!next) return;
  event.preventDefault();
  next.focus();
}
