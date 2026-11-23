import { useEffect } from 'react';
import { useLocation } from 'react-router';

/** Briefly outlines the block a link led to, so the eye finds it. */
const HIGHLIGHT = ['ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background'];
/** Space left above the block, in px */
const OFFSET = 16;

/** The nearest ancestor that scrolls (the page's content area), if any. */
function scrollParent(element: HTMLElement): HTMLElement | null {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent);
    if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) return parent;
  }
  return null;
}

/**
 * Scrolls the content area to the block named by the address' hash (« #poids »), on load and on each
 * navigation, even when it appears only once its data has loaded (it is looked for during about two
 * seconds). Only the content area scrolls, never the whole window.
 */
export function useScrollToHash() {
  const { hash, key } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const id = decodeURIComponent(hash.slice(1));
    let frame = 0;
    let tries = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const attempt = () => {
      const element = document.getElementById(id);
      if (!element) {
        if (tries++ < 120) frame = requestAnimationFrame(attempt);
        return;
      }
      const scroll = () => {
        const parent = scrollParent(element);
        if (!parent) return element.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
        const top = element.getBoundingClientRect().top - parent.getBoundingClientRect().top + parent.scrollTop - OFFSET;
        parent.scrollTo?.({ top, behavior: 'smooth' });
        // On a reload the browser's own jump to the hash may also move the window, which the
        // layout never scrolls (the header would slide away)
        if (window.scrollY !== 0) window.scrollTo?.(0, 0);
      };
      scroll();
      // Blocks above may still grow (a chart, a list): scroll again once they have
      timers.push(setTimeout(scroll, 400));
      element.classList.add(...HIGHLIGHT);
      timers.push(setTimeout(() => element.classList.remove(...HIGHLIGHT), 1800));
    };
    attempt();

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
      document.getElementById(id)?.classList.remove(...HIGHLIGHT);
    };
  }, [hash, key]);
}
