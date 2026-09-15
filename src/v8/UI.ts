import './creator.css';
import { HeroCustomizerPreview } from './characters/HeroCustomizerPreview';
import { STORY, ZONES } from './content';
import type { GameState, HeroAppearance, PlayerProfile, ZoneId } from './types';

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
        <div class="v8-start v8-start--creator v8-start--wardrobe">
          <aside class="v8-start-copy v8-creator-brand">
            <small>ELECTROINGENIERÍA S.A.S.</small>
            <h1>CREA TU<br><em>INVESTIGADOR</em></h1>
            <p>Escoge una silueta KayKit real y conviértela en tu ingeniero. Personaliza colores y EPP sin deformar el diseño original.</p>
            <div class="v8-ppe-lock"><b>⛑</b><span><strong>CASCO OBLIGATORIO</strong><small>Siempre forma parte del personaje; puedes elegir su color.</small></span></div>
            <label>Nombre<input id="v8-name" value="Investigador" maxlength="28" required></label>
            <label>Equipo<input id="v8-team" value="Equipo Aurora" maxlength="24" required></label>
            <div class="v8-roles">
              <label><input type="radio" name="role" value="quality" checked><span><b>Calidad</b><small>Evidencia</small></span></label>
              <label><input type="radio" name="role" value="process"><span><b>Procesos</b><small>Flujo</small></span></label>
              <label><input type="radio" name="role" value="maintenance"><span><b>Mantenimiento</b><small>Riesgo</small></span></label>
            </div>
          </aside>

          <section class="v8-creator-stage">
            <div class="v8-creator-stage-head"><small>VISTA PREVIA 3D</small><b>PERSONAJE PRINCIPAL</b></div>
            <div id="v8-hero-preview" class="v8-hero-preview"><div class="v8-preview-loading">CARGANDO INGENIERO…</div></div>
            <div class="v8-preview-note"><span>BASE KAYKIT</span><span>CHALECO EI</span><span>RIG REAL</span></div>
          </section>

          <form id="v8-profile" class="v8-profile v8-profile--creator v8-wardrobe-panel">
            <div class="v8-creator-title"><small>PERSONALIZACIÓN</small><h2>Diseña tu ingeniero</h2><p>La silueta y la cara vienen del personaje base; tú defines identidad industrial, colores y EPP.</p></div>

            <fieldset><legend>Modelo base</legend><div class="v8-choice-row">
              <label><input type="radio" name="base" value="knight" checked><span><b>Operativo</b><small>Compacto</small></span></label>
              <label><input type="radio" name="base" value="rogue"><span><b>Inspector</b><small>Ágil</small></span></label>
              <label><input type="radio" name="base" value="mage"><span><b>Especialista</b><small>Técnico</small></span></label>
            </div></fieldset>

            <fieldset><legend>Tono de piel</legend><div class="v8-swatches">
              <label title="Claro"><input type="radio" name="skin" value="#F0C7A7"><span style="--sw:#F0C7A7"></span></label>
              <label title="Medio claro"><input type="radio" name="skin" value="#D9A27E" checked><span style="--sw:#D9A27E"></span></label>
              <label title="Medio"><input type="radio" name="skin" value="#B97857"><span style="--sw:#B97857"></span></label>
              <label title="Moreno"><input type="radio" name="skin" value="#875238"><span style="--sw:#875238"></span></label>
              <label title="Oscuro"><input type="radio" name="skin" value="#5B3528"><span style="--sw:#5B3528"></span></label>
            </div></fieldset>

            <fieldset><legend>Color de cabello</legend><div class="v8-swatches v8-swatches--hair">
              <label title="Negro"><input type="radio" name="hair" value="#181513"><span style="--sw:#181513"></span></label>
              <label title="Castaño oscuro"><input type="radio" name="hair" value="#352722" checked><span style="--sw:#352722"></span></label>
              <label title="Castaño"><input type="radio" name="hair" value="#6B4937"><span style="--sw:#6B4937"></span></label>
              <label title="Cobrizo"><input type="radio" name="hair" value="#A67645"><span style="--sw:#A67645"></span></label>
            </div></fieldset>

            <fieldset><legend>Color del uniforme</legend><div class="v8-choice-row">
              <label><input type="radio" name="uniform" value="navy" checked><span>Azul EI</span></label>
              <label><input type="radio" name="uniform" value="graphite"><span>Grafito</span></label>
              <label><input type="radio" name="uniform" value="teal"><span>Verde técnico</span></label>
            </div></fieldset>

            <fieldset><legend>Pantalón</legend><div class="v8-choice-row">
              <label><input type="radio" name="pantsStyle" value="cargo" checked><span>Cargo</span></label>
              <label><input type="radio" name="pantsStyle" value="technical"><span>Técnico</span></label>
              <label><input type="radio" name="pantsStyle" value="graphite"><span>Grafito</span></label>
            </div></fieldset>

            <fieldset><legend>Calzado de seguridad</legend><div class="v8-choice-row">
              <label><input type="radio" name="bootStyle" value="black" checked><span>Negro</span></label>
              <label><input type="radio" name="bootStyle" value="yellow"><span>Amarillo</span></label>
              <label><input type="radio" name="bootStyle" value="steel"><span>Acero</span></label>
            </div></fieldset>

            <fieldset><legend>EPP exterior</legend><div class="v8-choice-row">
              <label><input type="radio" name="ppeStyle" value="vest" checked><span>Chaleco EI</span></label>
              <label><input type="radio" name="ppeStyle" value="harness"><span>Arnés</span></label>
              <label><input type="radio" name="ppeStyle" value="id-only"><span>Solo ID</span></label>
            </div><div class="v8-swatches v8-swatches--large">
              <label title="Azul"><input type="radio" name="vest" value="#2E8CC5" checked><span style="--sw:#2E8CC5"></span></label>
              <label title="Amarillo"><input type="radio" name="vest" value="#F3C83F"><span style="--sw:#F3C83F"></span></label>
              <label title="Naranja"><input type="radio" name="vest" value="#E9803A"><span style="--sw:#E9803A"></span></label>
              <label title="Verde"><input type="radio" name="vest" value="#55A879"><span style="--sw:#55A879"></span></label>
              <label title="Rojo"><input type="radio" name="vest" value="#C65E5E"><span style="--sw:#C65E5E"></span></label>
            </div></fieldset>

            <fieldset><legend>Casco · EPP obligatorio</legend><div class="v8-swatches v8-swatches--large">
              <label title="Amarillo seguridad"><input type="radio" name="helmet" value="#F3C83F" checked><span style="--sw:#F3C83F"></span></label>
              <label title="Blanco"><input type="radio" name="helmet" value="#E9EEF0"><span style="--sw:#E9EEF0"></span></label>
              <label title="Azul"><input type="radio" name="helmet" value="#2E8CC5"><span style="--sw:#2E8CC5"></span></label>
            </div></fieldset>

            <div class="v8-toggle-row">
              <label class="v8-toggle"><input id="v8-glasses" type="checkbox" checked><span></span><b>Gafas negras</b></label>
              <label class="v8-toggle"><input id="v8-gloves" type="checkbox" checked><span></span><b>Guantes</b></label>
            </div>
            <button type="submit">CONFIRMAR PERSONAJE <b>→</b></button>
          </form>
        </div>`;

      this.modal.classList.remove('is-hidden');
      const form = this.modal.querySelector<HTMLFormElement>('#v8-profile')!;
      const previewHost = this.modal.querySelector<HTMLElement>('#v8-hero-preview')!;
      const preview = new HeroCustomizerPreview(previewHost);

      const readRadio = (name: string): string =>
        this.modal.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)!.value;

      const readAppearance = (): HeroAppearance => {
        const base = readRadio('base') as HeroAppearance['base'];
        const hairStyle: HeroAppearance['hairStyle'] = base === 'rogue' ? 'side' : base === 'mage' ? 'wave' : 'short';
        return {
          base,
          build: 'standard',
          face: 'balanced',
          skin: readRadio('skin'),
          hair: readRadio('hair'),
          hairStyle,
          uniform: readRadio('uniform') as HeroAppearance['uniform'],
          topStyle: 'workshirt',
          pantsStyle: readRadio('pantsStyle') as HeroAppearance['pantsStyle'],
          bootStyle: readRadio('bootStyle') as HeroAppearance['bootStyle'],
          ppeStyle: readRadio('ppeStyle') as HeroAppearance['ppeStyle'],
          vest: readRadio('vest'),
          helmet: readRadio('helmet'),
          glasses: this.modal.querySelector<HTMLInputElement>('#v8-glasses')!.checked,
          gloves: this.modal.querySelector<HTMLInputElement>('#v8-gloves')!.checked
        };
      };

      let refreshTimer: number | null = null;
      const refresh = () => {
        if (refreshTimer !== null) window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => void preview.setAppearance(readAppearance()), 60);
      };
      form.querySelectorAll<HTMLInputElement>('input').forEach((input) => input.addEventListener('change', refresh));
      void preview.setAppearance(readAppearance());

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (refreshTimer !== null) window.clearTimeout(refreshTimer);
        const role = readRadio('role') as PlayerProfile['role'];
        const appearance = readAppearance();
        const profile: PlayerProfile = {
          name: this.modal.querySelector<HTMLInputElement>('#v8-name')!.value.trim() || 'Investigador',
          team: this.modal.querySelector<HTMLInputElement>('#v8-team')!.value.trim() || 'Equipo Aurora',
          role,
          accent: appearance.vest,
          appearance
        };
        preview.dispose();
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

  async chapterIntro(kicker: string, title: string, body: string): Promise<void> {
    return new Promise((resolve) => {
      this.modal.innerHTML = `<div class="v8-chapter"><small>${kicker}</small><div class="v8-chapter-line"></div><h2>${title}</h2><p>${body}</p><button id="v8-chapter-next">INICIAR SECTOR →</button></div>`;
      this.modal.classList.remove('is-hidden');
      const done = () => {
        window.removeEventListener('keydown', key);
        this.modal.classList.add('is-hidden');
        this.modal.innerHTML = '';
        resolve();
      };
      const key = (event: KeyboardEvent) => {
        if (event.code === 'Enter' || event.code === 'Space' || event.code === 'KeyE') done();
      };
      window.addEventListener('keydown', key);
      this.modal.querySelector('#v8-chapter-next')?.addEventListener('click', done, { once: true });
    });
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

  setPrompt(text: string | null, key = 'E'): void {
    if (!text) {
      this.prompt.classList.add('is-hidden');
      return;
    }
    this.prompt.innerHTML = `<kbd>${key}</kbd><span>${text}</span>`;
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
      const done = () => {
        window.removeEventListener('keydown', key);
        this.modal.classList.add('is-hidden');
        this.modal.innerHTML = '';
        resolve();
      };
      const key = (event: KeyboardEvent) => {
        if (event.code === 'Enter' || event.code === 'Space' || event.code === 'KeyE') done();
      };
      window.addEventListener('keydown', key);
      this.modal.querySelector('#v8-dialogue-next')?.addEventListener('click', done, { once: true });
    });
  }

  async showEvidence(title: string, subtitle: string, rows: Array<[string, string]>): Promise<void> {
    return new Promise((resolve) => {
      const table = rows.map(([label, value]) => `<div class="v8-evidence-row"><span>${label}</span><b>${value}</b></div>`).join('');
      this.modal.innerHTML = `<div class="v8-evidence"><small>EVIDENCIA DOCUMENTAL</small><h2>${title}</h2><p>${subtitle}</p><div class="v8-evidence-table">${table}</div><button id="v8-evidence-close">REGISTRAR EVIDENCIA →</button></div>`;
      this.modal.classList.remove('is-hidden');
      const done = () => {
        window.removeEventListener('keydown', key);
        this.modal.classList.add('is-hidden');
        this.modal.innerHTML = '';
        resolve();
      };
      const key = (event: KeyboardEvent) => {
        if (event.code === 'Enter' || event.code === 'Space' || event.code === 'KeyE') done();
      };
      window.addEventListener('keydown', key);
      this.modal.querySelector('#v8-evidence-close')?.addEventListener('click', done, { once: true });
    });
  }

  showMap(current: ZoneId): void {
    const zoneCards = Object.entries(ZONES)
      .map(([id, meta]) => `<div class="v8-map-zone ${id === current ? 'is-current' : ''}" style="--accent:${meta.accent}"><b>${meta.short}</b><small>${id === current ? 'UBICACIÓN ACTUAL' : 'SECTOR OPERATIVO'}</small></div>`)
      .join('');
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
