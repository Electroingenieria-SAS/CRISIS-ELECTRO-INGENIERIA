export type CombatCue = 'attack-impact';

const EVENT_NAME = 'v9-combat-cue';

export function emitCombatCue(cue: CombatCue): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<CombatCue>(EVENT_NAME, { detail: cue }));
}

export function subscribeCombatCues(listener: (cue: CombatCue) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (event: Event) => listener((event as CustomEvent<CombatCue>).detail);
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
