import fs from "node:fs";
import type { Mode } from "./types.js";

type WeightEntry = number | { dense?: number; superDense?: number };

let cachedJson: Record<string, WeightEntry> | null = null;

function loadWeights(): Record<string, WeightEntry> {
  if (cachedJson) return cachedJson;

  const path = process.env.WEIGHT_PATH ?? "/app/assets/weights/weightDense.json";
  const txt = fs.readFileSync(path, "utf8");
  cachedJson = JSON.parse(txt) as Record<string, WeightEntry>;
  return cachedJson;
}

export function getWeight(classKey: string, mode: Mode): number {
  const weights = loadWeights();
  const entry = weights[classKey];
  if (entry === undefined) return 0;

  if (typeof entry === "number") return entry;

  const v = entry[mode];
  return typeof v === "number" ? v : 0;
}

