/** Audio-extension classification for the web client (no device-specific bits). */

const SUPPORTED = ['.mp3', '.m4a', '.m4b', '.m4p', '.aa', '.wav'];
const SET = new Set(SUPPORTED);

export function normalizeAudioExtension(pathOrExt: string): string {
	const idx = pathOrExt.lastIndexOf('.');
	const ext = idx === -1 ? pathOrExt : pathOrExt.slice(idx);
	return ext.toLowerCase();
}

export function isSupportedAudioPath(path: string): boolean {
	return SET.has(normalizeAudioExtension(path));
}
