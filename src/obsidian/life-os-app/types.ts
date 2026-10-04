import type { App, Editor } from "obsidian";

export interface Action { icon: string; label: string; description: string; command?: string; path?: string }
export interface ButtonOptions extends Action { primary?: boolean; onClick: () => unknown }
export interface CollectionOptions { title: string; description: string; types: string[]; icon: string; empty: string }
export interface ModuleDefinition { eyebrow: string; title: string; description: string; actions: Action[] }
export interface Frontmatter { [key: string]: unknown; questions?: Array<{ key?: string; text?: string }>; habits?: string[]; dq_prefix?: string; habit_prefix?: string; wheel_prefix?: string }
export interface Task { text: string; due: string; scheduled: string; overdue: boolean; dueToday: boolean; scheduledToday: boolean; high: boolean; discuss: boolean; path: string; line: number }
export interface TaskSnapshot { tasks: Task[]; error: string; state: "ready" | "partial" | "unavailable"; skipped: number; missingMetadata: number; unresolvedStatuses: number; malformedItems: number; examplesExcluded: number; candidateFiles: number }
export interface TodayRow { label: string; complete: boolean; display: string }
export interface AnalyticsDay { date: string; data: Frontmatter | null; score: number | null }
export type Point2 = [number, number];
export type Point3 = [number, number, number];
export interface BrainGeometry { faces: Point3[][]; lines: Array<{ points: Point3[]; alpha: number }> }
export interface BrainNode { path: string; title: string; region: string; sample: boolean; point: Point3; degree: number }
export interface Projection { x: number; y: number; depth: number; scale: number }
export interface ProjectedNode extends Projection { node: BrainNode }
// Obsidian's plugin and command registries are runtime APIs outside its public declarations.
// Settings remain unknown data and are narrowed by each consumer before use.
export type RuntimeApp = App & { commands: { executeCommandById(id: string): boolean }; plugins?: { getPlugin?(id: string): { settings?: Record<string, unknown> } | null } };
export type EditorView = { editor?: Editor };
