import { useEffect, useLayoutEffect, useRef } from 'react';

function fit(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + 2}px`;
}

/**
 * A text area that grows with its content (no inner scroll bar while she writes). It is measured
 * again when its width changes (a panel opening beside it, the iPad turning), since the same text
 * then takes more or fewer lines.
 */
export function useGrowingTextarea(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    if (ref.current) fit(ref.current);
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      // Its own height changes too (that is the point): only a new width needs a new measure
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit(el);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}
