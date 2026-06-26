"use strict";

/**
 * Audio extension classification for the ipod product layer.
 *
 * This is the port of the original src/domain/audio.ts minus the iTunes filetype
 * mapping, which now lives in the Go engine (it is device-format-specific).
 */

const SUPPORTED_AUDIO_EXTENSIONS = [".mp3", ".m4a", ".m4b", ".m4p", ".aa", ".wav"];

const EXTENSION_SET = new Set(SUPPORTED_AUDIO_EXTENSIONS);

/** Lowercase the extension including the leading dot. */
function normalizeAudioExtension(pathOrExtension) {
	const idx = pathOrExtension.lastIndexOf(".");
	const extension = idx === -1 ? pathOrExtension : pathOrExtension.slice(idx);
	return extension.toLowerCase();
}

function isSupportedAudioPath(path) {
	return EXTENSION_SET.has(normalizeAudioExtension(path));
}

module.exports = {
	SUPPORTED_AUDIO_EXTENSIONS,
	normalizeAudioExtension,
	isSupportedAudioPath
};
