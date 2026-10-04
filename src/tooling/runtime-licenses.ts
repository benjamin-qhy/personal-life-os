import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

/** Preserve licenses for packages actually present in Bun's unminified bundle. */
export async function runtimeLicenses(code: Uint8Array): Promise<string> {
  const packages = new Set([...new TextDecoder().decode(code).matchAll(/^\/\/ node_modules\/((?:@[^/\s]+\/)?[^/\s]+)\//gm)].map(m => m[1]!));
  if (!packages.size) throw new Error("无法识别运行包依赖版权来源。");
  const sections = ["Personal Life OS / Pi ACP 运行包第三方声明\n原始版权和许可证保留如下。"];
  for (const name of [...packages].sort()) {
    const folder = resolve(import.meta.dir, "../../node_modules", name);
    const metadata = JSON.parse(await readFile(join(folder, "package.json"), "utf8"));
    const licenses = (await readdir(folder)).filter(file => /^(license|copying|notice)(\.|$)/i.test(file)).sort();
    const contents = await Promise.all(licenses.map(async file => `${file}\n${await readFile(join(folder, file), "utf8")}`));
    sections.push(`${name}@${metadata.version}\n许可证声明：${typeof metadata.license === "string" ? metadata.license : "参见包元数据"}\n${contents.join("\n\n") || "包中未附独立许可证文件；原始代码中的版权注释保留在运行文件中。"}`);
  }
  return sections.join("\n\n----------------------------------------\n\n") + "\n";
}
