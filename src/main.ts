import './styles.css';
import { Game } from './game/Game';
import { GameMasterApp } from './game/Multiplayer';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('No se encontró #app');

const params = new URLSearchParams(window.location.search);
const app = params.get('gm') === '1' ? new GameMasterApp(root) : new Game(root);

app.boot().catch((error) => {
  console.error(error);
  root.innerHTML = `
    <div class="fatal-error">
      <span class="mission-tag">ERROR DE ARRANQUE</span>
      <h1>No se pudo iniciar la misión</h1>
      <p>${String(error)}</p>
    </div>`;
});
