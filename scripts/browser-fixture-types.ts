/** DOM shims implemented inside each serialized synthetic browser fixture. */
interface FixtureElementOptions {
  cls?: string;
  text?: string;
  attr?: Record<string, string>;
}
interface FixtureBrain {
  nodes: unknown[];
  edges: unknown[];
  projected: Array<{ depth: number; x: number; y: number }>;
  visibleLabels: unknown[];
  yaw: number;
  zoom: number;
  panX: number;
  canvas: HTMLCanvasElement;
  selected: unknown;
  hovered: unknown;
  ctx: CanvasRenderingContext2D | null;
  draw(): void;
  onOpen(): Promise<void>;
  onClose(): void;
}
interface FixtureHomeView {
  activeScreen: string;
  itemLimit: number;
  previewBrain: FixtureBrain;
  embeddedBrain: FixtureBrain;
  visualOptions: Record<string, unknown>;
  render(): void;
  onOpen(): Promise<void>;
  onClose(): void;
}
declare global {
  interface HTMLElement {
    empty(): void;
    addClass(...names: string[]): void;
    setText(text: string): void;
    createEl<K extends keyof HTMLElementTagNameMap>(tag: K, options?: FixtureElementOptions): HTMLElementTagNameMap[K];
    createDiv(options?: FixtureElementOptions): HTMLDivElement;
    createSpan(options?: FixtureElementOptions): HTMLSpanElement;
  }
  interface Window {
    brain: FixtureBrain;
    view: FixtureHomeView;
    previousBrain: FixtureBrain;
    previousPreview: FixtureBrain;
    openedNotes: string[];
    graphCommands: string[];
    commands: string[];
    opened: Array<{ path: string; options?: { eState?: { line: number } } }>;
    drawCount: number;
  }
}
export {};
