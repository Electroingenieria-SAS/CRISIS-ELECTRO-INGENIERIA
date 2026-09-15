export type GameLogChannel = 'physics' | 'animation' | 'interaction' | 'rendering' | 'audio' | 'lifecycle';

/**
 * Small debug logger that stays silent in production unless explicitly enabled.
 * Enable all channels with ?debug=1 or selected channels with ?debug=physics,animation.
 */
export class GameLogger {
  private static enabled = false;
  private static channels = new Set<GameLogChannel>();

  static configureFromLocation(search = typeof location !== 'undefined' ? location.search : ''): void {
    const value = new URLSearchParams(search).get('debug');
    if (!value) return;
    this.enabled = true;
    if (value === '1' || value === 'true' || value === 'all') return;
    for (const token of value.split(',')) {
      const channel = token.trim() as GameLogChannel;
      if (['physics', 'animation', 'interaction', 'rendering', 'audio', 'lifecycle'].includes(channel)) this.channels.add(channel);
    }
  }

  static setEnabled(enabled: boolean, channels: GameLogChannel[] = []): void {
    this.enabled = enabled;
    this.channels = new Set(channels);
  }

  static physics(...args: unknown[]): void { this.write('physics', ...args); }
  static animation(...args: unknown[]): void { this.write('animation', ...args); }
  static interaction(...args: unknown[]): void { this.write('interaction', ...args); }
  static rendering(...args: unknown[]): void { this.write('rendering', ...args); }
  static audio(...args: unknown[]): void { this.write('audio', ...args); }
  static lifecycle(...args: unknown[]): void { this.write('lifecycle', ...args); }

  private static write(channel: GameLogChannel, ...args: unknown[]): void {
    if (!this.enabled) return;
    if (this.channels.size > 0 && !this.channels.has(channel)) return;
    console.debug(`[V9:${channel}]`, ...args);
  }
}
