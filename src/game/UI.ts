import type { Choice, GameStats } from './types';

export class UI {
  readonly overlay: HTMLDivElement;
  private hudTimer!: HTMLElement;
  private hudEvidence!: HTMLElement;
  private hudKey!: HTMLElement;
  private hudErrors!: HTMLElement;
  private objective!: HTMLElement;
  private interaction!: HTMLElement;
  private toast!: HTMLElement;
  private modal!: HTMLElement;
  private startScreen!: HTMLElement;
  private gameOver!: HTMLElement;
  private toastTimer: number | null = null;

  constructor(private root: HTMLElement) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'ui-layer';
    this.overlay.innerHTML = `
      <div class="hud hud--top">
        <div class="brand-chip">
          <span class="brand-mark">EI</span>
          <span><strong>CRISIS</strong><small>ELECTROINGENIERÍA</small></span>
        </div>
        <div class="hud-metrics">
          <div class="metric"><span>TIEMPO</span><strong id="hud-timer">45:00</strong></div>
          <div class="metric"><span>EVIDENCIAS</span><strong id="hud-evidence">0/3</strong></div>
          <div class="metric"><span>LLAVE</span><strong id="hud-key">0/1</strong></div>
          <div class="metric"><span>ERRORES</span><strong id="hud-errors">0</strong></div>
        </div>
      </div>
      <div class="objective-card">
        <span class="eyebrow">OBJETIVO ACTUAL</span>
        <strong id="objective-text">Inicia la misión</strong>
      </div>
      <div class="controls-card">
        <span><kbd>WASD</kbd> mover</span>
        <span><kbd>SHIFT</kbd> correr</span>
        <span><kbd>E</kbd> interactuar</span>
      </div>
      <div id="interaction" class="interaction-prompt is-hidden"></div>
      <div id="toast" class="toast is-hidden"></div>
      <div id="modal" class="modal-shell is-hidden"></div>
      <div id="start-screen" class="start-screen">
        <div class="start-vignette"></div>
        <div class="start-panel">
          <span class="mission-tag">PROTOCOLO DE EMERGENCIA · VERTICAL SLICE 01</span>
          <h1>CRISIS EN<br><em>ELECTROINGENIERÍA</em></h1>
          <p class="lead">Un pedido crítico salió con inconsistencias. El cliente espera respuesta. Recorre la mazmorra, recupera las evidencias y determina la causa raíz antes de que se agote el tiempo.</p>
          <div class="briefing-grid">
            <div><span>INCIDENTE</span><strong>NC-26-0914</strong></div>
            <div><span>TIEMPO LÍMITE</span><strong>45 MIN</strong></div>
            <div><span>MISIÓN</span><strong>TRAZABILIDAD</strong></div>
          </div>
          <button id="start-button" class="primary-button">INICIAR INVESTIGACIÓN</button>
          <p class="fineprint">Inspiración: dungeon RPG clásico + escape room + herramientas de calidad.</p>
        </div>
      </div>
      <div id="game-over" class="game-over is-hidden"></div>
    `;
    this.root.appendChild(this.overlay);

    this.hudTimer = this.overlay.querySelector('#hud-timer')!;
    this.hudEvidence = this.overlay.querySelector('#hud-evidence')!;
    this.hudKey = this.overlay.querySelector('#hud-key')!;
    this.hudErrors = this.overlay.querySelector('#hud-errors')!;
    this.objective = this.overlay.querySelector('#objective-text')!;
    this.interaction = this.overlay.querySelector('#interaction')!;
    this.toast = this.overlay.querySelector('#toast')!;
    this.modal = this.overlay.querySelector('#modal')!;
    this.startScreen = this.overlay.querySelector('#start-screen')!;
    this.gameOver = this.overlay.querySelector('#game-over')!;
  }

  waitForStart(): Promise<void> {
    return new Promise((resolve) => {
      const button = this.overlay.querySelector<HTMLButtonElement>('#start-button')!;
      button.addEventListener('click', () => {
        this.startScreen.classList.add('is-hidden');
        resolve();
      }, { once: true });
    });
  }

  update(stats: GameStats): void {
    const secs = Math.max(0, Math.floor(stats.remainingSeconds));
    const min = Math.floor(secs / 60).toString().padStart(2, '0');
    const sec = (secs % 60).toString().padStart(2, '0');
    this.hudTimer.textContent = `${min}:${sec}`;
    this.hudTimer.classList.toggle('danger', secs <= 300);
    this.hudEvidence.textContent = `${stats.evidence.size}/3`;
    this.hudKey.textContent = `${stats.keys.size}/1`;
    this.hudErrors.textContent = String(stats.errors);
  }

  setObjective(text: string): void {
    this.objective.textContent = text;
    this.objective.parentElement?.classList.add('objective-pulse');
    window.setTimeout(() => this.objective.parentElement?.classList.remove('objective-pulse'), 450);
  }

  setInteraction(label: string | null): void {
    if (!label) {
      this.interaction.classList.add('is-hidden');
      return;
    }
    this.interaction.innerHTML = `<kbd>E</kbd><span>${label}</span>`;
    this.interaction.classList.remove('is-hidden');
  }

  showToast(title: string, body?: string, kind: 'normal' | 'danger' | 'success' = 'normal'): void {
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toast.className = `toast toast--${kind}`;
    this.toast.innerHTML = `<strong>${title}</strong>${body ? `<span>${body}</span>` : ''}`;
    this.toast.classList.remove('is-hidden');
    this.toastTimer = window.setTimeout(() => this.toast.classList.add('is-hidden'), 3200);
  }

  async document(title: string, code: string, rows: Array<[string, string]>, conclusion: string): Promise<void> {
    await this.openModal(`
      <div class="modal-card document-card">
        <div class="modal-header"><span class="eyebrow">EVIDENCIA DOCUMENTAL</span><button class="close-modal" aria-label="Cerrar">×</button></div>
        <h2>${title}</h2>
        <div class="document-code">${code}</div>
        <div class="document-table">
          ${rows.map(([a,b]) => `<div><span>${a}</span><strong>${b}</strong></div>`).join('')}
        </div>
        <div class="document-conclusion"><span>HALLAZGO</span><p>${conclusion}</p></div>
        <button class="primary-button close-modal">REGISTRAR Y CERRAR</button>
      </div>
    `);
  }

  async dialogue(speaker: string, text: string, button = 'CONTINUAR'): Promise<void> {
    await this.openModal(`
      <div class="modal-card dialogue-card">
        <div class="speaker-chip">${speaker}</div>
        <p class="dialogue-text">${text}</p>
        <button class="primary-button close-modal">${button}</button>
      </div>
    `);
  }

  choose(title: string, prompt: string, choices: Choice[]): Promise<string> {
    return new Promise((resolve) => {
      this.modal.innerHTML = `
        <div class="modal-card puzzle-card">
          <span class="eyebrow">RETO DE CALIDAD</span>
          <h2>${title}</h2>
          <p>${prompt}</p>
          <div class="choice-grid">
            ${choices.map((c, i) => `<button class="choice-button" data-choice="${c.id}"><span>${String(i + 1).padStart(2,'0')}</span>${c.text}</button>`).join('')}
          </div>
        </div>`;
      this.modal.classList.remove('is-hidden');
      this.modal.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach((button) => {
        button.addEventListener('click', () => {
          const value = button.dataset.choice!;
          this.modal.classList.add('is-hidden');
          this.modal.innerHTML = '';
          resolve(value);
        }, { once: true });
      });
    });
  }

  showVictory(elapsedSeconds: number, stats: GameStats): void {
    const min = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
    const sec = Math.floor(elapsedSeconds % 60).toString().padStart(2, '0');
    const score = Math.max(0, 1000 - stats.errors * 90 - stats.hints * 50 - Math.floor(elapsedSeconds / 15));
    this.gameOver.innerHTML = `
      <div class="result-panel result-panel--success">
        <span class="mission-tag">INCIDENTE CONTENIDO</span>
        <h1>CAUSA RAÍZ<br><em>IDENTIFICADA</em></h1>
        <p>La investigación reconstruyó la trazabilidad y definió una acción correctiva sistémica.</p>
        <div class="result-grid">
          <div><span>TIEMPO</span><strong>${min}:${sec}</strong></div>
          <div><span>ERRORES</span><strong>${stats.errors}</strong></div>
          <div><span>EVIDENCIAS</span><strong>${stats.evidence.size}/3</strong></div>
          <div><span>PUNTAJE</span><strong>${score}</strong></div>
        </div>
        <button class="primary-button" onclick="location.reload()">REINICIAR MISIÓN</button>
      </div>`;
    this.gameOver.classList.remove('is-hidden');
  }

  showFailure(): void {
    this.gameOver.innerHTML = `
      <div class="result-panel result-panel--failure">
        <span class="mission-tag">TIEMPO AGOTADO</span>
        <h1>EL CLIENTE<br><em>ESCALÓ LA CRISIS</em></h1>
        <p>La investigación no logró cerrar la causa raíz dentro del tiempo disponible.</p>
        <button class="primary-button" onclick="location.reload()">REINTENTAR</button>
      </div>`;
    this.gameOver.classList.remove('is-hidden');
  }

  isModalOpen(): boolean {
    return !this.modal.classList.contains('is-hidden');
  }

  private openModal(html: string): Promise<void> {
    return new Promise((resolve) => {
      this.modal.innerHTML = html;
      this.modal.classList.remove('is-hidden');
      const close = () => {
        this.modal.classList.add('is-hidden');
        this.modal.innerHTML = '';
        resolve();
      };
      this.modal.querySelectorAll('.close-modal').forEach((button) => button.addEventListener('click', close, { once: true }));
    });
  }
}
