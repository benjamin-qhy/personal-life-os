import { agent, ndJsonStream, PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import { Readable, Writable } from "node:stream";
import { Sessions } from "./sessions";

const stream = ndJsonStream(
  Writable.toWeb(process.stdout),
  Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>,
);

const sessions = new Sessions();
const connection = agent({ name: "personal-life-os" })
  .onRequest("initialize", () => ({
    protocolVersion: PROTOCOL_VERSION,
    agentInfo: { name: "personal-life-os", title: "Personal Life OS", version: "0.1.0" },
    agentCapabilities: { loadSession: true, mcpCapabilities: { http: true }, promptCapabilities: { embeddedContext: true } },
    authMethods: [],
  }))
  .onRequest("session/new", ({ params }) => sessions.create(params))
  .onRequest("session/load", ({ params, client }) => sessions.load(params, client))
  .onRequest("session/set_config_option", ({ params }) => sessions.setConfig(params))
  .onRequest("session/prompt", ({ params, client }) => sessions.prompt(params, client))
  .onNotification("session/cancel", ({ params }) => sessions.cancel(params.sessionId))
  .connect(stream);

connection.signal.addEventListener("abort", () => { void sessions.dispose(); }, { once: true });
