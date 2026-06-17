import type { ManagedDeviceRecord, PlaylistRecord } from "../../domain/model.ts";
import { Panel } from "../components/Panel.tsx";
import { theme } from "../theme.ts";

interface DevicesScreenProps {
  devices: ManagedDeviceRecord[];
  playlists: PlaylistRecord[];
  selectedDeviceId?: string;
  selectedAssignmentIndex: number;
  manualDevicePath: string;
  focusZone: "tabs" | "deviceList" | "assignmentList" | "manualPath";
  stacked: boolean;
  deviceListHeight: number;
  assignmentListHeight: number;
  onlineDeviceIds: string[];
  onDeviceChange: (index: number) => void;
  onAssignmentChange: (index: number) => void;
  onAssignmentToggle: (index: number) => void;
  onManualPathChange: (value: string) => void;
}

export function DevicesScreen({
  devices,
  playlists,
  selectedDeviceId,
  selectedAssignmentIndex,
  manualDevicePath,
  focusZone,
  stacked,
  deviceListHeight,
  assignmentListHeight,
  onlineDeviceIds,
  onDeviceChange,
  onAssignmentChange,
  onAssignmentToggle,
  onManualPathChange,
}: DevicesScreenProps) {
  const selectedDeviceIndex = Math.max(
    0,
    devices.findIndex((device) => device.id === selectedDeviceId),
  );
  const selectedDevice = devices[selectedDeviceIndex];

  return (
    <box flexDirection={stacked ? "column" : "row"} gap={1} flexGrow={1} height="100%">
      <box width={stacked ? "100%" : 34} flexDirection="column" gap={1} height="100%">
        <Panel title="Known iPods" focused={focusZone === "deviceList"} flexGrow={1} minHeight={12}>
          {devices.length === 0 ? (
            <text fg={theme.textMuted}>No iPod Shuffle found yet.</text>
          ) : (
            <select
              focused={focusZone === "deviceList"}
              selectedIndex={selectedDeviceIndex}
              height={deviceListHeight}
              itemSpacing={0}
              options={devices.map((device) => ({
                name: `${onlineDeviceIds.includes(device.id) ? "+" : "-"} ${device.name}`,
                description: device.lastKnownMountPath ?? device.preferredMountPath ?? "Unknown mount path",
              }))}
              backgroundColor={theme.surfaceRaised}
              focusedBackgroundColor={theme.surfaceRaised}
              textColor={theme.text}
              descriptionColor={theme.textMuted}
              selectedBackgroundColor={theme.accentSoft}
              selectedTextColor={theme.text}
              selectedDescriptionColor={theme.accent}
              showScrollIndicator
              onChange={onDeviceChange}
            />
          )}
        </Panel>
        <Panel title="Locate Manually" focused={focusZone === "manualPath"} minHeight={5}>
          <text fg={theme.textMuted}>Useful when a device is mounted somewhere other than `/Volumes/*`.</text>
          <box backgroundColor={theme.surfaceRaised} height={3} paddingX={1}>
            <input
              value={manualDevicePath}
              onInput={onManualPathChange}
              focused={focusZone === "manualPath"}
              backgroundColor={theme.surfaceRaised}
              focusedBackgroundColor={theme.surfaceRaised}
              textColor={theme.text}
              cursorColor={theme.accent}
            />
          </box>
        </Panel>
      </box>

      <Panel title="Playlist Assignments" focused={focusZone === "assignmentList"} flexGrow={1} minHeight={18} height="100%">
        {!selectedDevice ? (
          <text fg={theme.textMuted}>Select a device first.</text>
        ) : playlists.length === 0 ? (
          <text fg={theme.textMuted}>Create a playlist before assigning anything to a device.</text>
        ) : (
          <>
            <text fg={theme.accent}>
              {selectedDevice.name} · {onlineDeviceIds.includes(selectedDevice.id) ? "mounted now" : "remembered only"}
            </text>
            <select
              focused={focusZone === "assignmentList"}
              selectedIndex={Math.min(selectedAssignmentIndex, Math.max(playlists.length - 1, 0))}
              height={assignmentListHeight}
              itemSpacing={0}
              options={playlists.map((playlist) => ({
                name: `${selectedDevice.playlistIds.includes(playlist.id) ? "+" : "-"} ${playlist.name}`,
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
              onChange={onAssignmentChange}
              onSelect={onAssignmentToggle}
            />
          </>
        )}
        <text fg={theme.textMuted}>Press Enter on a playlist to toggle whether it belongs on the selected iPod.</text>
      </Panel>
    </box>
  );
}
