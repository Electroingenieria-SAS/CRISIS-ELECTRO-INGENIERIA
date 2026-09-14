import './styles.css';
import './v8/styles.css';
import './v8/warehouse.css';
import { GameMasterApp } from './game/Multiplayer';
import { CrisisGameV8 } from './v8/Game';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('No se encontró #app');

const params = new URLSearchParams(window.location.search);
const app = params.get('gm') === '1' ? new GameMasterApp(root) : new CrisisGameV8(root);

app.boot().catch((error) => {
  console.error(error);
  root.innerHTML = `
    <div class="fatal-error">
      <span class="mission-tag">ERROR DE ARRANQUE</span>
      <h1>No se pudo iniciar Operación Aurora</h1>
      <p>${String(error)}</p>
    </div>`;
});