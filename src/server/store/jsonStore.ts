import fs from "node:fs";
import path from "node:path";

/** Minimal durable array store backed by a single JSON file under .guardian/. Best-effort: a
 * corrupt or missing file yields an empty list rather than throwing, matching cache.ts's stance
 * that local state files are a convenience, not a source of truth worth crashing over. */
export class JsonArrayStore<T> {
  constructor(private readonly filePath: string) {}

  readAll(): T[] {
    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }

  writeAll(items: T[]): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(items, null, 2), "utf-8");
  }

  append(item: T, cap?: number): T[] {
    const items = [item, ...this.readAll()];
    const capped = cap ? items.slice(0, cap) : items;
    this.writeAll(capped);
    return capped;
  }
}
