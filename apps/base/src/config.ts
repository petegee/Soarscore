import path from "node:path";

export function resolveDataDir(): string {
  return process.env.SOARSCORE_DATA_DIR ?? path.resolve("./data");
}
