import './styles.css';
import { Game } from './game/Game';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('No se encontró #app');

const game = new Game(root);
game.boot().catch((error) => {
  console.error(error);
  root.innerHTML = `
    <div class="fatal-error">
      <h1>No se pudo iniciar la misión</h1>
      <p>${String(error)}</p>
    </div>`;
});
