import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { isSupportedAudioPath } from "../domain/audio.ts";

export interface BrowserEntry {
  name: string;
  path: string;
  kind: "directory" | "file";
}

export async function listBrowserEntries(directoryPath: string): Promise<BrowserEntry[]> {
  const resolvedDirectory = resolve(directoryPath);
  const entries = await readdir(resolvedDirectory, { withFileTypes: true });
  const browserEntries: BrowserEntry[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const entryPath = resolve(resolvedDirectory, entry.name);

    if (entry.isDirectory()) {
      browserEntries.push({
        name: entry.name,
        path: entryPath,
        kind: "directory",
      });
      continue;
    }

    if (entry.isFile() && isSupportedAudioPath(entryPath)) {
      browserEntries.push({
        name: entry.name,
        path: entryPath,
        kind: "file",
      });
    }
  }

  return browserEntries.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "directory" ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}

export function getParentBrowserPath(directoryPath: string): string {
  const resolvedDirectory = resolve(directoryPath);
  const parent = dirname(resolvedDirectory);
  return parent === resolvedDirectory ? resolvedDirectory : parent;
}
