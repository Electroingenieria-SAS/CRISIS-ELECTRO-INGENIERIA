import type { Choice, FiveWhyStep, GameStats, InventoryItem, PlayerProfile } from './types';

export class UI {
  readonly overlay: HTMLDivElement;
  private hudTimer!: HTMLElement;
  private hudStage!: HTMLElement;
  private hudScore!: HTMLElement;
  private hudHealth!: HTMLElement;
  private hudErrors!: HTMLElement;
  private objective!: HTMLElement;
  private interaction!: HTMLElement;
  private toast!: HTMLElement;
  private modal!: HTMLElement;
  private startScreen!: HTMLElement;
  private gameOver!: HTMLElement;
  private inventory!: HTMLElement;
  private inventoryGrid!: HTMLElement;
  private playerChip!: HTMLElement;
  private toastTimer: number | null = null;
  private inventoryOpen = false;

  constructor(private root: HTMLElement) {
    this.overlay = document.createElement('div');
    this.overlay.className = 'ui-layer';
    this.overlay.innerHTML = `
      <div class="hud hud--top">
        <div class="brand-chip">
          <span class="brand-mark">EI</span>
          <span><strong>CRISIS</strong><small>ELECTROINGENIERÍA</small></span>
        </div>
        <div class="player-chip" id="player-chip"><span>AGENTE</span><strong>—</strong></div>
        <div class="hud-metrics">
          <div class="metric"><span>TIEMPO</span><strong id="hud-timer">45:00</strong></div>
          <div class="metric"><span>FASE</span><strong id="hud-stage">01</strong></div>
          <div class="metric"><span>PUNTOS</span><strong id="hud-score">0</strong></div>
          <div class="metric"><span>VIDA</span><strong id="hud-health">100%</strong></div>
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
        <span><kbd>SPACE</kbd> verificar/atacar</span>
        <span><kbd>I</kbd> inventario</span>
        <span><kbd>M</kbd> audio</span>
      </div>
      <button id="inventory-button" class="inventory-button" aria-label="Inventario"><span>I</span><b>INVENTARIO</b><em id="inventory-count">0</em></button>
      <aside id="inventory" class="inventory-panel is-hidden">
        <div class="inventory-head"><div><span class="eyebrow">MOCHILA DE INVESTIGACIÓN</span><h3>INVENTARIO</h3></div><button id="inventory-close">×</button></div>
        <div id="inventory-grid" class="inventory-grid"></div>
        <p class="inventory-help">Las evidencias y herramientas recogidas desbloquean mecanismos físicos de la mazmorra.</p>
      </aside>
      <div id="interaction" class="interaction-prompt is-hidden"></div>
      <div id="toast" class="toast is-hidden"></div>
      <div id="modal" class="modal-shell is-hidden"></div>
      <div id="start-screen" class="start-screen"></div>
      <div id="game-over" class="game-over is-hidden"></div>
    `;
    this.root.appendChild(this.overlay);

    this.hudTimer = this.overlay.querySelector('#hud-timer')!;
    this.hudStage = this.overlay.querySelector('#hud-stage')!;
    this.hudScore = this.overlay.querySelector('#hud-score')!;
    this.hudHealth = this.overlay.querySelector('#hud-health')!;
    this.hudErrors = this.overlay.querySelector('#hud-errors')!;
    this.objective = this.overlay.querySelector('#objective-text')!;
    this.interaction = this.overlay.querySelector('#interaction')!;
    this.toast = this.overlay.querySelector('#toast')!;
    this.modal = this.overlay.querySelector('#modal')!;
    this.startScreen = this.overlay.querySelector('#start-screen')!;
    this.gameOver = this.overlay.querySelector('#game-over')!;
    this.inventory = this.overlay.querySelector('#inventory')!;
    this.inventoryGrid = this.overlay.querySelector('#inventory-grid')!;
    this.playerChip = this.overlay.querySelector('#player-chip')!;

    this.overlay.querySelector('#inventory-button')!.addEventListener('click', () => this.toggleInventory());
    this.overlay.querySelector('#inventory-close')!.addEventListener('click', () => this.toggleInventory(false));
  }

  waitForStart(): Promise<PlayerProfile> {
    this.startScreen.innerHTML = `
      <div class="start-vignette"></div>
      <div class="start-layout">
        <section class="start-copy">
          <span class="mission-tag">OPERACIÓN NC-26-0914 · EXPERIENCIA COOPERATIVA</span>
          <h1>CRISIS EN<br><em>ELECTROINGENIERÍA</em></h1>
          <p class="lead">La falla atravesó pedido, producción, inspección y despacho. Tu equipo debe reconstruir la evidencia, sobrevivir a los “errores”, construir el Ishikawa, completar los 5 Porqués y contener la crisis antes de que el cliente escale el incidente.</p>
          <div class="feature-ribbon"><span>MAZMORRA 3D</span><span>ISHIKAWA</span><span>5 PORQUÉS</span><span>GAME MASTER</span></div>
        </section>
        <form id="profile-form" class="profile-panel">
          <span class="eyebrow">REGISTRO DE EQUIPO</span>
          <h2>ARMA TU AGENTE</h2>
          <div class="form-grid">
            <label>Nombre del jugador<input id="player-name" maxlength="32" placeholder="Ej. Juan Esteban" required></label>
            <label>Equipo<input id="team-name" maxlength="28" placeholder="Ej. Equipo Sigma" required></label>
            <label>Indicativo<input id="callsign" maxlength="14" placeholder="Ej. HALCÓN" required></label>
            <label>Color de identificación<input id="accent" type="color" value="#ffd43b"></label>
          </div>
          <span class="field-title">ESPECIALIZACIÓN</span>
          <div class="class-grid">
            <label class="class-card is-selected"><input type="radio" name="class" value="inspector" checked><b>INSPECTOR</b><small>Equilibrado · lectura de evidencias</small><span>◈</span></label>
            <label class="class-card"><input type="radio" name="class" value="analyst"><b>ANALISTA</b><small>+90 s iniciales · lógica</small><span>⌁</span></label>
            <label class="class-card"><input type="radio" name="class" value="engineer"><b>INGENIERO</b><small>Escudo de impacto · combate</small><span>⚙</span></label>
          </div>
          <button class="primary-button" type="submit">ENTRAR A LA MAZMORRA</button>
          <p class="fineprint">WASD se mueve en la dirección visual de la cámara. Usa audífonos si están disponibles.</p>
        </form>
      </div>`;

    this.startScreen.querySelectorAll<HTMLInputElement>('input[name="class"]').forEach((input) => {
      input.addEventListener('change', () => {
        this.startScreen.querySelectorAll('.class-card').forEach((card) => card.classList.remove('is-selected'));
        input.closest('.class-card')?.classList.add('is-selected');
      });
    });

    return new Promise((resolve) => {
      this.startScreen.querySelector<HTMLFormElement>('#profile-form')!.addEventListener('submit', (event) => {
        event.preventDefault();
        const playerName = this.startScreen.querySelector<HTMLInputElement>('#player-name')!.value.trim();
        const teamName = this.startScreen.querySelector<HTMLInputElement>('#team-name')!.value.trim();
        const callsign = this.startScreen.querySelector<HTMLInputElement>('#callsign')!.value.trim().toUpperCase();
        const accent = this.startScreen.querySelector<HTMLInputElement>('#accent')!.value;
        const characterClass = this.startScreen.querySelector<HTMLInputElement>('input[name="class"]:checked')!.value as PlayerProfile['characterClass'];
        if (!playerName || !teamName || !callsign) return;
        this.startScreen.classList.add('is-hidden');
        this.playerChip.innerHTML = `<span>${this.escape(teamName)}</span><strong>${this.escape(callsign)}</strong>`;
        resolve({ playerName, teamName, callsign, accent, characterClass });
      }, { once: true });
    });
  }

  update(stats: GameStats): void {
    const secs = Math.max(0, Math.floor(stats.remainingSeconds));
    const min = Math.floor(secs / 60).toString().padStart(2, '0');
    const sec = (secs % 60).toString().padStart(2, '0');
    this.hudTimer.textContent = `${min}:${sec}`;
    this.hudTimer.classList.toggle('danger', secs <= 300);
    const stageIndex = ['briefing', 'evidence', 'traceability', 'risk', 'ishikawa', 'five-whys', 'containment', 'complete'].indexOf(stats.stage) + 1;
    this.hudStage.textContent = String(Math.max(1, stageIndex)).padStart(2, '0');
    this.hudScore.textContent = String(Math.max(0, Math.round(stats.score)));
    this.hudHealth.textContent = `${Math.max(0, Math.round(stats.health))}%`;
    this.hudHealth.classList.toggle('danger', stats.health <= 35);
    this.hudErrors.textContent = String(stats.errors);
    this.renderInventory(stats.inventory);
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
    this.interaction.innerHTML = `<kbd>E</kbd><span>${this.escape(label)}</span>`;
    this.interaction.classList.remove('is-hidden');
  }

  toggleInventory(force?: boolean): boolean {
    this.inventoryOpen = force ?? !this.inventoryOpen;
    this.inventory.classList.toggle('is-hidden', !this.inventoryOpen);
    return this.inventoryOpen;
  }

  isInventoryOpen(): boolean { return this.inventoryOpen; }

  showToast(title: string, body?: string, kind: 'normal' | 'danger' | 'success' = 'normal'): void {
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toast.className = `toast toast--${kind}`;
    this.toast.innerHTML = `<strong>${this.escape(title)}</strong>${body ? `<span>${this.escape(body)}</span>` : ''}`;
    this.toast.classList.remove('is-hidden');
    this.toastTimer = window.setTimeout(() => this.toast.classList.add('is-hidden'), 3400);
  }

  async document(title: string, code: string, rows: Array<[string, string]>, conclusion: string): Promise<void> {
    await this.openModal(`
      <div class="modal-card document-card">
        <div class="modal-header"><span class="eyebrow">EVIDENCIA DOCUMENTAL</span><button class="close-modal" aria-label="Cerrar">×</button></div>
        <h2>${this.escape(title)}</h2>
        <div class="document-code">${this.escape(code)}</div>
        <div class="document-table">${rows.map(([a, b]) => `<div><span>${this.escape(a)}</span><strong>${this.escape(b)}</strong></div>`).join('')}</div>
        <div class="document-conclusion"><span>HALLAZGO</span><p>${this.escape(conclusion)}</p></div>
        <button class="primary-button close-modal">REGISTRAR EN BITÁCORA</button>
      </div>`);
  }

  async dialogue(speaker: string, text: string, button = 'CONTINUAR'): Promise<void> {
    await this.openModal(`
      <div class="modal-card dialogue-card">
        <div class="speaker-chip">${this.escape(speaker)}</div>
        <p class="dialogue-text">${this.escape(text)}</p>
        <button class="primary-button close-modal">${this.escape(button)}</button>
      </div>`);
  }

  choose(title: string, prompt: string, choices: Choice[], eyebrow = 'RETO DE CALIDAD'): Promise<string> {
    return new Promise((resolve) => {
      this.modal.innerHTML = `
        <div class="modal-card puzzle-card">
          <span class="eyebrow">${this.escape(eyebrow)}</span>
          <h2>${this.escape(title)}</h2>
          <p>${this.escape(prompt)}</p>
          <div class="choice-grid">${choices.map((choice, index) => `<button class="choice-button" data-choice="${this.escape(choice.id)}"><span>${String(index + 1).padStart(2, '0')}</span>${this.escape(choice.text)}</button>`).join('')}</div>
        </div>`;
      this.modal.classList.remove('is-hidden');
      this.modal.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach((button) => {
        button.addEventListener('click', () => {
          const value = button.dataset.choice!;
          this.closeModal();
          resolve(value);
        }, { once: true });
      });
    });
  }

  sequencePuzzle(title: string, prompt: string, items: Choice[], correctOrder: string[]): Promise<boolean> {
    return new Promise((resolve) => {
      const chosen: string[] = [];
      const render = () => {
        this.modal.innerHTML = `
          <div class="modal-card puzzle-card sequence-card">
            <span class="eyebrow">MINIJUEGO · SECUENCIA OPERATIVA</span>
            <h2>${this.escape(title)}</h2>
            <p>${this.escape(prompt)}</p>
            <div class="sequence-progress">${correctOrder.map((_, i) => `<span class="${i < chosen.length ? 'filled' : ''}">${i + 1}</span>`).join('')}</div>
            <div class="choice-grid">${items.filter((item) => !chosen.includes(item.id)).map((item) => `<button class="choice-button" data-sequence="${this.escape(item.id)}">${this.escape(item.text)}</button>`).join('')}</div>
            <button class="ghost-button" id="sequence-reset">REINICIAR SECUENCIA</button>
          </div>`;
        this.modal.classList.remove('is-hidden');
        this.modal.querySelectorAll<HTMLButtonElement>('[data-sequence]').forEach((button) => {
          button.addEventListener('click', () => {
            chosen.push(button.dataset.sequence!);
            if (chosen.length === correctOrder.length) {
              const success = chosen.every((id, index) => id === correctOrder[index]);
              this.closeModal();
              resolve(success);
              return;
            }
            render();
          });
        });
        this.modal.querySelector('#sequence-reset')?.addEventListener('click', () => { chosen.splice(0); render(); });
      };
      render();
    });
  }

  async classificationPuzzle(
    title: string,
    cases: Array<{ id: string; text: string }>,
    categories: Choice[],
    answers: Record<string, string>
  ): Promise<{ correct: number; total: number }> {
    let correct = 0;
    for (let index = 0; index < cases.length; index += 1) {
      const current = cases[index]!;
      const result = await this.choose(
        `${title} · ${index + 1}/${cases.length}`,
        current.text,
        categories,
        'ISHIKAWA · CLASIFICACIÓN DE CAUSA'
      );
      if (result === answers[current.id]) correct += 1;
    }
    return { correct, total: cases.length };
  }

  async fiveWhys(steps: FiveWhyStep[]): Promise<{ mistakes: number }> {
    let mistakes = 0;
    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index]!;
      let solved = false;
      while (!solved) {
        const answer = await this.choose(`5 Porqués · ${index + 1}/5`, step.why, step.choices, `CADENA CAUSAL · ¿POR QUÉ ${index + 1}?`);
        if (answer === step.correct) {
          solved = true;
          await this.dialogue('CADENA CAUSAL', step.explanation, index === steps.length - 1 ? 'VALIDAR CAUSA RAÍZ' : 'SIGUIENTE POR QUÉ');
        } else {
          mistakes += 1;
          await this.dialogue('ANÁLISIS INSUFICIENTE', 'La respuesta se queda en síntoma, persona o etapa. Busca la condición del sistema que permitió que el problema continuara.', 'REINTENTAR');
        }
      }
    }
    return { mistakes };
  }

  timingMiniGame(rounds = 3): Promise<number> {
    return new Promise((resolve) => {
      let round = 1;
      let hits = 0;
      let position = 0;
      let direction = 1;
      let raf = 0;
      let last = performance.now();

      const render = () => {
        this.modal.innerHTML = `
          <div class="modal-card timing-card">
            <span class="eyebrow">MINIJUEGO · CONTROL DE LIBERACIÓN</span>
            <h2>VENTANA DE VERIFICACIÓN</h2>
            <p>Detén el pulso dentro de la zona segura. Debes lograr al menos 2 aciertos de ${rounds}.</p>
            <div class="timing-info"><strong>RONDA ${round}/${rounds}</strong><span>ACIERTOS ${hits}</span></div>
            <div class="timing-track"><div class="timing-safe"></div><div class="timing-cursor" id="timing-cursor"></div></div>
            <button class="primary-button" id="timing-stop">VERIFICAR AHORA</button>
          </div>`;
        this.modal.classList.remove('is-hidden');
        this.modal.querySelector('#timing-stop')!.addEventListener('click', stopRound, { once: true });
      };

      const animate = (now: number) => {
        const dt = Math.min(0.04, (now - last) / 1000);
        last = now;
        position += direction * dt * (0.75 + round * 0.13);
        if (position >= 1) { position = 1; direction = -1; }
        if (position <= 0) { position = 0; direction = 1; }
        const cursor = this.modal.querySelector<HTMLElement>('#timing-cursor');
        if (cursor) cursor.style.left = `${position * 100}%`;
        raf = requestAnimationFrame(animate);
      };

      const stopRound = () => {
        cancelAnimationFrame(raf);
        if (position >= 0.42 && position <= 0.58) hits += 1;
        if (round >= rounds) {
          this.closeModal();
          resolve(hits);
          return;
        }
        round += 1;
        position = Math.random() * 0.25;
        direction = 1;
        last = performance.now();
        render();
        raf = requestAnimationFrame(animate);
      };

      render();
      raf = requestAnimationFrame(animate);
    });
  }

  showGameMasterMessage(text: string): Promise<void> {
    return this.dialogue('GAME MASTER', text, 'RECIBIDO');
  }

  showVictory(elapsedSeconds: number, stats: GameStats, profile: PlayerProfile): void {
    const min = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
    const sec = Math.floor(elapsedSeconds % 60).toString().padStart(2, '0');
    this.gameOver.innerHTML = `
      <div class="result-panel result-panel--success">
        <span class="mission-tag">INCIDENTE CONTENIDO · ${this.escape(profile.teamName)}</span>
        <h1>CAUSA RAÍZ<br><em>CONTROLADA</em></h1>
        <p>${this.escape(profile.callsign)} completó la cadena de investigación, eliminó errores activos y validó una acción correctiva sistémica.</p>
        <div class="result-grid">
          <div><span>TIEMPO</span><strong>${min}:${sec}</strong></div>
          <div><span>ERRORES</span><strong>${stats.errors}</strong></div>
          <div><span>ERRORES ELIMINADOS</span><strong>${stats.defeatedErrors}</strong></div>
          <div><span>PUNTAJE</span><strong>${Math.max(0, Math.round(stats.score))}</strong></div>
        </div>
        <button class="primary-button" onclick="location.reload()">NUEVA MISIÓN</button>
      </div>`;
    this.gameOver.classList.remove('is-hidden');
  }

  showFailure(): void {
    this.gameOver.innerHTML = `
      <div class="result-panel result-panel--failure">
        <span class="mission-tag">PROTOCOLO DE CRISIS</span>
        <h1>INCIDENTE<br><em>ESCALADO</em></h1>
        <p>El equipo perdió la ventana de contención. Revisa la ruta causal y vuelve a intentarlo.</p>
        <button class="primary-button" onclick="location.reload()">REINTENTAR</button>
      </div>`;
    this.gameOver.classList.remove('is-hidden');
  }

  isModalOpen(): boolean {
    return !this.modal.classList.contains('is-hidden') || this.inventoryOpen;
  }

  private renderInventory(items: InventoryItem[]): void {
    const count = this.overlay.querySelector<HTMLElement>('#inventory-count')!;
    count.textContent = String(items.length);
    const slots = Array.from({ length: Math.max(12, Math.ceil(items.length / 4) * 4) }, (_, index) => items[index]);
    this.inventoryGrid.innerHTML = slots.map((item) => item
      ? `<div class="inventory-slot inventory-slot--${item.kind}"><span>${this.escape(item.icon)}</span><div><strong>${this.escape(item.name)}</strong><small>${this.escape(item.description)}</small></div></div>`
      : '<div class="inventory-slot inventory-slot--empty"><span>·</span></div>'
    ).join('');
  }

  private openModal(html: string): Promise<void> {
    return new Promise((resolve) => {
      this.modal.innerHTML = html;
      this.modal.classList.remove('is-hidden');
      const close = () => { this.closeModal(); resolve(); };
      this.modal.querySelectorAll('.close-modal').forEach((button) => button.addEventListener('click', close, { once: true }));
    });
  }

  private closeModal(): void {
    this.modal.classList.add('is-hidden');
    this.modal.innerHTML = '';
  }

  private escape(value: string): string {
    return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!);
  }
}
