/**
 * How the séance screen and the patient's file pass the hand to each other, through the
 * router's location state (nothing in the address, so a reload or a shared link never replays it).
 */

/** Set by `useStartSession` when a séance has just been started: show « Avant de commencer » first. */
export interface SessionRouteState {
  startedSession?: string;
}

/** Set by « Terminer la séance »: the patient's file offers the invoice and the next appointment. */
export interface PatientRouteState {
  endedSession?: string;
}

/** The séance was just started (time 1), not reopened from the follow-up or the agenda. */
export function isJustStarted(state: unknown, sessionId: string): boolean {
  return (state as SessionRouteState | null)?.startedSession === sessionId;
}

export function endedSession(state: unknown): string | null {
  return (state as PatientRouteState | null)?.endedSession ?? null;
}

// ─── Remembered choices (this device only) ────────────────────────────────────

const PANEL_KEY = 'seance.rappel.ouvert';
const HINT_KEY = 'seance.rappel.bulle-vue';

/** localStorage can be unavailable (private browsing, quota): the screen works without it. */
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not remembered, that's all
  }
}

/** Whether she left the « Rappel » open last time (open the first time). */
export const panelRemembered = (): boolean => read(PANEL_KEY) !== 'false';
export const rememberPanel = (open: boolean) => write(PANEL_KEY, String(open));

/** The bubble explaining the handle is shown once. */
export const hintSeen = (): boolean => read(HINT_KEY) === 'true';
export const rememberHintSeen = () => write(HINT_KEY, 'true');
