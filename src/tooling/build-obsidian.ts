import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const SOURCE = resolve(import.meta.dir, "../obsidian/life-os-app");
export interface PluginArtifact { name: "main.js" | "manifest.json" | "styles.css" | "LICENSE"; content: string }

/** Compile the single plugin entry without wrapping its CommonJS host exports.
 * Obsidian supplies `obsidian`; there are no Bun or Node dependencies in this output.
 * This function returns bytes only, so callers choose their isolated output directory.
 */
export async function compilePlugin(): Promise<PluginArtifact[]> {
  const transpiler = new Bun.Transpiler({ loader: "ts", target: "browser" });
  const code = await transpiler.transform(await readFile(join(SOURCE, "main.ts"), "utf8"));
  const artifacts: PluginArtifact[] = [{ name: "main.js", content: code }];
  for (const name of ["manifest.json", "styles.css", "LICENSE"] as const) {
    artifacts.push({ name, content: await readFile(join(SOURCE, name), "utf8") });
  }
  return artifacts;
}
