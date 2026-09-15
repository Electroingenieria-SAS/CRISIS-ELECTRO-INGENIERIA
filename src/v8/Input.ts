export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private pointerDown = false;
  private pointerDx = 0;
  private pointerDy = 0;
  private wheel = 0;
  private disposed = false;

  constructor(private element: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    element.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointermove', this.onPointerMove);
    element.addEventListener('wheel', this.onWheel, { passive: false });
    element.addEventListener('contextmenu', this.onContextMenu);
  }

  isDown(...codes: string[]): boolean {
    return codes.some((code) => this.down.has(code));
  }

  consume(...codes: string[]): boolean {
    for (const code of codes) {
      if (this.pressed.delete(code)) return true;
    }
    return false;
  }

  consumePointer(): { x: number; y: number } {
    const delta = { x: this.pointerDx, y: this.pointerDy };
    this.pointerDx = 0;
    this.pointerDy = 0;
    return delta;
  }

  consumeWheel(): number {
    const value = this.wheel;
    this.wheel = 0;
    return value;
  }

  endFrame(): void {
    this.pressed.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointermove', this.onPointerMove);
    this.element.removeEventListener('wheel', this.onWheel);
    this.element.removeEventListener('contextmenu', this.onContextMenu);
    this.down.clear();
    this.pressed.clear();
  }

  private editable(): boolean {
    const element = document.activeElement as HTMLElement | null;
    if (!element) return false;
    return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT' || element.isContentEditable;
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.editable()) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(event.code)) event.preventDefault();
    if (!this.down.has(event.code)) this.pressed.add(event.code);
    this.down.add(event.code);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.down.delete(event.code);
  };

  private onPointerDown = (event: PointerEvent): void => {
    if (event.button === 0 || event.button === 2) this.pointerDown = true;
  };

  private onPointerUp = (): void => {
    this.pointerDown = false;
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.pointerDown) return;
    this.pointerDx += event.movementX;
    this.pointerDy += event.movementY;
  };

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.wheel += event.deltaY;
  };

  private onContextMenu = (event: Event): void => {
    event.preventDefault();
  };
}
