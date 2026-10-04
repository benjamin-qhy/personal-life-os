import { lstat, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

export const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
export async function exists(path: string) {
  try { await lstat(path); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
}
export async function filesIn(root: string): Promise<string[]> {
  const result: string[] = [];
  async function visit(rel: string) {
    for (const item of await readdir(join(root, rel), { withFileTypes: true })) {
      const name = rel ? `${rel}/${item.name}` : item.name;
      if (item.isSymbolicLink() || (!item.isDirectory() && !item.isFile())) throw new Error("目录包含符号链接或非常规文件。");
      if (item.isDirectory()) await visit(name); else result.push(name);
    }
  }
  const stat = await lstat(root);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("输入必须是普通目录。");
  await visit("");
  return result.sort();
}
export async function put(path: string, text: string | Uint8Array) {
  await mkdir(dirname(path), { recursive: true }); await writeFile(path, text);
}
export async function readJson(path: string): Promise<Record<string, any>> {
  return JSON.parse(await readFile(path, "utf8"));
}

// Conservative Unicode caseless key: also folds expansions such as ß/SS and final sigma.
export const pathKey = (path: string) => path.normalize("NFC").toLowerCase().toUpperCase().toLowerCase().normalize("NFC");
