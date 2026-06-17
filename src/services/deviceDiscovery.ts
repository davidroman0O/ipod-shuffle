import { access, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, join, resolve } from "node:path";

import type { DiscoveredDevice } from "../domain/model.ts";

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface CommandRunner {
  run(command: string, args: string[]): Promise<CommandResult>;
}

export interface DiscoveryFs {
  access: typeof access;
  readdir: typeof readdir;
}

const defaultFs: DiscoveryFs = {
  access,
  readdir,
};

export const bunCommandRunner: CommandRunner = {
  async run(command, args) {
    const processHandle = Bun.spawn([command, ...args], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(processHandle.stdout).text(),
      new Response(processHandle.stderr).text(),
      processHandle.exited,
    ]);

    return {
      exitCode,
      stdout,
      stderr,
    };
  },
};

function parseSizeFromDiskutilLine(line: string | undefined): number | undefined {
  if (!line) {
    return undefined;
  }

  const match = line.match(/\((\d+) Bytes\)/);
  return match ? Number(match[1]) : undefined;
}

function parseDiskutilOutput(output: string): Record<string, string> {
  const values: Record<string, string> = {};

  for (const line of output.split("\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key) {
      values[key] = value;
    }
  }

  return values;
}

export async function isIpodMountPath(mountPath: string, fs: DiscoveryFs = defaultFs): Promise<boolean> {
  try {
    await fs.access(join(resolve(mountPath), "iPod_Control"), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function inspectIpodMount(
  mountPath: string,
  runner: CommandRunner = bunCommandRunner,
): Promise<DiscoveredDevice> {
  const resolvedMountPath = resolve(mountPath);
  const diskutilResult = await runner.run("diskutil", ["info", resolvedMountPath]);
  const values = parseDiskutilOutput(diskutilResult.stdout);

  const volumeUuid = values["Volume UUID"];
  const volumeName = values["Volume Name"] ?? basename(resolvedMountPath);

  return {
    id: volumeUuid ?? resolvedMountPath,
    name: volumeName,
    mountPath: resolvedMountPath,
    volumeName,
    volumeUuid,
    deviceNode: values["Device Node"],
    mediaType: values["Media Type"],
    totalBytes: parseSizeFromDiskutilLine(values["Volume Total Space"]),
    freeBytes: parseSizeFromDiskutilLine(values["Volume Free Space"]),
  };
}

export async function discoverIpods(
  volumesRoot: string = "/Volumes",
  fs: DiscoveryFs = defaultFs,
  runner: CommandRunner = bunCommandRunner,
): Promise<DiscoveredDevice[]> {
  const resolvedVolumesRoot = resolve(volumesRoot);
  const entries = await fs.readdir(resolvedVolumesRoot, { withFileTypes: true });
  const devices: DiscoveredDevice[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) {
      continue;
    }

    const mountPath = join(resolvedVolumesRoot, entry.name);

    if (!(await isIpodMountPath(mountPath, fs))) {
      continue;
    }

    devices.push(await inspectIpodMount(mountPath, runner));
  }

  return devices.sort((left, right) => left.mountPath.localeCompare(right.mountPath));
}
