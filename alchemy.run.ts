import alchemy from "alchemy";
import { Worker, D1Database } from "alchemy/cloudflare";

const app = await alchemy("bio");

const db = await D1Database("bio-db", {
  migrationsDir: "./migrations",
  adopt: true,
});

const worker = await Worker("app", {
  domains: process.env.DOMAINS ? process.env.DOMAINS.split(",") : [],
  adopt: true,
  entrypoint: "./src/worker.tsx",
  bindings: {
    DB: db,
    SESSION_SECRET: process.env.SESSION_SECRET || crypto.randomUUID(),
  },
});

console.log({ url: worker.url });

await app.finalize();

