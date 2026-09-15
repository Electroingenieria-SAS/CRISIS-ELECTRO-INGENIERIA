export type GameAudioCue =
  | 'footstep'
  | 'pickup'
  | 'place'
  | 'throw'
  | 'hit-wood'
  | 'hit-metal'
  | 'hit-stone'
  | 'hit-generic'
  | 'break'
  | 'door-open'
  | 'door-close'
  | 'chest-open'
  | 'lever';

const EVENT_NAME = 'v9-game-audio';

export function emitAudioCue(cue: GameAudioCue): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<GameAudioCue>(EVENT_NAME, { detail: cue }));
}

export function subscribeAudioCues(listener: (cue: GameAudioCue) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (event: Event) => listener((event as CustomEvent<GameAudioCue>).detail);
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
