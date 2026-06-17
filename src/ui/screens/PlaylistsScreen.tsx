import type { PlaylistRecord, PlaylistTrackView } from "../../domain/model.ts";
import { Panel } from "../components/Panel.tsx";
import { theme } from "../theme.ts";

interface PlaylistsScreenProps {
  playlists: PlaylistRecord[];
  selectedPlaylistId?: string;
  selectedTrackIndex: number;
  trackViews: PlaylistTrackView[];
  focusZone: "tabs" | "playlistName" | "playlistList" | "trackList";
  newPlaylistName: string;
  onPlaylistNameChange: (value: string) => void;
  onPlaylistChange: (index: number) => void;
  onTrackChange: (index: number) => void;
  stacked: boolean;
  playlistListHeight: number;
  trackListHeight: number;
}

export function PlaylistsScreen({
  playlists,
  selectedPlaylistId,
  selectedTrackIndex,
  trackViews,
  focusZone,
  newPlaylistName,
  onPlaylistNameChange,
  onPlaylistChange,
  onTrackChange,
  stacked,
  playlistListHeight,
  trackListHeight,
}: PlaylistsScreenProps) {
  const selectedPlaylistIndex = Math.max(
    0,
    playlists.findIndex((playlist) => playlist.id === selectedPlaylistId),
  );

  return (
    <box flexDirection={stacked ? "column" : "row"} gap={1} flexGrow={1} height="100%">
      <box width={stacked ? "100%" : 34} flexDirection="column" gap={1} height="100%">
        <Panel title="New Playlist" focused={focusZone === "playlistName"} minHeight={5}>
          <text fg={theme.textMuted}>Name it, hit Enter, then use the browser to add tracks.</text>
          <box backgroundColor={theme.surfaceRaised} height={3} paddingX={1}>
            <input
              placeholder="Weekend drive"
              value={newPlaylistName}
              onInput={onPlaylistNameChange}
              focused={focusZone === "playlistName"}
              backgroundColor={theme.surfaceRaised}
              focusedBackgroundColor={theme.surfaceRaised}
              textColor={theme.text}
              cursorColor={theme.accent}
            />
          </box>
        </Panel>
        <Panel title={`Playlists (${playlists.length})`} focused={focusZone === "playlistList"} flexGrow={1} minHeight={12} height="100%">
          {playlists.length === 0 ? (
            <text fg={theme.textMuted}>No playlists yet.</text>
          ) : (
            <select
              focused={focusZone === "playlistList"}
              selectedIndex={selectedPlaylistIndex}
              height={playlistListHeight}
              itemSpacing={0}
              options={playlists.map((playlist) => ({
                name: `# ${playlist.name}`,
                description: `${playlist.trackIds.length} track${playlist.trackIds.length === 1 ? "" : "s"}`,
              }))}
              backgroundColor={theme.surfaceRaised}
              focusedBackgroundColor={theme.surfaceRaised}
              textColor={theme.text}
              descriptionColor={theme.textMuted}
              selectedBackgroundColor={theme.accentSoft}
              selectedTextColor={theme.text}
              selectedDescriptionColor={theme.accent}
              showScrollIndicator
              onChange={onPlaylistChange}
            />
          )}
        </Panel>
      </box>

      <Panel
        title={selectedPlaylistId ? "Playlist Tracks" : "Playlist Tracks"}
        focused={focusZone === "trackList"}
        flexGrow={1}
        minHeight={18}
      >
        {!selectedPlaylistId ? (
          <text fg={theme.textMuted}>Select or create a playlist to inspect its tracks.</text>
        ) : trackViews.length === 0 ? (
          <text fg={theme.textMuted}>This playlist is empty. Switch to Browser and add music.</text>
        ) : (
          <select
            focused={focusZone === "trackList"}
            selectedIndex={Math.min(selectedTrackIndex, Math.max(trackViews.length - 1, 0))}
            height={trackListHeight}
            itemSpacing={0}
            options={trackViews.map((track) => ({
              name: `${track.exists ? "+" : "!"} ${track.fileName}`,
              description: track.sourcePath,
            }))}
            backgroundColor={theme.surfaceRaised}
            focusedBackgroundColor={theme.surfaceRaised}
            textColor={theme.text}
            descriptionColor={theme.textMuted}
            selectedBackgroundColor={trackViews[Math.min(selectedTrackIndex, Math.max(trackViews.length - 1, 0))]?.exists === false ? theme.badSoft : theme.accentSoft}
            selectedTextColor={theme.text}
            selectedDescriptionColor={trackViews[Math.min(selectedTrackIndex, Math.max(trackViews.length - 1, 0))]?.exists === false ? theme.bad : theme.accent}
            showScrollIndicator
            onChange={onTrackChange}
          />
        )}
        <text fg={theme.textMuted}>Shortcut: `x` removes the selected track from this playlist.</text>
      </Panel>
    </box>
  );
}
