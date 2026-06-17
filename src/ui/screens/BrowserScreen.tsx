import type { BrowserEntry } from "../../services/fileBrowser.ts";
import { Panel } from "../components/Panel.tsx";
import { theme } from "../theme.ts";

export interface BrowserEntryView extends BrowserEntry {
  playlistNames: string[];
  isInSelectedPlaylist: boolean;
}

interface BrowserScreenProps {
  browserPath: string;
  entries: BrowserEntryView[];
  selectedIndex: number;
  selectedPlaylistName?: string;
  libraryRootCount: number;
  focusZone: "tabs" | "browserList";
  stacked: boolean;
  listHeight: number;
  onEntryChange: (index: number) => void;
  onEntrySelect: (index: number) => void;
}

export function BrowserScreen({
  browserPath,
  entries,
  selectedIndex,
  selectedPlaylistName,
  libraryRootCount,
  focusZone,
  stacked,
  listHeight,
  onEntryChange,
  onEntrySelect,
}: BrowserScreenProps) {
  const selectedEntry = entries[selectedIndex];

  const selectedEntryState =
    !selectedEntry || selectedEntry.kind === "directory"
      ? "Browse into folders or choose a file."
      : selectedEntry.isInSelectedPlaylist
        ? `Already in "${selectedPlaylistName ?? "the selected playlist"}".`
        : selectedEntry.playlistNames.length > 0
          ? `Already used in ${selectedEntry.playlistNames.length} playlist${selectedEntry.playlistNames.length === 1 ? "" : "s"}.`
          : "Not used in any playlist yet.";

  return (
    <box flexDirection={stacked ? "column" : "row"} gap={1} flexGrow={1} height="100%">
      <Panel title="Browser" focused={focusZone === "browserList"} flexGrow={1} minHeight={18} height="100%">
        <text fg={theme.accent}>{browserPath}</text>
        <text fg={theme.textMuted}>
          Enter opens directories or adds a file to {selectedPlaylistName ? `"${selectedPlaylistName}"` : "the selected playlist"}.
        </text>
        {entries.length === 0 ? (
          <text fg={theme.textMuted}>No supported audio files or child directories here.</text>
        ) : (
          <select
            focused={focusZone === "browserList"}
            selectedIndex={Math.min(selectedIndex, Math.max(entries.length - 1, 0))}
            height={listHeight}
            itemSpacing={0}
            options={entries.map((entry) => ({
              name:
                entry.kind === "directory"
                  ? `> ${entry.name}`
                  : entry.isInSelectedPlaylist
                    ? `+ ${entry.name}`
                    : entry.playlistNames.length > 0
                      ? `* ${entry.name}`
                      : `  ${entry.name}`,
              description:
                entry.kind === "directory"
                  ? entry.path
                  : entry.playlistNames.length > 0
                    ? `in ${entry.playlistNames.slice(0, 2).join(", ")}${entry.playlistNames.length > 2 ? "..." : ""}`
                    : entry.path,
            }))}
            backgroundColor={theme.surfaceRaised}
            focusedBackgroundColor={theme.surfaceRaised}
            textColor={theme.text}
            descriptionColor={theme.textMuted}
            selectedBackgroundColor={theme.accentSoft}
            selectedTextColor={theme.text}
            selectedDescriptionColor={theme.accent}
            showScrollIndicator
            onChange={onEntryChange}
            onSelect={onEntrySelect}
          />
        )}
      </Panel>

      <Panel title="Inspect" minHeight={10} width={stacked ? "100%" : 34}>
        <text fg={theme.text}>Selected playlist</text>
        <text fg={selectedPlaylistName ? theme.accent : theme.warn}>
          {selectedPlaylistName ?? "No playlist selected yet"}
        </text>
        <text fg={theme.text}>Current item</text>
        <text fg={theme.textMuted}>{selectedEntry?.name ?? "Nothing selected"}</text>
        <text fg={selectedEntry?.kind === "file" ? (selectedEntry.isInSelectedPlaylist ? theme.good : selectedEntry.playlistNames.length > 0 ? theme.warn : theme.textMuted) : theme.textMuted}>
          {selectedEntryState}
        </text>
        {selectedEntry?.kind === "file" && selectedEntry.playlistNames.length > 0 ? (
          <>
            <text fg={theme.text}>Playlists</text>
            <text fg={theme.textMuted}>{selectedEntry.playlistNames.join(", ")}</text>
          </>
        ) : null}
        <text fg={theme.text}>Library roots</text>
        <text fg={theme.textMuted}>{libraryRootCount} imported root{libraryRootCount === 1 ? "" : "s"}</text>
        <text fg={theme.text}>Path</text>
        <text fg={theme.textMuted}>{selectedEntry?.path ?? browserPath}</text>
        <text fg={theme.textMuted}>Shortcuts: Backspace goes to parent, `i` imports the current directory as a library root, `r` rescans roots.</text>
      </Panel>
    </box>
  );
}
