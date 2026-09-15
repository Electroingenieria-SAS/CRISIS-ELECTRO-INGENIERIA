import { ROLE_META, ZONE_META } from './content';
import type { Choice, DialogueLine, GameProgress, InventoryItem, PlayerProfile, RoleId, ZoneId } from './types';

export class AdventureUI {
  readonly root: HTMLElement;
  readonly layer: HTMLDivElement;
  private hud!: HTMLDivElement;
  private zoneLabel!: HTMLElement;
  private timer!: HTMLElement;
  private score!: HTMLElement;
  private errors!: HTMLElement;
  private objective!: HTMLElement;
  private objectiveDetail!: HTMLElement;
  private interaction!: HTMLElement;
  private toast!: HTMLElement;
  private modal!: HTMLElement;
  private inventoryPanel!: HTMLElement;
  private mapPanel!: HTMLElement;
  private toastHandle: number | null = null;
  private profile: PlayerProfile | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.layer = document.createElement('div');
    this.layer.className = 'adv-ui';
    this.layer.innerHTML = `
      <div class="adv-hud" id="adv-hud">
        <div class="adv-brand">
          <div class="adv-brand-mark"><span>EI</span></div>
          <div><strong>CRISIS</strong><small>PROTOCOLO DE CALIDAD</small></div>
        </div>
        <div class="adv-zone" id="adv-zone">CENTRO DE CONTROL</div>
        <div class="adv-metrics">
          <div><span>TIEMPO</span><strong id="adv-timer">45:00</strong></div>
          <div><span>PUNTAJE</span><strong id="adv-score">0000</strong></div>
          <div><span>ERRORES</span><strong id="adv-errors">0</strong></div>
        </div>
      </div>

      <div class="adv-quest-card">
        <span class="adv-eyebrow">MISIÓN ACTIVA</span>
        <strong id="adv-objective">Esperando asignación...</strong>
        <p id="adv-objective-detail"></p>
      </div>

      <div class="adv-controls">
        <span><kbd>WASD</kbd> mover</span>
        <span><kbd>SHIFT</kbd> correr</span>
        <span><kbd>E</kbd> interactuar</span>
        <span><kbd>I</kbd> mochila</span>
        <span><kbd>Q</kbd> mapa</span>
        <span><kbd>ARRASTRAR</kbd> cámara</span>
      </div>

      <div id="adv-interaction" class="adv-interaction is-hidden"></div>
      <div id="adv-toast" class="adv-toast is-hidden"></div>
      <div id="adv-modal" class="adv-modal is-hidden"></div>
      <div id="adv-inventory" class="adv-sidepanel is-hidden"></div>
      <div id="adv-map" class="adv-map is-hidden"></div>
    `;
    root.appendChild(this.layer);

    this.hud = this.layer.querySelector('#adv-hud')!;
    this.zoneLabel = this.layer.querySelector('#adv-zone')!;
    this.timer = this.layer.querySelector('#adv-timer')!;
    this.score = this.layer.querySelector('#adv-score')!;
    this.errors = this.layer.querySelector('#adv-errors')!;
    this.objective = this.layer.querySelector('#adv-objective')!;
    this.objectiveDetail = this.layer.querySelector('#adv-objective-detail')!;
    this.interaction = this.layer.querySelector('#adv-interaction')!;
    this.toast = this.layer.querySelector('#adv-toast')!;
    this.modal = this.layer.querySelector('#adv-modal')!;
    this.inventoryPanel = this.layer.querySelector('#adv-inventory')!;
    this.mapPanel = this.layer.querySelector('#adv-map')!;
  }

  async createProfile(): Promise<PlayerProfile> {
    this.hud.classList.add('is-dimmed');
    const saved = this.loadProfile();
    return new Promise((resolve) => {
      this.modal.innerHTML = `
        <div class="adv-onboarding">
          <div class="adv-onboarding-art">
            <div class="adv-grid-glow"></div>
            <div class="adv-ei-seal"><span>EI</span><small>SIMULADOR OPERATIVO</small></div>
            <div class="adv-onboarding-copy">
              <span class="adv-eyebrow">INCIDENTE NC-26-0914</span>
              <h1>CRISIS EN<br><em>ELECTROINGENIERÍA</em></h1>
              <p>Una simulación de investigación en planta. Recorre las áreas, habla con el personal, contrasta documentos y demuestra la causa raíz con evidencia.</p>
            </div>
          </div>
          <form class="adv-profile" id="adv-profile-form">
            <div>
              <span class="adv-eyebrow">IDENTIFICACIÓN</span>
              <h2>Configura tu investigador</h2>
            </div>
            <label>Nombre
              <input id="adv-name" maxlength="28" autocomplete="name" value="${saved?.name ?? ''}" placeholder="Tu nombre" required />
            </label>
            <div class="adv-form-row">
              <label>Equipo
                <input id="adv-team" maxlength="22" value="${saved?.team ?? 'Equipo Azul'}" required />
              </label>
              <label>Indicativo
                <input id="adv-callsign" maxlength="14" value="${saved?.callsign ?? 'ALFA-01'}" required />
              </label>
            </div>
            <div>
              <span class="adv-field-label">ESPECIALIZACIÓN</span>
              <div class="adv-role-grid">
                ${(['inspector', 'analyst', 'engineer'] as RoleId[]).map((role) => {
                  const meta = ROLE_META[role];
                  const checked = (saved?.role ?? 'analyst') === role ? 'checked' : '';
                  return `<label class="adv-role-card"><input type="radio" name="adv-role" value="${role}" ${checked}/><span class="adv-role-icon">${role === 'inspector' ? '⌖' : role === 'analyst' ? '◇' : '⚙'}</span><strong>${meta.title}</strong><small>${meta.subtitle}</small><p>${meta.perk}</p></label>`;
                }).join('')}
              </div>
            </div>
            <div>
              <span class="adv-field-label">COLOR DE EQUIPO</span>
              <div class="adv-color-row">
                ${['#0B5EA8', '#F4C542', '#55B985', '#9B72E5', '#DB5A5A'].map((color, i) => `<label class="adv-color" style="--swatch:${color}"><input type="radio" name="adv-color" value="${color}" ${(saved?.color ?? '#0B5EA8') === color || (!saved && i === 0) ? 'checked' : ''}/><span></span></label>`).join('')}
              </div>
            </div>
            <button class="adv-primary" type="submit"><span>ENTRAR A LA PLANTA</span><b>→</b></button>
            <p class="adv-profile-note">Entrenamiento interno · La puntuación premia evidencia, no velocidad ciega.</p>
          </form>
        </div>`;
      this.modal.classList.remove('is-hidden');
      const form = this.modal.querySelector<HTMLFormElement>('#adv-profile-form')!;
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const role = this.modal.querySelector<HTMLInputElement>('input[name="adv-role"]:checked')!.value as RoleId;
        const color = this.modal.querySelector<HTMLInputElement>('input[name="adv-color"]:checked')!.value;
        const profile: PlayerProfile = {
          name: this.modal.querySelector<HTMLInputElement>('#adv-name')!.value.trim(),
          team: this.modal.querySelector<HTMLInputElement>('#adv-team')!.value.trim(),
          callsign: this.modal.querySelector<HTMLInputElement>('#adv-callsign')!.value.trim().toUpperCase(),
          role,
          color
        };
        this.profile = profile;
        localStorage.setItem('crisis-ei-profile-v3', JSON.stringify(profile));
        this.modal.classList.add('is-hidden');
        this.modal.innerHTML = '';
        this.hud.classList.remove('is-dimmed');
        resolve(profile);
      }, { once: true });
    });
  }

  update(progress: GameProgress): void {
    const seconds = Math.max(0, Math.floor(progress.remainingSeconds));
    const min = Math.floor(seconds / 60).toString().padStart(2, '0');
    const sec = (seconds % 60).toString().padStart(2, '0');
    this.timer.textContent = `${min}:${sec}`;
    this.timer.classList.toggle('is-danger', seconds <= 300);
    this.score.textContent = Math.max(0, Math.floor(progress.score)).toString().padStart(4, '0');
    this.errors.textContent = String(progress.errors);
    this.setZone(progress.zone);
  }

  setZone(zone: ZoneId): void {
    const meta = ZONE_META[zone];
    this.zoneLabel.textContent = meta.short;
    this.zoneLabel.style.setProperty('--zone-accent', meta.accent);
  }

  setObjective(title: string, detail: string): void {
    this.objective.textContent = title;
    this.objectiveDetail.textContent = detail;
    const card = this.objective.closest('.adv-quest-card');
    card?.classList.remove('is-pulsing');
    requestAnimationFrame(() => card?.classList.add('is-pulsing'));
    window.setTimeout(() => card?.classList.remove('is-pulsing'), 700);
  }

  setInteraction(label: string | null): void {
    if (!label) {
      this.interaction.classList.add('is-hidden');
      return;
    }
    this.interaction.innerHTML = `<kbd>E</kbd><span>${label}</span>`;
    this.interaction.classList.remove('is-hidden');
  }

  showToast(title: string, body = '', kind: 'normal' | 'success' | 'danger' = 'normal'): void {
    if (this.toastHandle !== null) window.clearTimeout(this.toastHandle);
    this.toast.className = `adv-toast adv-toast--${kind}`;
    this.toast.innerHTML = `<span class="adv-toast-icon">${kind === 'success' ? '✓' : kind === 'danger' ? '!' : '•'}</span><div><strong>${title}</strong>${body ? `<p>${body}</p>` : ''}</div>`;
    this.toast.classList.remove('is-hidden');
    this.toastHandle = window.setTimeout(() => this.toast.classList.add('is-hidden'), 4200);
  }

  async dialogue(lines: DialogueLine[]): Promise<void> {
    for (const line of lines) {
      await new Promise<void>((resolve) => {
        this.modal.innerHTML = `
          <div class="adv-dialogue adv-dialogue--${line.tone ?? 'normal'}">
            <div class="adv-dialogue-avatar"><span>${line.speaker.slice(0, 1)}</span></div>
            <div class="adv-dialogue-body">
              <div class="adv-dialogue-meta"><strong>${line.speaker}</strong>${line.role ? `<span>${line.role}</span>` : ''}</div>
              <p>${line.text}</p>
              <div class="adv-dialogue-footer"><span>ENTER / CLIC PARA CONTINUAR</span><button class="adv-dialogue-next">→</button></div>
            </div>
          </div>`;
        this.modal.classList.remove('is-hidden');
        const close = () => {
          window.removeEventListener('keydown', keyHandler);
          this.modal.classList.add('is-hidden');
          resolve();
        };
        const keyHandler = (event: KeyboardEvent) => {
          if (event.code === 'Enter' || event.code === 'Space' || event.code === 'KeyE') close();
        };
        window.addEventListener('keydown', keyHandler);
        this.modal.querySelector('.adv-dialogue-next')?.addEventListener('click', close, { once: true });
      });
    }
    this.modal.innerHTML = '';
  }

  choose(title: string, context: string, choices: Choice[], kicker = 'ANÁLISIS'): Promise<string> {
    return new Promise((resolve) => {
      this.modal.innerHTML = `
        <div class="adv-terminal">
          <div class="adv-terminal-bar"><span>EI // ${kicker}</span><i></i><i></i><i></i></div>
          <div class="adv-terminal-content">
            <span class="adv-eyebrow">${kicker}</span>
            <h2>${title}</h2>
            <p class="adv-terminal-context">${context}</p>
            <div class="adv-choice-grid">
              ${choices.map((choice, index) => `<button data-choice="${choice.id}" class="adv-choice"><b>${String(index + 1).padStart(2, '0')}</b><span><strong>${choice.text}</strong>${choice.detail ? `<small>${choice.detail}</small>` : ''}</span></button>`).join('')}
            </div>
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

  inspectDocument(item: InventoryItem, rows: Array<[string, string]>): Promise<void> {
    return new Promise((resolve) => {
      this.modal.innerHTML = `
        <div class="adv-document">
          <div class="adv-document-top"><div><span>DOCUMENTO CONTROLADO</span><strong>ELECTROINGENIERÍA S.A.S.</strong></div><button class="adv-close">×</button></div>
          <div class="adv-document-title"><span>${item.category.toUpperCase()}</span><h2>${item.title}</h2><b>${item.code ?? ''}</b></div>
          <div class="adv-document-table">${rows.map(([a, b]) => `<div><span>${a}</span><strong>${b}</strong></div>`).join('')}</div>
          <div class="adv-document-finding"><span>LECTURA DEL INVESTIGADOR</span><p>${item.description}</p></div>
          <button class="adv-primary adv-close">REGISTRAR EN EXPEDIENTE</button>
        </div>`;
      this.modal.classList.remove('is-hidden');
      const close = () => {
        this.modal.classList.add('is-hidden');
        this.modal.innerHTML = '';
        resolve();
      };
      this.modal.querySelectorAll('.adv-close').forEach((node) => node.addEventListener('click', close, { once: true }));
    });
  }

  toggleInventory(progress: GameProgress): void {
    if (!this.inventoryPanel.classList.contains('is-hidden')) {
      this.inventoryPanel.classList.add('is-hidden');
      return;
    }
    const items = Array.from(progress.inventory.values());
    this.inventoryPanel.innerHTML = `
      <div class="adv-sidepanel-head"><div><span class="adv-eyebrow">EXPEDIENTE</span><h2>Mochila de investigación</h2></div><span>${items.length} OBJETOS</span></div>
      <div class="adv-inventory-list">
        ${items.length ? items.map((item) => `<article><div class="adv-item-icon">${item.category === 'document' ? '▤' : item.category === 'evidence' ? '⌖' : item.category === 'tool' ? '⌁' : item.category === 'key' ? '◆' : '◇'}</div><div><span>${item.category}</span><strong>${item.title}</strong><p>${item.description}</p>${item.code ? `<small>${item.code}</small>` : ''}</div></article>`).join('') : '<div class="adv-empty">Aún no has registrado evidencia.</div>'}
      </div>`;
    this.inventoryPanel.classList.remove('is-hidden');
    this.mapPanel.classList.add('is-hidden');
  }

  toggleMap(progress: GameProgress): void {
    if (!this.mapPanel.classList.contains('is-hidden')) {
      this.mapPanel.classList.add('is-hidden');
      return;
    }
    const order: ZoneId[] = ['control', 'warehouse', 'production', 'quality', 'dispatch', 'capa'];
    const currentIndex = order.indexOf(progress.zone);
    this.mapPanel.innerHTML = `
      <div class="adv-map-head"><span class="adv-eyebrow">PLANO OPERATIVO</span><strong>RUTA DE INVESTIGACIÓN</strong></div>
      <div class="adv-map-route">
        ${order.map((zone, index) => {
          const meta = ZONE_META[zone];
          const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'locked';
          return `<div class="adv-map-node adv-map-node--${state}" style="--accent:${meta.accent}"><i>${index < currentIndex ? '✓' : index + 1}</i><span>${meta.short}</span></div>${index < order.length - 1 ? '<b></b>' : ''}`;
        }).join('')}
      </div>
      <p>${progress.objectiveDetail}</p>`;
    this.mapPanel.classList.remove('is-hidden');
    this.inventoryPanel.classList.add('is-hidden');
  }

  closePanels(): void {
    this.inventoryPanel.classList.add('is-hidden');
    this.mapPanel.classList.add('is-hidden');
  }

  isModalOpen(): boolean {
    return !this.modal.classList.contains('is-hidden');
  }

  showResult(progress: GameProgress, title: string, body: string): void {
    const elapsed = progress.startedAt && progress.completedAt ? (progress.completedAt - progress.startedAt) / 1000 : 0;
    const min = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const sec = Math.floor(elapsed % 60).toString().padStart(2, '0');
    this.modal.innerHTML = `
      <div class="adv-result">
        <div class="adv-result-ring">✓</div>
        <span class="adv-eyebrow">INCIDENTE NC-26-0914 · CERRADO</span>
        <h1>${title}</h1>
        <p>${body}</p>
        <div class="adv-result-stats">
          <div><span>TIEMPO</span><strong>${min}:${sec}</strong></div>
          <div><span>PUNTAJE</span><strong>${Math.max(0, Math.floor(progress.score))}</strong></div>
          <div><span>ERRORES</span><strong>${progress.errors}</strong></div>
          <div><span>EVIDENCIAS</span><strong>${progress.evidence.size}</strong></div>
        </div>
        <button class="adv-primary" onclick="location.reload()">NUEVA INVESTIGACIÓN</button>
      </div>`;
    this.modal.classList.remove('is-hidden');
  }

  private loadProfile(): PlayerProfile | null {
    try {
      const value = localStorage.getItem('crisis-ei-profile-v3');
      return value ? JSON.parse(value) as PlayerProfile : null;
    } catch {
      return null;
    }
  }
}
