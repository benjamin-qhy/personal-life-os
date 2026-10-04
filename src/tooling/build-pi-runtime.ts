import { join, resolve } from "node:path";

export async function compilePiRuntime(): Promise<Uint8Array> {
  const root = resolve(import.meta.dir, "../..");
  const build = await Bun.build({ entrypoints: [join(root, "src/acp/runtime-entry.ts")], target: "bun", format: "esm", minify: false, sourcemap: "none", plugins: [{ name: "text-only-acp", setup(builder) {
    builder.onLoad({ filter: /photon-node[\\/]photon_rs\.js$/ }, () => ({ loader: "js", contents: 'throw new Error("此 ACP 运行文件仅支持文本，不提供图片处理。");' }));
  } }] });
  if (!build.success || build.outputs.length !== 1) throw new Error("Pi 打包失败。");
  const code = await build.outputs[0]!.text();
  if (code.includes(root) || code.includes(root.replaceAll("\\", "/"))) throw new Error("产物包含构建机绝对路径，拒绝发布。");
  return new TextEncoder().encode(code);
}
