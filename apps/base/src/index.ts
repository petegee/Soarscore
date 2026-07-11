import fs from "node:fs";
import path from "node:path";
import { buildApp } from "./app.js";
import { resolveDataDir } from "./config.js";

const dataDir = resolveDataDir();
fs.mkdirSync(dataDir, { recursive: true });

const app = buildApp({
  dbPath: path.join(dataDir, "soarscore.db"),
  serveStatic: process.env.NODE_ENV === "production",
});

const port = Number(process.env.PORT ?? 3000);

app
  .listen({ port, host: "0.0.0.0" })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
