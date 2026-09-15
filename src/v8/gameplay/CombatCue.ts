export type CombatCue = 'attack-impact';

type CombatCueListener = (cue: CombatCue) => void;

// The game owns one active World runtime. A single replaceable sink avoids the
// global window-listener accumulation that V8 could suffer after remounts.
let activeListener: CombatCueListener | null = null;

export function emitCombatCue(cue: CombatCue): void {
  activeListener?.(cue);
}

export function subscribeCombatCues(listener: CombatCueListener): () => void {
  activeListener = listener;
  return () => {
    if (activeListener === listener) activeListener = null;
  };
}
