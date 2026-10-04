import type { TFile } from "obsidian";
export interface Templater {
  file: { title: string }; config: { target_file: TFile };
  date: { now(format: string, offset?: number, reference?: string, inputFormat?: string): string };
  system: { prompt(question: string, initial?: string): Promise<string | null>;
    suggester<T>(labels: string[], values: T[], throwOnCancel: boolean, placeholder: string): Promise<T | null> };
}
export interface Page {
  quarter?: string; daily_folder?: string;
  file: { name: string; path: string; link: unknown;
    lists: Array<{section?: {subpath: string}; text: string}> };
}
export interface Pages extends Iterable<Page> {
  length: number; where(fn: (p: Page) => boolean): Pages; sort(fn: (p: Page) => string, direction?: string): Pages;
}
export interface Dataview {
  current(): Page; page(path: string): Page | undefined; pages(query: string): Pages;
  paragraph(text: string): void; header(level: number, text: string): void; list(items: string[]): void;
  view(path: string, input?: Record<string, unknown>): Promise<void>;
}
