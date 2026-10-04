import type { App } from "obsidian";
export interface ViewInput { days?: number; from?: string; to?: string; week?: string; page?: string; folder?: string; compact?: boolean }
export interface Page {
  file: { name: string; path: string; frontmatter?: Record<string, unknown>; link: unknown; lists: Array<{ text: string; section?: { subpath: string } }>; tasks?: Iterable<{ tags?: string[]; completed: boolean }> };
  type?: string; area?: string; due?: string; projects_folder?: string;
  daily_folder?: string; weekly_folder?: string; quarterly_folder?: string; retreat_folder?: string;
  dq_prefix?: string; habit_prefix?: string; wheel_prefix?: string; board_done_lanes?: string;
  birthdate?: unknown; life_expectancy?: number; questions?: unknown[]; habits?: string[];
  status?: string; tags?: string[]; example?: boolean; quarter?: string;
  setup_agent_chat?: boolean; setup_claude_login?: boolean; setup_mcp_registered?: boolean; setup_vault_lens?: boolean; setup_backup?: boolean;
}
export interface DataArray<T> { length: number; where(fn: (page: T) => boolean): DataArray<T>; sort(fn: (page: T) => string, direction?: string): DataArray<T>; array(): T[] }
export interface Dataview { page(path: string): Page | undefined; pages(query?: string): DataArray<Page>; view(path: string, input?: ViewInput): Promise<void>; current(): Page | undefined; container: HTMLElement; table(headers: string[], rows: unknown[][]): void; paragraph(value: string): void; fileLink(path: string, embed: boolean, text: string): unknown }
export interface PluginSettings {
  enableDataviewJs?: boolean; daily?: { folder?: string; template?: string }; trigger_on_file_creation?: boolean;
  trigger_on_file_creation_mode?: string; choices?: Array<{ name?: string; id: string; command?: boolean }>;
}
export type HostApp = App & {
  commands: { executeCommandById(id: string): boolean; findCommand(id: string): unknown };
  plugins: { enabledPlugins: Set<string>; plugins: Record<string, { settings?: PluginSettings } | undefined> };
  customCss: { enabledSnippets: Set<string> };
  hotkeyManager: { customKeys: Record<string, unknown[]> };
  internalPlugins: { plugins: { webviewer?: { enabled?: boolean } } };
};
