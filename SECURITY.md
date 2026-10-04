# Security

Life OS is a local-first Obsidian vault. The first-party dashboard makes no network or provider calls. Optional agents, web browsing, external-link checks, and third-party plugins have their own network behavior. This page describes configured defaults, not a guarantee that every installed component is offline.

## What the template ships, network-wise

| Component | State on first open | Notes |
| --- | --- | --- |
| Local REST API 5.1.0 (`obsidian-local-rest-api`) | Enabled, non-encrypted HTTP server on port 27123, bound to 127.0.0.1 | Shipped settings are exactly `{"enableInsecureServer": true}`. The plugin generates a per-install API key and a self-signed certificate on first load and stores them on your machine. The key is a password to read and write the vault: do not share screenshots of the settings page. "Reset all cryptography" rotates key and certificate. The same key authenticates the MCP server at `http://127.0.0.1:27123/mcp`. Never set `bindingHost`. HTTPS on 27124 stays available if you prefer it. |
| Omnisearch 1.30.1 | Installed and enabled, its HTTP server off | The Omnisearch HTTP endpoint has no authentication and allows any origin, so the template leaves it off. Never set `DANGER_httpHost`. |
| Agent Client 0.12.1 | Installed, auto-allow off, no sessions, no paths, no keys | Runs a local agent (Claude Code, Codex, Gemini CLI) over the Agent Client Protocol. The agent has the same access as your terminal user; the plugin surfaces approvals. What leaves your machine is what you send: your messages, mentioned notes, attachments. Journal notes mentioned in a chat go to the model provider. |
| Web viewer (core plugin) | On | A Chromium webview inside Obsidian with ad blocking on. While Obsidian runs, third-party plugins can access its cookies, so use your main browser for anything password protected. |
| QuickAdd | Online features off, no AI provider keys | Verified by the release gate. |
| SEO | External link checking off | Needs the network only if you turn it on. |
| Obsidian Sync (core) | Off | |

Read `使用指南/17 搜索服务.md` and `使用指南/19 Obsidian MCP 桥接.md` for the reasoning behind these defaults.

## What never ships

- API keys, bearer tokens, certificates, or private keys of any kind.
- A real `.mcp.json` (only `.mcp.example.json` with a placeholder) or `.claude/settings.local.json`.
- Agent Client sessions, exported chats, or `系统/Agent Chats/`.
- Journal, retreat, planning, or other personal notes. User folders contain only notes tagged `example`.
- `.vault-系统/` (claude-obsidian journal), `wiki/` content folders, `inbox/` contents, workspace files.
- Absolute paths, user names, or email addresses.

The builder excludes raw plugin settings from copying and reconstructs allowlisted settings before writing staging files. The verifier rejects machine-local state before its content scan and checks the sanitized candidate. These checks reduce risk; they do not replace reviewing an exact candidate before distribution. Never ZIP the working vault directly.

## Context and approval

Assistant workflow buttons explicitly disable automatic sending. Review the prompt and context in the agent composer. The embedded chat uses the hosting Assistant note as context. Agent settings can also include active-note mentions or linked-note expansion; review those settings before sending personal material.

The requirement to approve writes is a policy. Agent Client's automatic-approval setting is observable, but Life OS cannot guarantee how another CLI, MCP client, or agent will act. Configured tooling is not proof of authentication or a tested live connection. No provider test is performed automatically.

## Safe release and recovery

Build only into a fresh directory outside the working vault. Existing destinations are refused. Staging is private and removed on failure. Validate the candidate, archive checksum, and native first-run behavior before sharing it. Keep the working vault and its backups separate from release output.

There is no transactional in-place upgrader. Back up the complete vault, extract a new candidate alongside it, and migrate personal content and custom settings with review. Test a restore before retiring an old copy. See `scripts/RELEASE.md`.

## Your responsibilities as a member

- Keep the Local REST API key out of the vault folder. Register it in your agent's user-scope config (for Claude Code, `claude mcp add --scope user ...`), never in a `.mcp.json` inside the vault.
- Keep Agent Client auto-allow off. `AGENTS.md` rule 2 (ask before edit) is the behaviour floor for every agent.
- Do not sign in to sensitive sites inside the in-app Web viewer.
- If you publish your own copy, run `python3 scripts/verify_template.py .` first.

## Reporting a problem
This repository is public. For a security problem (a key or personal data that slipped into the template, a plugin setting that exposes the vault), use GitHub's private vulnerability reporting: Security tab → "Report a vulnerability". It stays private until a fix ships. Do not open a public issue for security problems. For everything else, open a normal issue with the bug template.
