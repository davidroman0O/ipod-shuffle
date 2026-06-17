import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { discoverIpods, inspectIpodMount, isIpodMountPath, type CommandRunner } from "./deviceDiscovery.ts";

const cleanupPaths: string[] = [];

const runner: CommandRunner = {
  async run(_command, args) {
    return {
      exitCode: 0,
      stdout: `
Device Node: /dev/disk5
Volume Name: ${args.at(-1)?.includes("IPOD") ? "IPOD" : "UNKNOWN"}
Volume UUID: 1111-2222
Media Type: iPod
Volume Total Space: 2.0 GB (2016395264 Bytes)
Volume Free Space: 1.0 GB (1000000000 Bytes)
      `.trim(),
      stderr: "",
    };
  },
};

async function makeTempDir(prefix: string) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  cleanupPaths.push(directory);
  return directory;
}

afterEach(async () => {
  while (cleanupPaths.length > 0) {
    const path = cleanupPaths.pop();
    if (path) {
      await rm(path, { recursive: true, force: true });
    }
  }
});

describe("device discovery", () => {
  test("recognizes an iPod mount path", async () => {
    const volumesRoot = await makeTempDir("ipod-shuffle-volumes-");
    const mountPath = join(volumesRoot, "IPOD");
    await mkdir(join(mountPath, "iPod_Control"), { recursive: true });

    expect(await isIpodMountPath(mountPath)).toBe(true);
    expect(await isIpodMountPath(join(volumesRoot, "other"))).toBe(false);
  });

  test("discovers mounted iPods and parses diskutil output", async () => {
    const volumesRoot = await makeTempDir("ipod-shuffle-discover-");
    const mountPath = join(volumesRoot, "IPOD");
    await mkdir(join(mountPath, "iPod_Control"), { recursive: true });
    await mkdir(join(volumesRoot, "NotIpod"), { recursive: true });

    const devices = await discoverIpods(volumesRoot, undefined, runner);
    expect(devices).toHaveLength(1);
    expect(devices[0]?.name).toBe("IPOD");
    expect(devices[0]?.volumeUuid).toBe("1111-2222");

    const inspected = await inspectIpodMount(mountPath, runner);
    expect(inspected.deviceNode).toBe("/dev/disk5");
    expect(inspected.totalBytes).toBe(2016395264);
  });
});
