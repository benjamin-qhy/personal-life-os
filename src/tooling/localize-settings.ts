import paths from "../../scripts/template/chinese-paths.json";

// Only used on allowlisted candidate settings, never on user note contents or
// third-party JavaScript. The installed .obsidian tree remains unchanged.
const replacements = [...paths.files.filter(row => !row.from.startsWith("scripts/")), ...paths.directories]
  .sort((a, b) => b.from.length - a.from.length);
function pathText(value: string): string {
  for (const { from, to } of replacements) {
    value = value.replaceAll(from, to);
    if (from.endsWith(".md")) value = value.replaceAll(from.slice(0, -3), to.slice(0, -3));
  }
  return value.replaceAll("Personal Retreat", "个人静修");
}
export function localizeSettings<T>(value: T): T {
  if (typeof value === "string") return pathText(value) as T;
  if (Array.isArray(value)) return value.map(localizeSettings) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, localizeSettings(entry)])) as T;
  }
  return value;
}
