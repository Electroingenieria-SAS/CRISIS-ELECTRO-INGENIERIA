import { STORY, ZONES } from './content';
import type { GameState, PlayerProfile, ZoneId } from './types';

export class UI {
  readonly layer = document.createElement('div');
  private objective!: HTMLElement;
  private detail!: HTMLElement;
  private timer!: HTMLElement;
  private score!: HTMLElement;
  private errors!: HTMLElement;
  private zone!: HTMLElement;
  private prompt!: HTMLElement;
  private toast!: HTMLElement;
  private modal!: HTMLElement;
  private toastTimer: number | null = null;

  constructor(private root: HTMLElement) {
    this.layer.className = 'v8-ui';
    this.layer.innerHTML = `
      <header class="v8-hud">
        <div class="v8-brand"><b>EI</b><span><strong>OPERACIÓN AURORA</strong><small>INVESTIGACIÓN SISTÉMICA</small></span></div>
        <div class="v8-zone" id="v8-zone">CENTRO DE CONTROL</div>
        <div class="v8-metrics"><span>TIEMPO <b id="v8-time">35:00</b></span><span>PUNTAJE <b id="v8-score">1000</b></span><span>ERRORES <b id="v8-errors">0</b></span></div>
      </header>
      <section class="v8-objective"><small>MISIÓN ACTIVA</small><strong id="v8-objective">Esperando briefing</strong><p id="v8-detail"></p></section>
      <div class="v8-help"><span><kbd>WASD</kbd> mover</span><span><kbd>SHIFT</kbd> correr</span><span><kbd>E</kbd> interactuar / cargar</span><span><kbd>F</kbd> escáner</span><span><kbd>Q</kbd> mapa</span></div>
      <div class="v8-prompt is-hidden" id="v8-prompt"></div>
      <div class="v8-toast is-hidden" id="v8-toast"></div>
      <div class="v8-modal is-hidden" id="v8-modal"></div>
    `;
    root.appendChild(this.layer);
    this.objective = this.layer.querySelector('#v8-objective')!;
    this.detail = this.layer.querySelector('#v8-detail')!;
    this.timer = this.layer.querySelector('#v8-time')!;
    this.score = this.layer.querySelector('#v8-score')!;
    this.errors = this.layer.querySelector('#v8-errors')!;
    this.zone = this.layer.querySelector('#v8-zone')!;
    this.prompt = this.layer.querySelector('#v8-prompt')!;
    this.toast = this.layer.querySelector('#v8-toast')!;
    this.modal = this.layer.querySelector('#v8-modal')!;
  }

  async createProfile(): Promise<PlayerProfile> {
    return new Promise((resolve) => {
      this.modal.innerHTML = `
        <div class="v8-start">
          <div class="v8-start-copy"><small>ELECTROINGENIERÍA S.A.S.</small><h1>OPERACIÓN<br><em>AURORA</em></h1><p>Aventura 3D de investigación, trazabilidad y mejora continua.</p></div>
          <form id="v8-profile" class="v8-profile">
            <h2>Identificación del investigador</h2>
            <label>Nombre<input id="v8-name" value="Investigador" maxlength="28" required></label>
            <label>Equipo<input id="v8-team" value="Equipo Aurora" maxlength="24" required></label>
            <div class="v8-roles">
              <label><input type="radio" name="role" value="quality" checked><span><b>Calidad</b><small>Lectura de evidencia</small></span></label>
              <label><input type="radio" name="role" value="process"><span><b>Procesos</b><small>Flujo y causas</small></span></label>
              <label><input type="radio" name="role" value="maintenance"><span><b>Mantenimiento</b><small>Riesgo técnico</small></span></label>
            </div>
            <button type="submit">INICIAR MISIÓN <b>→</b></button>
          </form>
        </div>`;
      this.modal.classList.remove('is-hidden');
      const form = this.modal.querySelector<HTMLFormElement>('#v8-profile')!;
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const role = this.modal.querySelector<HTMLInputElement>('input[name="role"]:checked')!.value as PlayerProfile['role'];
        const profile: PlayerProfile = {
          name: this.modal.querySelector<HTMLInputElement>('#v8-name')!.value.trim(),
          team: this.modal.querySelector<HTMLInputElement>('#v8-team')!.value.trim(),
          role,
          accent: role === 'quality' ? '#69B7F0' : role === 'process' ? '#55B985' : '#E8984A'
        };
        this.modal.classList.add('is-hidden');
        this.modal.innerHTML = '';
        resolve(profile);
      }, { once: true });
    });
  }

  async storyBriefing(): Promise<void> {
    for (let i = 0; i < STORY.length; i++) {
      const slide = STORY[i];
      if (!slide) continue;
      await new Promise<void>((resolve) => {
        this.modal.innerHTML = `<div class="v8-brief"><small>BRIEFING ${i + 1}/${STORY.length}</small><h2>${slide.title}</h2><p>${slide.body}</p><button id="v8-next">${i === STORY.length - 1 ? 'ENTRAR A LA PLANTA' : 'CONTINUAR'} →</button></div>`;
        this.modal.classList.remove('is-hidden');
        const close = () => { window.removeEventListener('keydown', key); resolve(); };
        const key = (event: KeyboardEvent) => { if (event.code === 'Enter' || event.code === 'Space') close(); };
        window.addEventListener('keydown', key);
        this.modal.querySelector('#v8-next')?.addEventListener('click', close, { once: true });
      });
    }
    this.modal.classList.add('is-hidden');
    this.modal.innerHTML = '';
  }

  update(state: GameState): void {
    const seconds = Math.max(0, Math.floor(state.remainingSeconds));
    this.timer.textContent = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    this.score.textContent = String(Math.max(0, Math.floor(state.score)));
    this.errors.textContent = String(state.errors);
    this.objective.textContent = state.objective;
    this.detail.textContent = state.detail;
    this.setZone(state.zone);
  }

  setZone(zone: ZoneId): void {
    const meta = ZONES[zone];
    this.zone.textContent = meta.name.toUpperCase();
    this.zone.style.setProperty('--zone', meta.accent);
  }

  setPrompt(text: string | null): void {
    if (!text) { this.prompt.classList.add('is-hidden'); return; }
    this.prompt.innerHTML = `<kbd>E</kbd><span>${text}</span>`;
    this.prompt.classList.remove('is-hidden');
  }

  toastMessage(title: string, body = '', kind: 'normal' | 'success' | 'danger' = 'normal'): void {
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toast.className = `v8-toast v8-toast--${kind}`;
    this.toast.innerHTML = `<b>${kind === 'success' ? '✓' : kind === 'danger' ? '!' : '•'}</b><span><strong>${title}</strong>${body ? `<small>${body}</small>` : ''}</span>`;
    this.toast.classList.remove('is-hidden');
    this.toastTimer = window.setTimeout(() => this.toast.classList.add('is-hidden'), 3600);
  }

  async dialogue(speaker: string, role: string, text: string): Promise<void> {
    return new Promise((resolve) => {
      this.modal.innerHTML = `<div class="v8-dialogue"><div class="v8-avatar">${speaker.charAt(0)}</div><div><small>${role}</small><h3>${speaker}</h3><p>${text}</p><button id="v8-dialogue-next">CONTINUAR →</button></div></div>`;
      this.modal.classList.remove('is-hidden');
      const done = () => { window.removeEventListener('keydown', key); this.modal.classList.add('is-hidden'); this.modal.innerHTML = ''; resolve(); };
      const key = (event: KeyboardEvent) => { if (event.code === 'Enter' || event.code === 'Space' || event.code === 'KeyE') done(); };
      window.addEventListener('keydown', key);
      this.modal.querySelector('#v8-dialogue-next')?.addEventListener('click', done, { once: true });
    });
  }

  showMap(current: ZoneId): void {
    const zoneCards = Object.entries(ZONES).map(([id, meta]) => `<div class="v8-map-zone ${id === current ? 'is-current' : ''}" style="--accent:${meta.accent}"><b>${meta.short}</b><small>${id === current ? 'UBICACIÓN ACTUAL' : 'SECTOR OPERATIVO'}</small></div>`).join('');
    this.modal.innerHTML = `<div class="v8-map"><header><small>PLANO OPERATIVO</small><h2>CAMPUS AURORA</h2></header><div class="v8-map-grid">${zoneCards}</div><button id="v8-map-close">CERRAR · Q / ESC</button></div>`;
    this.modal.classList.remove('is-hidden');
    this.modal.querySelector('#v8-map-close')?.addEventListener('click', () => this.closeModal(), { once: true });
  }

  closeModal(): void {
    this.modal.classList.add('is-hidden');
    this.modal.innerHTML = '';
  }

  isModalOpen(): boolean {
    return !this.modal.classList.contains('is-hidden');
  }

  showResult(state: GameState, title: string, body: string): void {
    this.modal.innerHTML = `<div class="v8-result"><small>OPERACIÓN AURORA</small><h1>${title}</h1><p>${body}</p><div><span>PUNTAJE <b>${Math.floor(state.score)}</b></span><span>ERRORES <b>${state.errors}</b></span></div><button onclick="location.reload()">REINICIAR MISIÓN</button></div>`;
    this.modal.classList.remove('is-hidden');
  }
}
