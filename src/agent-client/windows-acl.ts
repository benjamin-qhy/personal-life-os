// Windows has no POSIX owner-only mode bits. Use the system's ACL API through
// its built-in PowerShell, without shell interpolation, external packages or
// inherited model credentials. Only fixed cache paths reach this module.
import type { ExecFileOptions } from "node:child_process";

interface AccessRule { sid: string; type: number; rights: number; inherited: boolean }
interface AclReport { owner: string; user: string; protected: boolean; reparse: boolean; rules: AccessRule[] }
function parseReport(value: unknown): AclReport {
  if (typeof value !== "object" || value === null) throw Error("Windows 私有缓存 ACL 返回无效");
  const report = value as Record<string, unknown>;
  if (typeof report.owner !== "string" || typeof report.user !== "string" || typeof report.protected !== "boolean" || typeof report.reparse !== "boolean" || !Array.isArray(report.rules)) throw Error("Windows 私有缓存 ACL 返回无效");
  const rules = report.rules.map((entry: unknown) => {
    if (typeof entry !== "object" || entry === null) throw Error("Windows 私有缓存 ACL 规则无效");
    const rule = entry as Record<string, unknown>;
    if (typeof rule.sid !== "string" || typeof rule.type !== "number" || typeof rule.rights !== "number" || typeof rule.inherited !== "boolean") throw Error("Windows 私有缓存 ACL 规则无效");
    return { sid: rule.sid, type: rule.type, rights: rule.rights, inherited: rule.inherited };
  });
  return { owner: report.owner, user: report.user, protected: report.protected, reparse: report.reparse, rules };
}
export async function privateWindowsAcl(path: string, create: boolean): Promise<void> {
  await privateWindowsAcls([{path, create}]);
}
export async function privateWindowsAcls(paths: {path: string; create: boolean}[]): Promise<void> {
  const systemRoot = process.env.SystemRoot ?? process.env.SYSTEMROOT;
  if (!systemRoot || !/^[A-Za-z]:\\[^\r\n\x00]*$/.test(systemRoot)) throw Error("Windows 私有缓存需要有效的系统 Windows 目录");
  const executable = (require("node:path") as typeof import("node:path")).win32.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const encodedPaths = Buffer.from(JSON.stringify(paths), "utf16le").toString("base64");
  const script = `
$ErrorActionPreference = 'Stop'
$requests = @([Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encodedPaths}')) | ConvertFrom-Json)
$reports = @(foreach ($request in $requests) {
$p = $request.path
$item = Get-Item -LiteralPath $p -Force
if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Cache reparse points are forbidden' }
$me = [Security.Principal.WindowsIdentity]::GetCurrent().User
if ($request.create) {
if ($item.PSIsContainer) {
  $acl = New-Object Security.AccessControl.DirectorySecurity
  $inherit = [Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'
} else {
  $acl = New-Object Security.AccessControl.FileSecurity
  $inherit = [Security.AccessControl.InheritanceFlags]::None
}
$acl.SetOwner($me)
$acl.SetAccessRuleProtection($true, $false)
$rule = New-Object Security.AccessControl.FileSystemAccessRule($me, [Security.AccessControl.FileSystemRights]::FullControl, $inherit, [Security.AccessControl.PropagationFlags]::None, [Security.AccessControl.AccessControlType]::Allow)
$acl.AddAccessRule($rule)
Set-Acl -LiteralPath $p -AclObject $acl
}
$acl = Get-Acl -LiteralPath $p
$rules = @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]) | ForEach-Object { @{ sid=$_.IdentityReference.Value; type=[int]$_.AccessControlType; rights=[int]$_.FileSystemRights; inherited=$_.IsInherited } })
@{ owner=$acl.GetOwner([Security.Principal.SecurityIdentifier]).Value; user=$me.Value; protected=$acl.AreAccessRulesProtected; reparse=(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0); rules=$rules }
})
ConvertTo-Json -InputObject @($reports) -Depth 5 -Compress
`;
  const options: ExecFileOptions = { windowsHide: true, timeout: 15000, maxBuffer: 65536, encoding: "utf8", env: { SystemRoot: systemRoot, WINDIR: systemRoot } };
  const output = await new Promise<string>((resolve, reject) => {
    (require("node:child_process") as typeof import("node:child_process")).execFile(executable,
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], options,
      (error, stdout) => error ? reject(new Error("无法校验 Windows 私有缓存 ACL，拒绝读写", { cause: error })) : resolve(String(stdout)));
  });
  const parsed: unknown = JSON.parse(output.replace(/^\uFEFF/, ""));
  if (!Array.isArray(parsed) || parsed.length !== paths.length) throw Error("Windows 私有缓存 ACL 返回数量不匹配");
  for (const value of parsed) {
  const report = parseReport(value);
  const allowed = new Set([report.user, "S-1-5-18", "S-1-5-32-544"]);
  const fullControl = 0x1f01ff;
  if (!/^S-1-5-/.test(report.user) || report.owner !== report.user || !report.protected || report.reparse ||
      report.rules.some(rule => !allowed.has(rule.sid) || rule.type !== 0 || rule.inherited) ||
      !report.rules.some(rule => rule.sid === report.user && (rule.rights & fullControl) === fullControl)) {
    throw Error("Windows 缓存 ACL 必须仅允许当前用户与系统管理员访问，且禁止继承和重解析点");
  }
}
}
