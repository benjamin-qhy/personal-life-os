import { registerBunOAuthFlows } from "@earendil-works/pi-ai/bun-oauth";
import { setBedrockProviderModule } from "@earendil-works/pi-ai/api/bedrock-converse-stream.lazy";
import { bedrockProviderModule } from "@earendil-works/pi-ai/bedrock-provider";
import "./main";

// Pi's standalone entry explicitly embeds OAuth providers instead of resolving adjacent SDK files.
// Credentials remain runtime-only, read-only Codex authentication uses the existing credential store.
registerBunOAuthFlows();
setBedrockProviderModule(bedrockProviderModule);
