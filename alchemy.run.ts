/// <reference types="@types/node" />

import alchemy from "alchemy";
import { Vite } from "alchemy/cloudflare";
import { CloudflareStateStore } from "alchemy/state";

const app = await alchemy("cf-alchemy-pglite-react", {
	stateStore: (scope) => new CloudflareStateStore(scope),
});

export const worker = await Vite("website", {
	entrypoint: "src/worker.ts",
});

console.log({
	url: worker.url,
});

await app.finalize();
