import { stat } from "node:fs/promises";

import type { ControllerSnapshot, ManagedDeviceRecord, SyncPlan, SyncResult } from "../domain/model.ts";
import { createEmptyState } from "../domain/model.ts";
import { resolveAppPaths } from "../storage/appHome.ts";
import { StateStore } from "../storage/stateStore.ts";
import {
  addLibraryRootRecord,
  addTrackToPlaylistRecord,
  createPlaylistRecord,
  mergeDiscoveredDevicesRecord,
  removeTrackFromPlaylistRecord,
  togglePlaylistAssignmentRecord,
  updateDeviceAfterSyncRecord,
} from "../services/stateOperations.ts";
import { discoverIpods, inspectIpodMount } from "../services/deviceDiscovery.ts";
import { getPlaylistTrackViews, revalidateTracks, scanLibraryRoots, upsertTrackFromPath } from "../services/libraryService.ts";
import { planDeviceSync } from "../services/syncPlanner.ts";
import { syncDevice } from "../services/deviceSync.ts";

function nowIso(): string {
  return new Date().toISOString();
}

export class AppController {
  private state = createEmptyState();
  private discoveredDevices: ControllerSnapshot["discoveredDevices"] = [];
  private readonly store: StateStore;

  constructor(store: StateStore = new StateStore(resolveAppPaths())) {
    this.store = store;
  }

  async initialize(): Promise<ControllerSnapshot> {
    this.state = await this.store.load();
    this.state = await revalidateTracks(this.state, nowIso());
    await this.refreshDevices();
    await this.store.save(this.state);
    return this.snapshot();
  }

  snapshot(): ControllerSnapshot {
    return {
      state: this.state,
      discoveredDevices: this.discoveredDevices,
    };
  }

  getPlaylistTrackViews(playlistId: string) {
    return getPlaylistTrackViews(this.state, playlistId);
  }

  async refresh(): Promise<ControllerSnapshot> {
    this.state = await revalidateTracks(this.state, nowIso());
    await this.refreshDevices();
    await this.store.save(this.state);
    return this.snapshot();
  }

  async refreshDevices(): Promise<ControllerSnapshot> {
    this.discoveredDevices = await discoverIpods();
    this.state = mergeDiscoveredDevicesRecord(this.state, this.discoveredDevices, nowIso());
    await this.store.save(this.state);
    return this.snapshot();
  }

  async createPlaylist(name: string): Promise<ControllerSnapshot> {
    this.state = createPlaylistRecord(this.state, crypto.randomUUID(), name, nowIso());
    await this.store.save(this.state);
    return this.snapshot();
  }

  async addTrackToPlaylist(playlistId: string, sourcePath: string): Promise<ControllerSnapshot> {
    const imported = await upsertTrackFromPath(this.state, sourcePath, nowIso());
    this.state = addTrackToPlaylistRecord(imported.state, playlistId, imported.track.id, nowIso());
    await this.store.save(this.state);
    return this.snapshot();
  }

  async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<ControllerSnapshot> {
    this.state = removeTrackFromPlaylistRecord(this.state, playlistId, trackId, nowIso());
    await this.store.save(this.state);
    return this.snapshot();
  }

  async addLibraryRoot(rootPath: string): Promise<ControllerSnapshot> {
    const stats = await stat(rootPath);
    if (!stats.isDirectory()) {
      throw new Error(`Expected a directory, got "${rootPath}".`);
    }

    this.state = addLibraryRootRecord(this.state, rootPath);
    const scanResult = await scanLibraryRoots(this.state, nowIso());
    this.state = scanResult.state;
    await this.store.save(this.state);
    return this.snapshot();
  }

  async rescanLibrary(): Promise<ControllerSnapshot> {
    const scanResult = await scanLibraryRoots(this.state, nowIso());
    this.state = scanResult.state;
    await this.store.save(this.state);
    return this.snapshot();
  }

  async registerManualDevice(mountPath: string): Promise<ControllerSnapshot> {
    const discovered = await inspectIpodMount(mountPath);
    this.state = mergeDiscoveredDevicesRecord(this.state, [discovered], nowIso());
    await this.store.save(this.state);
    return this.snapshot();
  }

  async togglePlaylistAssignment(deviceId: string, playlistId: string): Promise<ControllerSnapshot> {
    this.state = togglePlaylistAssignmentRecord(this.state, deviceId, playlistId);
    await this.store.save(this.state);
    return this.snapshot();
  }

  async buildSyncPlan(deviceId: string): Promise<SyncPlan | null> {
    const device = this.state.devices.find((entry) => entry.id === deviceId);
    const mountPath = device?.lastKnownMountPath ?? device?.preferredMountPath;

    if (!device || !mountPath) {
      return null;
    }

    return planDeviceSync(this.state, device, mountPath);
  }

  async syncManagedDevice(deviceId: string): Promise<SyncResult> {
    const device = this.state.devices.find((entry) => entry.id === deviceId);
    if (!device) {
      throw new Error(`Unknown device "${deviceId}".`);
    }

    const result = await syncDevice(this.state, device, nowIso());
    this.state = updateDeviceAfterSyncRecord(this.state, result.updatedDevice);
    await this.store.save(this.state);
    return result;
  }

  getDevice(deviceId: string): ManagedDeviceRecord | undefined {
    return this.state.devices.find((device) => device.id === deviceId);
  }

  isDeviceOnline(deviceId: string): boolean {
    const device = this.state.devices.find((entry) => entry.id === deviceId);
    if (!device) {
      return false;
    }

    return this.discoveredDevices.some(
      (discoveredDevice) =>
        (device.volumeUuid && discoveredDevice.volumeUuid && device.volumeUuid === discoveredDevice.volumeUuid) ||
        device.lastKnownMountPath === discoveredDevice.mountPath,
    );
  }
}
