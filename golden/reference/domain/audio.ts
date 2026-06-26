import { extname } from "node:path";

export const SUPPORTED_AUDIO_EXTENSIONS = [
  ".mp3",
  ".m4a",
  ".m4b",
  ".m4p",
  ".aa",
  ".wav",
] as const;

export type SupportedAudioExtension = (typeof SUPPORTED_AUDIO_EXTENSIONS)[number];

const EXTENSION_SET = new Set<string>(SUPPORTED_AUDIO_EXTENSIONS);
const AAC_LIKE_EXTENSIONS = new Set<string>([".m4a", ".m4b", ".m4p", ".aa"]);

export function normalizeAudioExtension(pathOrExtension: string): string {
  const extension = extname(pathOrExtension);
  return (extension || pathOrExtension).toLowerCase();
}

export function isSupportedAudioPath(path: string): boolean {
  return EXTENSION_SET.has(normalizeAudioExtension(path));
}

export function getIpodFileType(path: string): 1 | 2 | 4 {
  const extension = normalizeAudioExtension(path);

  if (extension === ".wav") {
    return 4;
  }

  if (AAC_LIKE_EXTENSIONS.has(extension)) {
    return 2;
  }

  return 1;
}
