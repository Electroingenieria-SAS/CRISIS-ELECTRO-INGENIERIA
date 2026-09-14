import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { GameMasterCommand, GameStats, PlayerProfile } from './types';

type SessionRow = {
  id: string;
  team_name: string;
  player_name: string;
  callsign: string;
  character_class: string;
  score: number;
  remaining_seconds: number;
  errors: number;
  health: number;
  stage: string;
  objective: string;
  status: string;
  updated_at: string;
};

export class SupabaseBridge {
  private client: SupabaseClient | null = null;
  private sessionId: string | null = null;
  private commandChannel: RealtimeChannel | null = null;
  private lastSync = 0;
  readonly enabled: boolean;

  constructor() {
    const url = import.meta.env.VITE_SUPABASE_URL?.trim();
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
    this.enabled = Boolean(url && key);
    if (this.enabled) {
      this.client = createClient(url!, key!, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
    }
  }

  async registerTeam(profile: PlayerProfile, stats: GameStats): Promise<void> {
    if (!this.client) return;
    const { data: current } = await this.client.auth.getSession();
    if (!current.session) {
      const { error } = await this.client.auth.signInAnonymously();
      if (error) throw error;
    }
    const { data: userData, error: userError } = await this.client.auth.getUser();
    if (userError || !userData.user) throw userError ?? new Error('No se pudo crear la sesión anónima.');

    const { data, error } = await this.client
      .from('game_sessions')
      .insert({
        owner_user_id: userData.user.id,
        team_name: profile.teamName,
        player_name: profile.playerName,
        callsign: profile.callsign,
        character_class: profile.characterClass,
        accent: profile.accent,
        score: stats.score,
        remaining_seconds: Math.floor(stats.remainingSeconds),
        errors: stats.errors,
        health: stats.health,
        stage: stats.stage,
        objective: stats.objective,
        status: 'playing',
        progress: this.serializeProgress(stats)
      })
      .select('id')
      .single();
    if (error) throw error;
    this.sessionId = data.id as string;
  }

  subscribeCommands(handler: (command: GameMasterCommand) => void): void {
    if (!this.client || !this.sessionId) return;
    this.commandChannel?.unsubscribe();
    this.commandChannel = this.client
      .channel(`gm-commands-${this.sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'gm_commands',
        filter: `session_id=eq.${this.sessionId}`
      }, (payload) => {
        const row = payload.new as { id: number; command: GameMasterCommand['command']; payload: Record<string, unknown> };
        handler({ id: row.id, command: row.command, payload: row.payload ?? {} });
      })
      .subscribe();
  }

  async sync(stats: GameStats, force = false): Promise<void> {
    if (!this.client || !this.sessionId) return;
    const now = performance.now();
    if (!force && now - this.lastSync < 2500) return;
    this.lastSync = now;
    const { error } = await this.client
      .from('game_sessions')
      .update({
        score: stats.score,
        remaining_seconds: Math.floor(stats.remainingSeconds),
        errors: stats.errors,
        health: stats.health,
        stage: stats.stage,
        objective: stats.objective,
        status: stats.sessionStatus,
        progress: this.serializeProgress(stats),
        updated_at: new Date().toISOString()
      })
      .eq('id', this.sessionId);
    if (error) console.warn('Supabase sync:', error.message);
  }

  async log(eventType: string, payload: Record<string, unknown> = {}): Promise<void> {
    if (!this.client || !this.sessionId) return;
    const { data } = await this.client.auth.getUser();
    if (!data.user) return;
    const { error } = await this.client.from('game_events').insert({
      session_id: this.sessionId,
      owner_user_id: data.user.id,
      event_type: eventType,
      payload
    });
    if (error) console.warn('Supabase event:', error.message);
  }

  async close(): Promise<void> {
    if (this.commandChannel) await this.commandChannel.unsubscribe();
  }

  getSessionId(): string | null { return this.sessionId; }
  getClient(): SupabaseClient | null { return this.client; }

  private serializeProgress(stats: GameStats): Record<string, unknown> {
    return {
      evidence: [...stats.evidence],
      keys: [...stats.keys],
      inventory: stats.inventory.map(({ id, kind }) => ({ id, kind })),
      defeatedErrors: stats.defeatedErrors,
      ishikawaTokens: [...stats.ishikawaTokens]
    };
  }
}

export class GameMasterApp {
  private bridge = new SupabaseBridge();
  private client: SupabaseClient | null;
  private channel: RealtimeChannel | null = null;
  private sessions = new Map<string, SessionRow>();

  constructor(private root: HTMLElement) {
    this.client = this.bridge.getClient();
  }

  async boot(): Promise<void> {
    document.body.classList.add('gm-mode');
    if (!this.client) {
      this.root.innerHTML = `<div class="gm-shell"><div class="gm-login"><span class="mission-tag">GAME MASTER</span><h1>SUPABASE NO CONFIGURADO</h1><p>Define <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> en Vercel para activar el centro de control.</p></div></div>`;
      return;
    }
    this.renderLogin();
  }

  private renderLogin(): void {
    this.root.innerHTML = `
      <div class="gm-shell">
        <form class="gm-login" id="gm-login-form">
          <span class="mission-tag">CENTRO DE CONTROL · ELECTROINGENIERÍA</span>
          <h1>GAME MASTER</h1>
          <p>Supervisa equipos, tiempo, avance y eventos en tiempo real.</p>
          <label>Correo<input id="gm-email" type="email" autocomplete="username" required></label>
          <label>Contraseña<input id="gm-password" type="password" autocomplete="current-password" required></label>
          <button class="primary-button" type="submit">ENTRAR AL CENTRO DE CONTROL</button>
          <div class="gm-login-error" id="gm-login-error"></div>
        </form>
      </div>`;

    this.root.querySelector<HTMLFormElement>('#gm-login-form')!.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = this.root.querySelector<HTMLInputElement>('#gm-email')!.value;
      const password = this.root.querySelector<HTMLInputElement>('#gm-password')!.value;
      const errorBox = this.root.querySelector<HTMLElement>('#gm-login-error')!;
      errorBox.textContent = '';
      const { data, error } = await this.client!.auth.signInWithPassword({ email, password });
      if (error) {
        errorBox.textContent = error.message;
        return;
      }
      if (data.user?.app_metadata?.role !== 'game_master') {
        await this.client!.auth.signOut();
        errorBox.textContent = 'La cuenta no tiene el rol game_master en app_metadata.';
        return;
      }
      await this.openDashboard();
    });
  }

  private async openDashboard(): Promise<void> {
    this.root.innerHTML = `
      <div class="gm-dashboard">
        <header class="gm-header">
          <div><span class="mission-tag">GAME MASTER · LIVE OPS</span><h1>CRISIS CONTROL ROOM</h1></div>
          <div class="gm-live"><span></span> SUPABASE REALTIME</div>
        </header>
        <div class="gm-summary" id="gm-summary"></div>
        <div class="gm-teams" id="gm-teams"></div>
      </div>`;
    await this.refreshSessions();
    this.renderSessions();
    this.channel = this.client!
      .channel('gm-live-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_sessions' }, (payload) => {
        const row = (payload.new ?? payload.old) as SessionRow;
        if (payload.eventType === 'DELETE') this.sessions.delete(row.id);
        else this.sessions.set(row.id, row);
        this.renderSessions();
      })
      .subscribe();
  }

  private async refreshSessions(): Promise<void> {
    const { data, error } = await this.client!
      .from('game_sessions')
      .select('id,team_name,player_name,callsign,character_class,score,remaining_seconds,errors,health,stage,objective,status,updated_at')
      .order('created_at', { ascending: false })
      .limit(60);
    if (error) throw error;
    this.sessions.clear();
    for (const row of data as SessionRow[]) this.sessions.set(row.id, row);
  }

  private renderSessions(): void {
    const list = [...this.sessions.values()];
    const playing = list.filter((s) => s.status === 'playing').length;
    const completed = list.filter((s) => s.status === 'completed').length;
    const avg = list.length ? Math.round(list.reduce((sum, s) => sum + s.score, 0) / list.length) : 0;
    this.root.querySelector<HTMLElement>('#gm-summary')!.innerHTML = `
      <div><span>EQUIPOS</span><strong>${list.length}</strong></div>
      <div><span>EN JUEGO</span><strong>${playing}</strong></div>
      <div><span>COMPLETADOS</span><strong>${completed}</strong></div>
      <div><span>PUNTAJE PROM.</span><strong>${avg}</strong></div>`;

    this.root.querySelector<HTMLElement>('#gm-teams')!.innerHTML = list.map((session) => {
      const min = Math.floor(Math.max(0, session.remaining_seconds) / 60).toString().padStart(2, '0');
      const sec = (Math.max(0, session.remaining_seconds) % 60).toString().padStart(2, '0');
      return `<article class="gm-team-card" data-session="${session.id}">
        <div class="gm-team-main">
          <span class="gm-status gm-status--${session.status}">${session.status}</span>
          <h2>${this.escape(session.team_name)}</h2>
          <p>${this.escape(session.player_name)} · ${this.escape(session.callsign)} · ${this.escape(session.character_class)}</p>
          <small>${this.escape(session.objective ?? '')}</small>
        </div>
        <div class="gm-team-metrics">
          <div><span>TIEMPO</span><strong>${min}:${sec}</strong></div>
          <div><span>PUNTOS</span><strong>${session.score}</strong></div>
          <div><span>ERRORES</span><strong>${session.errors}</strong></div>
          <div><span>VIDA</span><strong>${session.health}%</strong></div>
        </div>
        <div class="gm-actions">
          <button data-command="pause">PAUSAR</button>
          <button data-command="resume">REANUDAR</button>
          <button data-command="add_time" data-value="60">+1 MIN</button>
          <button data-command="remove_time" data-value="60">−1 MIN</button>
          <button data-command="message">MENSAJE</button>
        </div>
      </article>`;
    }).join('') || '<div class="gm-empty">Aún no hay equipos conectados.</div>';

    this.root.querySelectorAll<HTMLButtonElement>('[data-command]').forEach((button) => {
      button.addEventListener('click', async () => {
        const card = button.closest<HTMLElement>('[data-session]');
        if (!card) return;
        const command = button.dataset.command!;
        const payload: Record<string, unknown> = {};
        if (button.dataset.value) payload.seconds = Number(button.dataset.value);
        if (command === 'message') {
          const text = window.prompt('Mensaje para el equipo:')?.trim();
          if (!text) return;
          payload.text = text;
        }
        await this.client!.from('gm_commands').insert({ session_id: card.dataset.session, command, payload });
      });
    });
  }

  private escape(value: string): string {
    return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!);
  }
}
