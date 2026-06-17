import { homedir } from "node:os";
import { resolve } from "node:path";
import { useEffect, useMemo, useState } from "react";

import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";

import type { ControllerSnapshot, ManagedDeviceRecord, SyncPlan } from "../domain/model.ts";
import { AppController } from "../app/controller.ts";
import { createEmptyState } from "../domain/model.ts";
import { getParentBrowserPath, listBrowserEntries, type BrowserEntry } from "../services/fileBrowser.ts";
import { BrowserScreen, type BrowserEntryView } from "./screens/BrowserScreen.tsx";
import { DevicesScreen } from "./screens/DevicesScreen.tsx";
import { PlaylistsScreen } from "./screens/PlaylistsScreen.tsx";
import { SyncScreen } from "./screens/SyncScreen.tsx";
import { theme } from "./theme.ts";

type TabId = "playlists" | "browser" | "devices" | "sync";
type FocusZone =
  | "tabs"
  | "playlistName"
  | "playlistList"
  | "trackList"
  | "browserList"
  | "deviceList"
  | "assignmentList"
  | "manualPath"
  | "syncDeviceList"
  | "syncPlan";

const TAB_OPTIONS = [
  { name: "Playlists", description: "Create and inspect playlists", id: "playlists" as const },
  { name: "Browser", description: "Add music from local folders", id: "browser" as const },
  { name: "Devices", description: "Locate iPods and assign playlists", id: "devices" as const },
  { name: "Sync", description: "Preview and push to the iPod", id: "sync" as const },
];

const FOCUS_ORDER: Record<TabId, FocusZone[]> = {
  playlists: ["tabs", "playlistName", "playlistList", "trackList"],
  browser: ["tabs", "browserList"],
  devices: ["tabs", "deviceList", "assignmentList", "manualPath"],
  sync: ["tabs", "syncDeviceList", "syncPlan"],
};

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function clampIndex(length: number, value: number): number {
  if (length <= 0) {
    return 0;
  }

  return Math.min(Math.max(value, 0), length - 1);
}

function formatPlaylistNames(names: string[]): string {
  if (names.length === 0) {
    return "";
  }

  if (names.length <= 3) {
    return names.join(", ");
  }

  return `${names.slice(0, 3).join(", ")} +${names.length - 3}`;
}

export function App({ controller }: { controller: AppController }) {
  const renderer = useRenderer();
  const dimensions = useTerminalDimensions();
  const stacked = dimensions.width < 120;

  const [snapshot, setSnapshot] = useState<ControllerSnapshot>({
    state: createEmptyState(),
    discoveredDevices: [],
  });
  const [activeTab, setActiveTab] = useState<TabId>("playlists");
  const [focusZone, setFocusZone] = useState<FocusZone>("playlistName");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>();
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(0);
  const [browserPath, setBrowserPath] = useState(resolve(homedir()));
  const [browserEntries, setBrowserEntries] = useState<BrowserEntry[]>([]);
  const [selectedBrowserIndex, setSelectedBrowserIndex] = useState(0);
  const [selectedAssignmentIndex, setSelectedAssignmentIndex] = useState(0);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>();
  const [manualDevicePath, setManualDevicePath] = useState("/Volumes/IPOD");
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [syncPlan, setSyncPlan] = useState<SyncPlan | null>(null);
  const [statusMessage, setStatusMessage] = useState("Loading iPod Shuffle manager...");
  const [busy, setBusy] = useState(false);

  const selectedPlaylist = snapshot.state.playlists.find((playlist) => playlist.id === selectedPlaylistId);
  const playlistTrackViews = selectedPlaylistId ? controller.getPlaylistTrackViews(selectedPlaylistId) : [];
  const trackBySourcePath = useMemo(
    () => new Map(snapshot.state.tracks.map((track) => [track.sourcePath, track])),
    [snapshot.state.tracks],
  );
  const playlistNamesByTrackId = useMemo(() => {
    const mapping = new Map<string, string[]>();

    for (const playlist of snapshot.state.playlists) {
      for (const trackId of playlist.trackIds) {
        mapping.set(trackId, [...(mapping.get(trackId) ?? []), playlist.name]);
      }
    }

    return mapping;
  }, [snapshot.state.playlists]);
  const browserEntryViews = useMemo<BrowserEntryView[]>(
    () =>
      browserEntries.map((entry) => {
        if (entry.kind === "directory") {
          return {
            ...entry,
            playlistNames: [],
            isInSelectedPlaylist: false,
          };
        }

        const matchedTrack = trackBySourcePath.get(entry.path);
        const playlistNames = matchedTrack ? playlistNamesByTrackId.get(matchedTrack.id) ?? [] : [];
        const isInSelectedPlaylist = Boolean(matchedTrack && selectedPlaylist?.trackIds.includes(matchedTrack.id));

        return {
          ...entry,
          playlistNames,
          isInSelectedPlaylist,
        };
      }),
    [browserEntries, playlistNamesByTrackId, selectedPlaylist?.trackIds, trackBySourcePath],
  );
  const selectedBrowserEntry = browserEntryViews[selectedBrowserIndex];
  const onlineDeviceIds = useMemo(
    () => snapshot.state.devices.filter((device) => controller.isDeviceOnline(device.id)).map((device) => device.id),
    [controller, snapshot.state.devices],
  );
  const contentHeight = Math.max(dimensions.height - (stacked ? 12 : 9), 12);
  const playlistListHeight = stacked ? 8 : Math.max(contentHeight - 9, 10);
  const playlistTrackListHeight = stacked ? 10 : Math.max(contentHeight - 4, 14);
  const browserListHeight = stacked ? 10 : Math.max(contentHeight - 3, 16);
  const deviceListHeight = stacked ? 8 : Math.max(Math.floor(contentHeight * 0.42), 8);
  const assignmentListHeight = stacked ? 10 : Math.max(contentHeight - 4, 14);
  const syncTargetListHeight = stacked ? 8 : Math.max(Math.floor(contentHeight * 0.38), 8);

  useEffect(() => {
    let cancelled = false;

    void controller
      .initialize()
      .then((nextSnapshot) => {
        if (cancelled) {
          return;
        }

        setSnapshot(nextSnapshot);
        setStatusMessage(
          nextSnapshot.state.devices.length > 0
            ? `Loaded ${nextSnapshot.state.devices.length} device profile(s) and ${nextSnapshot.state.playlists.length} playlist(s).`
            : "Loaded state. No iPod detected yet.",
        );
      })
      .catch((error) => {
        if (!cancelled) {
          setStatusMessage(`Startup failed: ${formatError(error)}`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [controller]);

  useEffect(() => {
    if (!selectedPlaylistId && snapshot.state.playlists.length > 0) {
      setSelectedPlaylistId(snapshot.state.playlists[0]?.id);
      return;
    }

    if (selectedPlaylistId && !snapshot.state.playlists.some((playlist) => playlist.id === selectedPlaylistId)) {
      setSelectedPlaylistId(snapshot.state.playlists[0]?.id);
    }
  }, [selectedPlaylistId, snapshot.state.playlists]);

  useEffect(() => {
    if (!selectedDeviceId && snapshot.state.devices.length > 0) {
      setSelectedDeviceId(snapshot.state.devices[0]?.id);
      return;
    }

    if (selectedDeviceId && !snapshot.state.devices.some((device) => device.id === selectedDeviceId)) {
      setSelectedDeviceId(snapshot.state.devices[0]?.id);
    }
  }, [selectedDeviceId, snapshot.state.devices]);

  useEffect(() => {
    setSelectedTrackIndex((value) => clampIndex(playlistTrackViews.length, value));
  }, [playlistTrackViews.length]);

  useEffect(() => {
    setSelectedAssignmentIndex((value) => clampIndex(snapshot.state.playlists.length, value));
  }, [snapshot.state.playlists.length]);

  useEffect(() => {
    setSelectedBrowserIndex((value) => clampIndex(browserEntries.length, value));
  }, [browserEntries.length]);

  useEffect(() => {
    let cancelled = false;

    void listBrowserEntries(browserPath)
      .then((entries) => {
        if (!cancelled) {
          setBrowserEntries(entries);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setBrowserEntries([]);
          setStatusMessage(`Cannot read ${browserPath}: ${formatError(error)}`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [browserPath]);

  useEffect(() => {
    setFocusZone(FOCUS_ORDER[activeTab][0] ?? "tabs");
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "sync" || !selectedDeviceId) {
      setSyncPlan(null);
      return;
    }

    let cancelled = false;

    void controller
      .buildSyncPlan(selectedDeviceId)
      .then((plan) => {
        if (!cancelled) {
          setSyncPlan(plan);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setSyncPlan(null);
          setStatusMessage(`Sync plan failed: ${formatError(error)}`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, controller, selectedDeviceId, snapshot]);

  const currentDevice = snapshot.state.devices.find((device) => device.id === selectedDeviceId);

  function cycleFocus(reverse = false) {
    const order = FOCUS_ORDER[activeTab];
    const currentIndex = order.indexOf(focusZone);
    const baseIndex = currentIndex === -1 ? 0 : currentIndex;
    const delta = reverse ? -1 : 1;
    const nextIndex = (baseIndex + delta + order.length) % order.length;
    setFocusZone(order[nextIndex] ?? order[0] ?? "tabs");
  }

  function setSnapshotAndStatus(nextSnapshot: ControllerSnapshot, message: string) {
    setSnapshot(nextSnapshot);
    setStatusMessage(message);
  }

  async function runSnapshotAction(action: Promise<ControllerSnapshot>, successMessage: string) {
    setBusy(true);
    try {
      const nextSnapshot = await action;
      setSnapshotAndStatus(nextSnapshot, successMessage);
    } catch (error) {
      setStatusMessage(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function handlePlaylistSubmit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      setStatusMessage("Playlist name cannot be empty.");
      return;
    }

    setBusy(true);
    try {
      const nextSnapshot = await controller.createPlaylist(trimmed);
      const createdPlaylist = nextSnapshot.state.playlists.at(-1);
      setNewPlaylistName("");
      setSelectedPlaylistId(createdPlaylist?.id);
      setSnapshotAndStatus(nextSnapshot, `Created playlist "${trimmed}".`);
    } catch (error) {
      setStatusMessage(formatError(error));
    } finally {
      setBusy(false);
    }
  }

  async function handleBrowserSelect(index: number) {
    const entry = browserEntryViews[index];
    if (!entry) {
      return;
    }

    if (entry.kind === "directory") {
      setBrowserPath(entry.path);
      setStatusMessage(`Opened ${entry.path}`);
      return;
    }

    if (!selectedPlaylistId) {
      setStatusMessage("Select a playlist first so the chosen track has somewhere to go.");
      return;
    }

    if (entry.isInSelectedPlaylist) {
      setStatusMessage(`${entry.name} is already in "${selectedPlaylist?.name ?? "the selected playlist"}".`);
      return;
    }

    await runSnapshotAction(
      controller.addTrackToPlaylist(selectedPlaylistId, entry.path),
      `Added ${entry.name} to ${selectedPlaylist?.name ?? "the selected playlist"}${
        entry.playlistNames.length > 0 ? ` · already also in ${formatPlaylistNames(entry.playlistNames)}` : ""
      }.`,
    );
  }

  async function handleRemoveSelectedTrack() {
    if (!selectedPlaylistId) {
      return;
    }

    const selectedTrack = playlistTrackViews[selectedTrackIndex];
    if (!selectedTrack) {
      return;
    }

    await runSnapshotAction(
      controller.removeTrackFromPlaylist(selectedPlaylistId, selectedTrack.trackId),
      `Removed ${selectedTrack.fileName} from ${selectedPlaylist?.name ?? "the playlist"}.`,
    );
  }

  async function handleManualDeviceSubmit(value: string) {
    if (!value.trim()) {
      setStatusMessage("Enter a mount path first.");
      return;
    }

    await runSnapshotAction(controller.registerManualDevice(value.trim()), `Registered device at ${value.trim()}.`);
  }

  async function handleToggleAssignment(index: number) {
    const playlist = snapshot.state.playlists[index];
    if (!selectedDeviceId || !playlist) {
      return;
    }

    await runSnapshotAction(
      controller.togglePlaylistAssignment(selectedDeviceId, playlist.id),
      `Updated device assignment for "${playlist.name}".`,
    );
  }

  async function handleSyncSelectedDevice() {
    if (!selectedDeviceId || !currentDevice) {
      setStatusMessage("Select a device first.");
      return;
    }

    if (!controller.isDeviceOnline(selectedDeviceId)) {
      setStatusMessage(`"${currentDevice.name}" is not mounted right now.`);
      return;
    }

    setBusy(true);
    try {
      const result = await controller.syncManagedDevice(selectedDeviceId);
      const nextSnapshot = controller.snapshot();
      setSnapshot(nextSnapshot);
      setStatusMessage(
        `Synced ${result.plan.tracks.length} track(s) and wrote ${result.writtenDatabaseBytes} bytes of iTunesSD data.`,
      );
      setSyncPlan(result.plan);
    } catch (error) {
      setStatusMessage(`Sync failed: ${formatError(error)}`);
    } finally {
      setBusy(false);
    }
  }

  const inputFocused = focusZone === "playlistName" || focusZone === "manualPath";

  useKeyboard((key) => {
    if (key.name === "tab") {
      cycleFocus(key.shift);
      return;
    }

    if (inputFocused) {
      if (key.name === "return") {
        if (focusZone === "playlistName") {
          void handlePlaylistSubmit(newPlaylistName);
          return;
        }

        if (focusZone === "manualPath") {
          void handleManualDeviceSubmit(manualDevicePath);
          return;
        }
      }

      return;
    }

    if (key.name === "q") {
      renderer.destroy();
      return;
    }

    if (key.ctrl && key.name === "r") {
      void runSnapshotAction(controller.refresh(), "Refreshed library state and device discovery.");
      return;
    }

    if (activeTab === "browser" && focusZone === "browserList" && key.name === "backspace") {
      setBrowserPath(getParentBrowserPath(browserPath));
      setStatusMessage(`Moved to ${getParentBrowserPath(browserPath)}`);
      return;
    }

    if (activeTab === "browser" && key.name === "i") {
      void runSnapshotAction(controller.addLibraryRoot(browserPath), `Imported library root ${browserPath}.`);
      return;
    }

    if (activeTab === "browser" && key.name === "r") {
      void runSnapshotAction(controller.rescanLibrary(), "Rescanned all imported library roots.");
      return;
    }

    if (activeTab === "playlists" && focusZone === "trackList" && (key.name === "x" || key.name === "delete")) {
      void handleRemoveSelectedTrack();
      return;
    }

    if (activeTab === "devices" && key.name === "r") {
      void runSnapshotAction(controller.refreshDevices(), "Refreshed mounted iPod discovery.");
      return;
    }

    if (activeTab === "sync" && key.name === "s") {
      void handleSyncSelectedDevice();
    }
  });

  return (
    <box
      backgroundColor={theme.background}
      padding={1}
      width="100%"
      height="100%"
      flexDirection="column"
      gap={0}
    >
      <box
        minHeight={stacked ? 3 : 2}
        flexDirection={stacked ? "column" : "row"}
        justifyContent="space-between"
        backgroundColor={theme.surfaceMuted}
        paddingX={1}
      >
        <text fg={theme.accent}>ipod shuffle · library to device</text>
        <text fg={busy ? theme.warn : theme.textMuted}>
          {busy ? "busy" : "ready"} · {snapshot.state.tracks.length} tracks · {snapshot.state.playlists.length} playlists · {snapshot.state.devices.length} devices
        </text>
      </box>

      <box backgroundColor={theme.surface} paddingX={1}>
        <tab-select
          focused={focusZone === "tabs"}
          width={Math.max(64, dimensions.width - 4)}
          tabWidth={stacked ? 16 : 22}
          options={TAB_OPTIONS}
          backgroundColor={theme.surface}
          focusedBackgroundColor={theme.surface}
          selectedBackgroundColor={theme.accentSoft}
          selectedTextColor={theme.text}
          selectedDescriptionColor={theme.accent}
          textColor={theme.textMuted}
          showUnderline
          onChange={(index) => {
            const nextTab = TAB_OPTIONS[index]?.id;
            if (nextTab) {
              setActiveTab(nextTab);
            }
          }}
        />
      </box>

      <box flexGrow={1} height="100%" paddingTop={1} paddingBottom={1}>
        {activeTab === "playlists" ? (
          <PlaylistsScreen
            playlists={snapshot.state.playlists}
            selectedPlaylistId={selectedPlaylistId}
            selectedTrackIndex={selectedTrackIndex}
            trackViews={playlistTrackViews}
            focusZone={focusZone as "tabs" | "playlistName" | "playlistList" | "trackList"}
            newPlaylistName={newPlaylistName}
            onPlaylistNameChange={setNewPlaylistName}
            onPlaylistChange={(index) => setSelectedPlaylistId(snapshot.state.playlists[index]?.id)}
            onTrackChange={setSelectedTrackIndex}
            stacked={stacked}
            playlistListHeight={playlistListHeight}
            trackListHeight={playlistTrackListHeight}
          />
        ) : null}

        {activeTab === "browser" ? (
          <BrowserScreen
            browserPath={browserPath}
            entries={browserEntryViews}
            selectedIndex={selectedBrowserIndex}
            selectedPlaylistName={selectedPlaylist?.name}
            libraryRootCount={snapshot.state.libraryRoots.length}
            focusZone={focusZone as "tabs" | "browserList"}
            stacked={stacked}
            listHeight={browserListHeight}
            onEntryChange={setSelectedBrowserIndex}
            onEntrySelect={(index) => void handleBrowserSelect(index)}
          />
        ) : null}

        {activeTab === "devices" ? (
          <DevicesScreen
            devices={snapshot.state.devices}
            playlists={snapshot.state.playlists}
            selectedDeviceId={selectedDeviceId}
            selectedAssignmentIndex={selectedAssignmentIndex}
            manualDevicePath={manualDevicePath}
            focusZone={focusZone as "tabs" | "deviceList" | "assignmentList" | "manualPath"}
            stacked={stacked}
            deviceListHeight={deviceListHeight}
            assignmentListHeight={assignmentListHeight}
            onlineDeviceIds={onlineDeviceIds}
            onDeviceChange={(index) => setSelectedDeviceId(snapshot.state.devices[index]?.id)}
            onAssignmentChange={setSelectedAssignmentIndex}
            onAssignmentToggle={(index) => void handleToggleAssignment(index)}
            onManualPathChange={setManualDevicePath}
          />
        ) : null}

        {activeTab === "sync" ? (
          <SyncScreen
            devices={snapshot.state.devices}
            selectedDeviceId={selectedDeviceId}
            focusZone={focusZone as "tabs" | "syncDeviceList" | "syncPlan"}
            stacked={stacked}
            targetListHeight={syncTargetListHeight}
            onlineDeviceIds={onlineDeviceIds}
            plan={syncPlan}
            onDeviceChange={(index) => setSelectedDeviceId(snapshot.state.devices[index]?.id)}
          />
        ) : null}
      </box>

      <box minHeight={2} backgroundColor={theme.surfaceMuted} paddingX={1}>
        <text fg={busy ? theme.warn : theme.text}>{statusMessage}</text>
      </box>
    </box>
  );
}
