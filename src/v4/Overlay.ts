import type { V4Progress, V4Zone } from './types';

const ZONE_LABELS: Record<V4Zone, string> = {
  control: 'CONTROL DE CRISIS',
  warehouse: 'RECEPCIÓN / ALMACÉN',
  production: 'PRODUCCIÓN',
  quality: 'CALIDAD / METROLOGÍA',
  maintenance: 'MANTENIMIENTO / SST',
  dispatch: 'DESPACHO',
  capa: 'CAPA / MEJORA CONTINUA'
};

export class V4Overlay {
  private root: HTMLDivElement;
  private timer!: HTMLElement;
  private score!: HTMLElement;
  private errors!: HTMLElement;
  private zone!: HTMLElement;
  private objective!: HTMLElement;
  private detail!: HTMLElement;
  private prompt!: HTMLElement;
  private seals!: HTMLElement;
  private carry!: HTMLElement;
  private map!: HTMLDivElement;
  private result!: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'v4-ui';
    this.root.innerHTML = `
      <header class="v4-topbar">
        <div class="v4-brand"><span class="v4-mark">EI</span><div><strong>OPERACIÓN AURORA</strong><small>SIMULADOR DE CALIDAD · V4</small></div></div>
        <div class="v4-zone" id="v4-zone">CONTROL DE CRISIS</div>
        <div class="v4-stats">
          <div><span>TIEMPO</span><b id="v4-time">55:00</b></div>
          <div><span>PUNTOS</span><b id="v4-score">0000</b></div>
          <div><span>ERRORES</span><b id="v4-errors">0</b></div>
          <div><span>SELLOS</span><b id="v4-seals">0/5</b></div>
        </div>
      </header>
      <aside class="v4-quest">
        <span>OBJETIVO ACTUAL</span>
        <h2 id="v4-objective">Esperando briefing...</h2>
        <p id="v4-detail"></p>
      </aside>
      <div class="v4-carry is-hidden" id="v4-carry"></div>
      <div class="v4-prompt is-hidden" id="v4-prompt"></div>
      <div class="v4-help"><kbd>WASD</kbd> MOVER · <kbd>SHIFT</kbd> CORRER · <kbd>E</kbd> INTERACTUAR / TOMAR / COLOCAR · <kbd>Q</kbd> PLANO · <kbd>M</kbd> AUDIO</div>
      <section class="v4-map is-hidden" id="v4-map">
        <div class="v4-map-card">
          <div class="v4-map-title"><span>PLANO OPERATIVO</span><button data-close-map>×</button></div>
          <div class="v4-campus-map">
            <div class="v4-road v4-road-a"></div><div class="v4-road v4-road-b"></div>
            <button data-zone="warehouse" style="--x:8%;--y:37%">ALMACÉN</button>
            <button data-zone="production" style="--x:31%;--y:77%">PRODUCCIÓN</button>
            <button data-zone="control" style="--x:45%;--y:43%">CONTROL</button>
            <button data-zone="quality" style="--x:71%;--y:68%">CALIDAD</button>
            <button data-zone="maintenance" style="--x:80%;--y:30%">MANTENIMIENTO</button>
            <button data-zone="dispatch" style="--x:49%;--y:8%">DESPACHO</button>
            <button data-zone="capa" style="--x:84%;--y:7%">CAPA</button>
            <i id="v4-map-player"></i>
          </div>
          <p>El mapa no marca una única ruta correcta. Las herramientas y los sellos de evidencia determinan qué mecanismos puedes resolver.</p>
        </div>
      </section>
      <section class="v4-result is-hidden" id="v4-result"></section>
    `;
    parent.appendChild(this.root);
    this.timer = this.root.querySelector('#v4-time')!;
    this.score = this.root.querySelector('#v4-score')!;
    this.errors = this.root.querySelector('#v4-errors')!;
    this.zone = this.root.querySelector('#v4-zone')!;
    this.objective = this.root.querySelector('#v4-objective')!;
    this.detail = this.root.querySelector('#v4-detail')!;
    this.prompt = this.root.querySelector('#v4-prompt')!;
    this.seals = this.root.querySelector('#v4-seals')!;
    this.carry = this.root.querySelector('#v4-carry')!;
    this.map = this.root.querySelector('#v4-map')!;
    this.result = this.root.querySelector('#v4-result')!;
    this.root.querySelector('[data-close-map]')?.addEventListener('click', () => this.hideMap());
  }

  update(progress: V4Progress, carriedLabel: string | null): void {
    const sec = Math.max(0, Math.floor(progress.remainingSeconds));
    this.timer.textContent = `${Math.floor(sec / 60).toString().padStart(2,'0')}:${(sec % 60).toString().padStart(2,'0')}`;
    this.timer.classList.toggle('danger', sec <= 300);
    this.score.textContent = Math.floor(progress.score).toString().padStart(4,'0');
    this.errors.textContent = String(progress.errors);
    this.seals.textContent = `${Math.min(5, progress.qualitySeals.size)}/5`;
    this.zone.textContent = ZONE_LABELS[progress.zone];
    this.objective.textContent = progress.objective;
    this.detail.textContent = progress.objectiveDetail;
    if (carriedLabel) {
      this.carry.innerHTML = `<span>TRANSPORTANDO</span><strong>${carriedLabel}</strong><small>Busca una estación compatible y pulsa E.</small>`;
      this.carry.classList.remove('is-hidden');
    } else this.carry.classList.add('is-hidden');
    this.root.querySelectorAll<HTMLElement>('[data-zone]').forEach((node) => node.classList.toggle('done', progress.qualitySeals.has(node.dataset.zone ?? '')));
    const player = this.root.querySelector<HTMLElement>('#v4-map-player');
    const coords: Record<V4Zone,[number,number]> = { warehouse:[13,43], production:[34,78], control:[48,49], quality:[72,69], maintenance:[81,34], dispatch:[52,13], capa:[85,12] };
    const [x,y] = coords[progress.zone];
    if (player) { player.style.left=`${x}%`; player.style.top=`${y}%`; }
  }

  setPrompt(label: string | null): void {
    if (!label) { this.prompt.classList.add('is-hidden'); return; }
    this.prompt.innerHTML = `<kbd>E</kbd><strong>${label}</strong>`;
    this.prompt.classList.remove('is-hidden');
  }

  toggleMap(): void { this.map.classList.toggle('is-hidden'); }
  hideMap(): void { this.map.classList.add('is-hidden'); }
  isMapOpen(): boolean { return !this.map.classList.contains('is-hidden'); }

  showZoneBanner(zone: V4Zone): void {
    const banner = document.createElement('div');
    banner.className='v4-zone-banner';
    banner.innerHTML=`<span>NUEVA ZONA</span><strong>${ZONE_LABELS[zone]}</strong>`;
    this.root.appendChild(banner);
    requestAnimationFrame(()=>banner.classList.add('show'));
    window.setTimeout(()=>{banner.classList.remove('show'); window.setTimeout(()=>banner.remove(),500);},2200);
  }

  showResult(progress: V4Progress, title: string, body: string): void {
    const used = Math.max(0, 55*60 - progress.remainingSeconds);
    const min=Math.floor(used/60); const sec=Math.floor(used%60);
    this.result.innerHTML=`
      <div class="v4-result-card">
        <span>OPERACIÓN AURORA · INFORME FINAL</span>
        <h1>${title}</h1>
        <p>${body}</p>
        <div><b>${progress.score}</b><small>PUNTOS</small></div>
        <div><b>${progress.errors}</b><small>ERRORES</small></div>
        <div><b>${min}:${sec.toString().padStart(2,'0')}</b><small>TIEMPO</small></div>
        <div><b>${progress.qualitySeals.size}</b><small>SELLOS</small></div>
        <button onclick="location.reload()">REINICIAR SIMULACIÓN</button>
      </div>`;
    this.result.classList.remove('is-hidden');
  }
}
