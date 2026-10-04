import { test, expect } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, readdir, realpath, chmod, stat, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { patchAgentClient } from "../../src/tooling/patch-agent-client";
const nativeRequire = createRequire(import.meta.url);
const upstream = await readFile(new URL("../../.obsidian/plugins/agent-client/main.js",import.meta.url),"utf8");
function noop() {}
const chain:any = new Proxy(function(){return chain}, {get:(_t,p)=>p==="nodeType"?1:p==="nodeName"?"DIV":p==="then"?undefined:p===Symbol.toPrimitive?()=>"":p===Symbol.iterator?function*(){}:chain,apply:()=>chain,construct:()=>chain});
async function host(home:string,vault:string, data:any={},mobile=false,faults:{index?:boolean;settings?:boolean;windows?:boolean;deletion?:boolean;message?:boolean;acl?:"private"|"wide"|"owner"|"inherited"|"reparse"|"missing";aclDelay?:number;lockVanish?:boolean}={}) {
 const writes:any[]=[]; const notices:string[]=[]; const nodeLoads:string[]=[]; const aclCalls:any[]=[];
 class Plugin {app:any;manifest:any={version:"0.12.1"};constructor(app:any){this.app=app} async loadData(){return structuredClone(data)} async saveData(value:any){if(faults.settings)throw Error("synthetic settings failure");writes.push(structuredClone(value));data=structuredClone(value)} registerView=noop;addCommand=noop;addSettingTab=noop;registerMarkdownCodeBlockProcessor=noop;registerEvent=noop;addRibbonIcon(){return chain}}
 const obs:any=new Proxy({Plugin,Platform:{isDesktopApp:!mobile,isWin:!!faults.windows,isMacOS:!faults.windows},Notice:class{constructor(s:string){notices.push(s)}},PluginSettingTab:class{},ItemView:class{},MarkdownRenderChild:class{},Modal:class{},FileSystemAdapter:class{}},{get:(t,p)=>p in t?t[p as keyof typeof t]:chain});
 const vaultWrites:any[]=[];
 const app={vault:{configDir:".obsidian",adapter:{getBasePath:()=>vault,write:async(...x:any[])=>{vaultWrites.push(x)},exists:async()=>false,mkdir:async(...x:any[])=>{vaultWrites.push(x)}}},workspace:{containerEl:chain,detachLeavesOfType:noop,on:noop,getLeavesOfType:()=>[]},secretStorage:{getSecret:()=>null}};
 const localRequire=(id:string)=>{if(id==="obsidian")return obs;if(id.startsWith("@codemirror/")||id==="electron")return chain;nodeLoads.push(id);if(mobile)throw Error("Node on mobile");if(id==="node:child_process"&&faults.acl)return {execFile:(command:string,args:string[],options:any,done:(error:Error|null,stdout:string)=>void)=>{
 const script=Buffer.from(args[4]!,"base64").toString("utf16le");
 const payload=script.match(/FromBase64String\('([A-Za-z0-9+/=]+)'\)/)?.[1];
 const requests=JSON.parse(Buffer.from(payload!,"base64").toString("utf16le"));
 aclCalls.push({command,args,options,requests});
 const user="S-1-5-21-111-222-333-1001";
 const reports=requests.map(()=>({owner:faults.acl==="owner"?"S-1-5-18":user,user,protected:faults.acl!=="inherited",reparse:faults.acl==="reparse",rules:[{sid:faults.acl==="wide"?"S-1-1-0":user,type:0,rights:2032127,inherited:false}]}));
 setTimeout(()=>done(faults.acl==="missing"?new Error("missing PowerShell"):null,JSON.stringify(reports)),faults.aclDelay??0);
 }};
 if(id==="node:fs/promises")return {...nativeRequire(id),
 mkdir:async(path:string,options:any)=>{if(faults.lockVanish&&path.endsWith("/.lock")){faults.lockVanish=false;const e:any=new Error("lock holder just released");e.code="EEXIST";throw e}return nativeRequire(id).mkdir(path,options)},unlink:async(path:string)=>{if(faults.deletion&&path.includes("/session-"))throw Error("synthetic deletion failure");return nativeRequire(id).unlink(path)},rename:async(from:string,to:string)=>{if(faults.message&&to.includes("/session-"))throw Error("synthetic message failure");if(faults.index&&to.endsWith("/index.json"))throw Error("synthetic index failure");return nativeRequire(id).rename(from,to)}};if(id==="node:os"||id==="os")return {...nativeRequire(id),homedir:()=>home};return nativeRequire(id)};
 const mod={exports:{} as any};
 const runtime=new Function("require","module","exports","window","document","process",(await patchAgentClient(upstream)).code+"\nreturn typeof __plo === 'undefined' ? undefined : __plo;")(localRequire,mod,mod.exports,chain,chain,faults.acl?{...process,platform:"win32",env:{SystemRoot:"C:\\Windows"}}:process);
 const plugin=new mod.exports.default(app);
 await plugin.onload();
 return {plugin,writes,notices,nodeLoads,vaultWrites,aclCalls,runtime};
}
test("generated plugin saves, restores, renames and deletes a Chinese chat without vault cache",async()=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),"plo-cache-")));const home=join(root,"home"),vault=join(root,"vault");await mkdir(home);await mkdir(vault);
 try{
 const a=await host(home,vault);const service=a.plugin.settingsService;
 await service.saveSession({sessionId:"chat-1",agentId:"personal-life-os-pi",cwd:vault,title:"合成标题",createdAt:"2026-01-01",updatedAt:"2026-01-01"});
 await service.saveSessionMessages("chat-1","personal-life-os-pi",[{role:"user",content:"合成对话",timestamp:new Date("2026-01-01")}]);
 await service.updateSessionTitle("chat-1","更新标题");
 await service.updateSettings({debugMode:false});
 expect(a.writes.every(x=>!('savedSessions' in x))).toBe(true);expect(a.vaultWrites).toEqual([]);
 const b=await host(home,vault);expect(b.plugin.settingsService.getSavedSessions()[0].title).toBe("更新标题");
 expect((await b.plugin.settingsService.loadSessionMessages("chat-1"))[0].content).toBe("合成对话");
 await b.plugin.settingsService.deleteSession("chat-1");
 const c=await host(home,vault);expect(c.plugin.settingsService.getSavedSessions()).toEqual([]);expect(await c.plugin.settingsService.loadSessionMessages("chat-1")).toBeNull();
 }finally{await rm(root,{recursive:true,force:true})}
});
test("session identifiers cannot collide with index or case variants, and invalid IDs are rejected",async()=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),"plo-cache-")));const home=join(root,"home"),vault=join(root,"vault");await mkdir(home);await mkdir(vault);
 try{const {plugin}=await host(home,vault);const s=plugin.settingsService;
 for(const name of ["index","chat-a","chat-A"]){await s.saveSession({sessionId:name,agentId:"pi",title:name});await s.saveSessionMessages(name,"pi",[{content:name,timestamp:new Date()}]);}
 for(const name of ["index","chat-a","chat-A"])expect((await s.loadSessionMessages(name))[0].content).toBe(name);
 await expect(s.saveSession({sessionId:"../escape",agentId:"pi"})).rejects.toThrow("非法会话 ID");
 expect((await host(home,vault)).plugin.settingsService.getSavedSessions()).toHaveLength(3);
 }finally{await rm(root,{recursive:true,force:true})}
});
test("legacy vault history is left untouched and asks for a separate migration",async()=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),"plo-cache-")));const home=join(root,"home"),vault=join(root,"vault");await mkdir(home);await mkdir(vault);
 try{await expect(host(home,vault,{savedSessions:[{sessionId:"old",title:"旧合成标题",agentId:"pi"}]})).rejects.toThrow("迁移");}finally{await rm(root,{recursive:true,force:true})}
});
test("parallel windows and full settings snapshots preserve both session index updates",async()=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),"plo-cache-")));const home=join(root,"home"),vault=join(root,"vault");await mkdir(home);await mkdir(vault);
 try{const a=await host(home,vault),b=await host(home,vault);const stale={...a.plugin.settings};
 await Promise.all([a.plugin.settingsService.saveSession({sessionId:"a",agentId:"pi",title:"甲"}),b.plugin.settingsService.saveSession({sessionId:"b",agentId:"pi",title:"乙"})]);
 await a.plugin.saveSettingsAndNotify({...stale,debugMode:false});
 expect(a.plugin.settingsService.getSavedSessions().some((r:any)=>r.sessionId==="a")).toBe(true);
 expect((await host(home,vault)).plugin.settingsService.getSavedSessions()).toHaveLength(2);
 expect(a.writes.every(x=>!Object.hasOwn(x,"savedSessions"))).toBe(true);
 }finally{await rm(root,{recursive:true,force:true})}
});
function cacheDir(home:string,vault:string){return join(home,".local/share/personal-life-os/agent-client",createHash("sha256").update(vault).digest("hex"))}
test("unsafe cache permissions fail without publishing metadata and recover after repair",async()=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),"plo-cache-")));const home=join(root,"home"),vault=join(root,"vault");await mkdir(home);await mkdir(vault);
 try{const a=await host(home,vault);const dir=cacheDir(home,vault);await chmod(dir,0o755);
 await expect(a.plugin.settingsService.saveSession({sessionId:"a",agentId:"pi"})).rejects.toThrow("权限");expect(a.plugin.settingsService.getSavedSessions()).toEqual([]);expect(a.vaultWrites).toEqual([]);
 await chmod(dir,0o700);await a.plugin.settingsService.saveSession({sessionId:"a",agentId:"pi"});
 expect((await host(home,vault)).plugin.settingsService.getSavedSessions()).toHaveLength(1);
 expect((await stat(join(dir,"index.json"))).mode&0o777).toBe(0o600);
 }finally{await rm(root,{recursive:true,force:true})}
});
test("failed index and ordinary settings writes do not publish success or poison later saves",async()=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),"plo-cache-")));const home=join(root,"home"),vault=join(root,"vault");await mkdir(home);await mkdir(vault);
 try{const faults={index:false,settings:false};const a=await host(home,vault,{},false,faults);const s=a.plugin.settingsService;
 await s.saveSession({sessionId:"a",agentId:"pi",title:"原题"});await s.saveSessionMessages("a","pi",[{content:"原消息",timestamp:new Date()}]);
 faults.index=true;await expect(s.updateSessionTitle("a","不应出现")).rejects.toThrow("synthetic index failure");expect(s.getSavedSessions()[0].title).toBe("原题");
 await expect(s.deleteSession("a")).rejects.toThrow("synthetic index failure");expect((await s.loadSessionMessages("a"))[0].content).toBe("原消息");
 faults.index=false;await s.updateSessionTitle("a","成功更新");
 faults.settings=true;await expect(s.updateSettings({debugMode:true})).rejects.toThrow("synthetic settings failure");expect(s.getSnapshot().debugMode).toBe(false);
 faults.settings=false;await s.updateSettings({debugMode:true,autoAllowPermissions:true,exportSettings:{autoExportOnNewChat:true,autoExportOnCloseChat:true}});expect(s.getSnapshot().debugMode).toBe(true);expect(s.getSnapshot().autoAllowPermissions).toBe(false);expect(s.getSnapshot().exportSettings.autoExportOnCloseChat).toBe(false);
 expect((await host(home,vault)).plugin.settingsService.getSavedSessions()[0].title).toBe("成功更新");expect(a.vaultWrites).toEqual([]);
 }finally{await rm(root,{recursive:true,force:true})}
});
test("mobile plugin does not load Node modules or start cache/ACP",async()=>{
 const a=await host("unused-home","unused-vault",{},true);expect(a.nodeLoads).toEqual([]);expect(a.writes).toEqual([]);expect(a.vaultWrites).toEqual([]);expect(a.plugin.settingsService).toBeUndefined();expect(a.notices[0]).toContain("移动端");
});
test("unsafe paths and corrupt cache fail closed without vault fallback",async()=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),"plo-cache-")));const home=join(root,"home"),vault=join(root,"vault");await mkdir(home);await mkdir(vault);
 try{
 await expect(host(vault,vault)).rejects.toThrow("笔记库内");
 await symlink(vault,join(home,".local"));await expect(host(home,vault)).rejects.toThrow("符号链接");await rm(join(home,".local"));
 const a=await host(home,vault);const dir=cacheDir(home,vault);
 await writeFile(join(dir,"index.json"),"broken",{mode:0o600});await expect(host(home,vault)).rejects.toThrow();await expect(a.plugin.settingsService.saveSession({sessionId:"a",agentId:"pi"})).rejects.toThrow();expect(a.vaultWrites).toEqual([]);
 await rm(join(dir,"index.json"));await symlink(join(root,"secret"),join(dir,"index.json"));await expect(host(home,vault)).rejects.toThrow();expect(await readFile(join(dir,"index.json")).catch(()=>null)).toBeNull();
 }finally{await rm(root,{recursive:true,force:true})}
});
test("build rejects unknown upstream bytes and preserves original license notices",async()=>{
 await expect(patchAgentClient(upstream+" ")).rejects.toThrow("SHA256");const result=await patchAgentClient(upstream);expect(result.code).toContain("Copyright (c) Facebook, Inc.");expect(result.notice).toContain("RAIT-09");expect(createHash("sha256").update(result.code).digest("hex")).toBe(result.patchedSha256);
});
test("upstream WSL cwd normalization and 50-session retention remain compatible",async()=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),"plo-cache-")));const home=join(root,"home"),vault=join(root,"vault");await mkdir(home);await mkdir(vault);
 try{const a=await host(home,vault,{windowsWslMode:true},false,{windows:true});const s=a.plugin.settingsService;
 await s.saveSession({sessionId:"wsl",agentId:"pi",cwd:"C:\\Notes",updatedAt:"2099-01-01"});
 expect(s.getSavedSessions("pi","C:\\Notes")[0].cwd).toBe("/mnt/c/Notes");
 for(let i=0;i<50;i++)await s.saveSession({sessionId:`s-${i}`,agentId:"pi",updatedAt:new Date(1700000000000+i*1000).toISOString()});
 expect(s.getSavedSessions()).toHaveLength(50);expect(s.getSavedSessions().some((r:any)=>r.sessionId==="s-0")).toBe(false);
 }finally{await rm(root,{recursive:true,force:true})}
});
test("interrupted deletion is completed on restart instead of restoring an index to missing messages",async()=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),"plo-cache-")));const home=join(root,"home"),vault=join(root,"vault");await mkdir(home);await mkdir(vault);
 try{const faults={deletion:false};const a=await host(home,vault,{},false,faults);const s=a.plugin.settingsService;
 await s.saveSession({sessionId:"a",agentId:"pi"});await s.saveSessionMessages("a","pi",[{content:"待删除合成消息",timestamp:new Date()}]);
 faults.deletion=true;await expect(s.deleteSession("a")).rejects.toThrow();expect(s.getSavedSessions()).toHaveLength(1);
 faults.deletion=false;const b=await host(home,vault);expect(b.plugin.settingsService.getSavedSessions()).toEqual([]);expect(await b.plugin.settingsService.loadSessionMessages("a")).toBeNull();
 }finally{await rm(root,{recursive:true,force:true})}
});
test("chat completion publishes its saved marker only after durable messages and metadata, and failure notifies",async()=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),"plo-cache-")));const home=join(root,"home"),vault=join(root,"vault");await mkdir(home);await mkdir(vault);
 try{const faults={index:false};const a=await host(home,vault,{},false,faults);const service=a.plugin.settingsService;await service.saveSession({sessionId:"a",agentId:"pi"});
 let saved=false;faults.index=true;
 expect(await service.persistSessionMessages("a","pi",[{content:"完成回复",timestamp:new Date()}],()=>{saved=true})).toBe(false);
 expect(saved).toBe(false);expect(a.notices.some((text:string)=>text.includes("缓存操作失败"))).toBe(true);
 faults.index=false;expect(await service.persistSessionMessages("a","pi",[{content:"完成回复",timestamp:new Date()}],()=>{saved=true})).toBe(true);expect(saved).toBe(true);
 expect((await (await host(home,vault)).plugin.settingsService.loadSessionMessages("a"))[0].content).toBe("完成回复");
 }finally{await rm(root,{recursive:true,force:true})}
});
test("Windows uses system ACLs, batches private directories and tolerates delayed concurrent saves",async()=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),"plo-cache-")));const home=join(root,"home"),vault=join(root,"vault");await mkdir(home);await mkdir(vault);
 try{const faults:{acl:"private";aclDelay:number}={acl:"private",aclDelay:0};const a=await host(home,vault,{},false,faults),b=await host(home,vault,{},false,faults);
 await a.plugin.settingsService.saveSession({sessionId:"seed",agentId:"pi"});a.aclCalls.length=0;b.aclCalls.length=0;
 faults.aclDelay=350;
 await Promise.all([a.plugin.settingsService.saveSession({sessionId:"a",agentId:"pi"}),b.plugin.settingsService.saveSession({sessionId:"b",agentId:"pi"})]);
 expect(a.aclCalls.length).toBeLessThanOrEqual(5);expect(b.aclCalls.length).toBeLessThanOrEqual(5);expect(a.aclCalls.some(c=>c.requests.length===3)).toBe(true);
 expect(a.aclCalls.every(c=>c.command==="C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"&&c.args[3]==="-EncodedCommand")).toBe(true);
 expect(Object.keys(a.aclCalls[0].options.env).sort()).toEqual(["SystemRoot","WINDIR"]);
 faults.aclDelay=0;expect((await host(home,vault,{},false,faults)).plugin.settingsService.getSavedSessions()).toHaveLength(3);
 for(const acl of ["wide","owner","inherited","reparse","missing"] as const)await expect(host(home,vault,{},false,{acl})).rejects.toThrow();
 }finally{await rm(root,{recursive:true,force:true})}
},15000);
test("a lock disappearing between contention and inspection is retried",async()=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),"plo-cache-")));const home=join(root,"home"),vault=join(root,"vault");await mkdir(home);await mkdir(vault);
 try{const faults={lockVanish:false};const a=await host(home,vault,{},false,faults);faults.lockVanish=true;await a.plugin.settingsService.saveSession({sessionId:"a",agentId:"pi"});expect((await host(home,vault)).plugin.settingsService.getSavedSessions()).toHaveLength(1);}finally{await rm(root,{recursive:true,force:true})}
});
// Supplemental integration seam: execute the exact UI closures emitted in the
// generated bundle, with Obsidian/React host state supplied by this harness.
// No cache/service implementation is copied or mocked. This is not a native UI test.
function emittedClosure(code:string,start:string,end:string):string {
 const offset=code.indexOf(start);expect(offset).toBeGreaterThanOrEqual(0);
 const finish=code.indexOf(end,offset+start.length);expect(finish).toBeGreaterThan(offset);
 return code.slice(offset+start.length,finish);
}
function evaluateClosure(code:string,scope:Record<string,unknown>):any {
 return new Function(...Object.keys(scope),`return (${code})`)(...Object.values(scope));
}
test("emitted ChatPanel completion and debounce closures never claim failed saves",async()=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),"plo-cache-")));const home=join(root,"home"),vault=join(root,"vault");await mkdir(home);await mkdir(vault);
 try{const faults={message:false};const a=await host(home,vault,{},false,faults);const i=a.plugin.settingsService;await i.saveSession({sessionId:"ui",agentId:"pi"});
 const {code}=await patchAgentClient(upstream);
 const saveHook=evaluateClosure(emittedClosure(code,"M=(0,He.useCallback)(",",[n.agentId,i])"),{n:{agentId:"pi"},i});
 const pending:Promise<unknown>[]=[];const M={saveSessionMessages:(...args:any[])=>{const result=saveHook(...args);pending.push(result);return result}};
 const Sc={current:false,sessionId:"ui"},wc:{current:unknown}={current:null},sz={current:true};const logs:string[]=[];const q=[{content:"界面合成消息",timestamp:new Date()}];
 const scope={sz,Sc,wc,B:false,P:{sessionId:"ui"},q,M,S:{log:(s:string)=>logs.push(s)},C:{enableSystemNotifications:false},Tt:"Pi",activeDocument:{hasFocus:()=>true},Notification:class{}};
 // Select the completion effect by its stable unique prefix, not the first ht call.
 const completionCode="()=>{let R=sz.current"+emittedClosure(code,"ht(()=>{let R=sz.current",",[B,P.sessionId,q,M.saveSessionMessages,C.enableSystemNotifications,Tt,S])");
 const completion=evaluateClosure(completionCode,scope);
 faults.message=true;completion();await Promise.all(pending.splice(0));expect(Sc.current).toBe(false);expect(wc.current).toBeNull();expect(logs).toEqual([]);expect(a.notices.length).toBeGreaterThan(0);
 faults.message=false;sz.current=true;completion();await Promise.all(pending.splice(0));expect(Sc.current).toBe(true);expect(wc.current).toBe(q);expect(logs.some(text=>text.includes("Session messages saved"))).toBe(true);
 const edited=[{content:"更新后的界面消息",timestamp:new Date()}];const previous=wc.current;faults.message=true;
 const debounceCode="()=>{let R=P.sessionId"+emittedClosure(code,"ht(()=>{let R=P.sessionId",",[B,P.sessionId,q,M.saveSessionMessages])");
 const debounce=evaluateClosure(debounceCode,{...scope,q:edited,N4:0,window:{setTimeout:(fn:()=>void)=>{fn();return 1},clearTimeout:noop}});
 debounce();await Promise.all(pending.splice(0));expect(wc.current).toBe(previous);
 faults.message=false;debounce();await Promise.all(pending.splice(0));expect(wc.current).toBe(edited);
 Sc.sessionId="different-chat";Sc.current=false;sz.current=true;completion();await Promise.all(pending.splice(0));expect(Sc.current).toBe(false);
 }finally{await rm(root,{recursive:true,force:true})}
});
test("emitted fork and rename callbacks wait for cache success before advancing UI",async()=>{
 const root=await realpath(await mkdtemp(join(tmpdir(),"plo-cache-")));const home=join(root,"home"),vault=join(root,"vault");await mkdir(home);await mkdir(vault);
 try{const faults={message:false,index:false};const a=await host(home,vault,{},false,faults),i=a.plugin.settingsService;
 await i.saveSession({sessionId:"parent",agentId:"pi",title:"原标题"});await i.saveSessionMessages("parent","pi",[{content:"可分叉合成消息",timestamp:new Date()}]);
 const {code}=await patchAgentClient(upstream);let refreshed=0;const errors:string[]=[];
 const fork=evaluateClosure(emittedClosure(code,"oe=(0,He.useCallback)(",",[t,o,i,s,$,n.agentId,d])"),{t:{forkSession:async()=>({sessionId:"forked"})},o:noop,i,s:noop,$:()=>{refreshed++},n:{agentId:"pi"},d:[{sessionId:"parent",title:"原标题"}],f:noop,g:(error:string)=>errors.push(error),Jt:String,eo:(title:string)=>title});
 faults.message=true;await expect(fork("parent",vault)).rejects.toThrow("synthetic message failure");expect(refreshed).toBe(0);expect(errors.some(e=>e?.includes("Failed to fork"))).toBe(true);
 faults.message=false;await fork("parent",vault);expect(refreshed).toBe(1);expect((await i.loadSessionMessages("forked"))[0].content).toBe("可分叉合成消息");
 const renameBody=emittedClosure(code,"async saveAndClose(n)","onClose(){let{contentEl:n}=this;n.empty()}");
 const rename=evaluateClosure("async function(n)"+renameBody,{__plo:a.runtime});let closed=0;
 const modal={onSave:(title:string)=>i.updateSessionTitle("parent",title),close:()=>{closed++}};
 faults.index=true;await rename.call(modal,"新标题");expect(closed).toBe(0);expect(i.getSavedSessions().find((row:any)=>row.sessionId==="parent").title).toBe("原标题");
 faults.index=false;await rename.call(modal,"新标题");expect(closed).toBe(1);expect(i.getSavedSessions().find((row:any)=>row.sessionId==="parent").title).toBe("新标题");
 }finally{await rm(root,{recursive:true,force:true})}
});
