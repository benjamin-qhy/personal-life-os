import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

export const AGENT_CLIENT_UPSTREAM_SHA256 = "8e9d2c84f061d62a313df0651f278d8c37a558e0557a3dc5f54e4abb85abea2a";
export const AGENT_CLIENT_CACHE_PATCH_VERSION = 1;
interface PatchedAgentClient {
  code: string;
  notice: string;
  upstreamSha256: string;
  patchedSha256: string;
}

/** Pure build transformation. Never reads settings/auth or writes a candidate. */
export async function patchAgentClient(source: string): Promise<PatchedAgentClient> {
  const sha = (text: string) => createHash("sha256").update(text).digest("hex");
  if (sha(source) !== AGENT_CLIENT_UPSTREAM_SHA256) throw Error("Unsupported Agent Client upstream SHA256");
  const root = fileURLToPath(new URL("../../", import.meta.url)).replace(/\/$/, "");
  const built = await Bun.build({
    root,
    entrypoints: [fileURLToPath(new URL("../agent-client/cache-runtime.ts", import.meta.url))],
    target: "node",
    format: "cjs",
    // Bun emits cwd-relative source comments even with an explicit root.
    // Strip build comments without changing identifiers or runtime behavior.
    minify: { whitespace: true, syntax: false, identifiers: false },
    external: ["obsidian"],
  });
  if (!built.success || built.outputs.length !== 1) throw Error("Agent Client cache runtime compilation failed");
  const runtime = await built.outputs[0]!.text();
  if (runtime.includes(root)) throw Error("Agent Client runtime contains an absolute source path");
  function replace(from: string, to: string): void {
    if (source.split(from).length !== 2) throw Error("Agent Client patch anchor mismatch");
    source = source.replace(from, to);
  }
  // This exact upstream hash has one storage/service block, without license
  // text inside it. Keep all rendering, ACP approval and original license code.
  const start = source.indexOf("var Kd=class{");
  const end = source.indexOf('var te=require("obsidian");', start);
  if (start < 0 || end < 0) throw Error("Agent Client session seam missing");
  source = source.slice(0, start) +
    "var Kd=__plo.Storage,ty=__plo.Settings,hT=(e,t)=>new ty(e,t,{normalizeCwd:(cwd,settings)=>ey.Platform.isWin&&settings.windowsWslMode?Mn(cwd):cwd,trim:rows=>gT(rows,mT),debug:ZE});" +
    source.slice(end);
  replace(
    "savedSessions:Array.isArray(n.savedSessions)?n.savedSessions:i.savedSessions",
    "savedSessions:await __plo.load(this,n.savedSessions)",
  );
  replace(
    "this.ensureAtLeastOneEnabled(),this.ensureDefaultAgentId(),(r||o.absorbed.length>0)&&await this.saveSettings()",
    "this.settings={...__plo.safeSettings(this.settings),savedSessions:this.settings.savedSessions},this.ensureAtLeastOneEnabled(),this.ensureDefaultAgentId(),(r||o.absorbed.length>0)&&await this.saveSettings()",
  );
  replace(
    "async saveSettings(){await this.saveData(this.settings)}",
    "async saveSettings(){await this.saveData(__plo.safeSettings(this.settings))}",
  );
  replace(
    "ue&&i.saveSessionMessages(Z.sessionId,n.agentId,ue)",
    "ue&&await i.saveSessionMessages(Z.sessionId,n.agentId,ue)",
  );
  replace(
    "M=(0,He.useCallback)((N,V)=>{!n.agentId||V.length===0||(i.saveSessionMessages(N,n.agentId,V),i.updateSession(N,{updatedAt:new Date().toISOString()}))},[n.agentId,i])",
    "M=(0,He.useCallback)((N,V,onSaved)=>{if(!n.agentId||V.length===0)return Promise.resolve(false);return i.persistSessionMessages(N,n.agentId,V,onSaved)},[n.agentId,i])",
  );
  replace(
    "Sc.current=!0,wc.current=q,M.saveSessionMessages(P.sessionId,q),S.log(`[ChatPanel] Session messages saved: ${P.sessionId}`)",
    "M.saveSessionMessages(P.sessionId,q,()=>{if(Sc.sessionId!==P.sessionId)return;Sc.current=!0,wc.current=q,S.log(`[ChatPanel] Session messages saved: ${P.sessionId}`)})",
  );
  replace("ht(()=>{Sc.current=!1},[P.sessionId])", "ht(()=>{Sc.current=!1,Sc.sessionId=P.sessionId},[P.sessionId])");
  replace("wc.current=q,M.saveSessionMessages(R,q)", "M.saveSessionMessages(R,q,()=>{if(Sc.sessionId===R)wc.current=q})");
  replace(
    "saveAndClose(n){let i=n.trim();i&&(this.close(),this.onSave(i))}",
    "async saveAndClose(n){let i=n.trim();if(i)try{await this.onSave(i);this.close()}catch(error){__plo.reportFailure(error)}}",
  );
  const notice = `Personal Life OS 会话缓存兼容补丁 v${AGENT_CLIENT_CACHE_PATCH_VERSION}。\n修改自 Agent Client 0.12.1，原作者 RAIT-09。上游 SHA256：${AGENT_CLIENT_UPSTREAM_SHA256}。\n桌面会话与索引保存在库外私有目录；不自动迁移旧记录；移动端关闭 AI 与缓存。\n保留原 Apache-2.0 许可证和全部上游版权声明。\n`;
  const code = `/* ${notice} */\nif(!require("obsidian").Platform.isDesktopApp){module.exports={default:class extends require("obsidian").Plugin{async onload(){new (require("obsidian").Notice)("移动端不启用 Agent Client AI 与会话缓存");}}};}else{\nvar __plo=(()=>{var module={exports:{}};var exports=module.exports;\n${runtime}\nreturn module.exports;})();\n${source}\n}\n`;
  return { code, notice, upstreamSha256: AGENT_CLIENT_UPSTREAM_SHA256, patchedSha256: sha(code) };
}
