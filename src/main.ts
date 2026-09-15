import './styles.css';
import './v8/styles.css';
import './v8/warehouse.css';
import { GameMasterApp } from './game/Multiplayer';
import { CrisisGameV8 } from './v8/Game';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('No se encontró #app');

const params = new URLSearchParams(window.location.search);
const app = params.get('gm') === '1' ? new GameMasterApp(root) : new CrisisGameV8(root);

// Opt-in browser-test bridge. It is never exposed during ordinary gameplay and
// does not bypass any gameplay system: Playwright still drives the same keyboard,
// animation, collision, physics and interaction paths after deterministic setup.
if (params.get('v9e2e') === '1') {
  Object.defineProperty(window, '__V9_APP__', {
    value: app,
    configurable: true,
    enumerable: false,
    writable: false
  });
}

app.boot().catch((error) => {
  console.error(error);
  root.innerHTML = `
    <div class="fatal-error">
      <span class="mission-tag">ERROR DE ARRANQUE</span>
      <h1>No se pudo iniciar Operación Aurora</h1>
      <p>${String(error)}</p>
    </div>`;
});
