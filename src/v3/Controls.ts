export class Controls {
  private held = new Set<string>();
  private pressed = new Set<string>();
  private pointerDragging = false;
  private deltaX = 0;
  private deltaY = 0;
  private wheelDelta = 0;

  constructor(private element: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.element.addEventListener('contextmenu', (event) => event.preventDefault());
    this.element.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointermove', this.onPointerMove);
    this.element.addEventListener('wheel', this.onWheel, { passive: false });
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

  consumePointerDelta(): { x: number; y: number } {
    const result = { x: this.deltaX, y: this.deltaY };
    this.deltaX = 0;
    this.deltaY = 0;
    return result;
  }

  consumeWheel(): number {
    const value = this.wheelDelta;
    this.wheelDelta = 0;
    return value;
  }

  endFrame(): void {
    this.pressed.clear();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointermove', this.onPointerMove);
    this.element.removeEventListener('wheel', this.onWheel);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.held.has(event.code)) this.pressed.add(event.code);
    this.held.add(event.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.held.delete(event.code);
  };

  private onBlur = (): void => {
    this.held.clear();
    this.pressed.clear();
    this.pointerDragging = false;
  };

  private onPointerDown = (event: PointerEvent): void => {
    if (event.button === 2 || event.button === 0) {
      this.pointerDragging = true;
      this.element.setPointerCapture?.(event.pointerId);
    }
  };

  private onPointerUp = (): void => {
    this.pointerDragging = false;
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.pointerDragging) return;
    this.deltaX += event.movementX;
    this.deltaY += event.movementY;
  };

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.wheelDelta += event.deltaY;
  };
}
