export class Input {
  private held = new Set<string>();
  private pressed = new Set<string>();

  constructor() {
    window.addEventListener('keydown', (event) => {
      const code = event.code;
      if (!this.held.has(code)) this.pressed.add(code);
      this.held.add(code);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(code)) {
        event.preventDefault();
      }
    });

    window.addEventListener('keyup', (event) => {
      this.held.delete(event.code);
    });

    window.addEventListener('blur', () => {
      this.held.clear();
      this.pressed.clear();
    });
  }

  isDown(...codes: string[]): boolean {
    return codes.some((code) => this.held.has(code));
  }

  consumePress(...codes: string[]): boolean {
    for (const code of codes) {
      if (this.pressed.has(code)) {
        this.pressed.delete(code);
        return true;
      }
    }
    return false;
  }

  endFrame(): void {
    this.pressed.clear();
  }
}
