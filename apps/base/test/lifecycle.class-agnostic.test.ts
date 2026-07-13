import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// CLAUDE.md class-model law (Norm 5 / Safeguard 7): the lifecycle module
// interprets the state machine generically and must never branch on any
// specific competition class or read the Contest Class Model. Any such
// reference in the module is a defect — asserted here at the source level.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIFECYCLE_DIR = path.resolve(__dirname, "../src/lifecycle");

const FORBIDDEN = [/\bF3B\b/, /\bF3J\b/, /\bF3K\b/, /\bF5J\b/, /\bF5K\b/, /\bF5L\b/, /classModel/i, /discipline/i];

describe("lifecycle module is class-agnostic", () => {
  it("references no discipline literal and never reads the class model", () => {
    const files = readdirSync(LIFECYCLE_DIR).filter((f) => f.endsWith(".ts"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(path.join(LIFECYCLE_DIR, file), "utf8");
      for (const pattern of FORBIDDEN) {
        expect(pattern.test(source), `${file} must not match ${pattern}`).toBe(false);
      }
    }
  });
});
