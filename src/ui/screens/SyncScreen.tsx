import type { ManagedDeviceRecord, SyncPlan } from "../../domain/model.ts";
import { Panel } from "../components/Panel.tsx";
import { theme } from "../theme.ts";

interface SyncScreenProps {
  devices: ManagedDeviceRecord[];
  selectedDeviceId?: string;
  focusZone: "tabs" | "syncDeviceList" | "syncPlan";
  stacked: boolean;
  targetListHeight: number;
  onlineDeviceIds: string[];
  plan: SyncPlan | null;
  onDeviceChange: (index: number) => void;
}

function buildPlanLines(plan: SyncPlan | null): string[] {
  if (!plan) {
    return [
      "No sync plan available yet.",
      "Select a mounted device and assign at least one playlist in the Devices tab.",
    ];
  }

  const lines = [
    `Device: ${plan.deviceName}`,
    `Mount: ${plan.mountPath}`,
    `Tracks on device after sync: ${plan.tracks.length}`,
    `Playlists on device after sync: ${plan.playlists.length + 1} (includes All Songs)`,
    `Files to copy: ${plan.copyOperations.length}`,
    `Files to reuse: ${plan.skipOperations.length}`,
    `Files to delete: ${plan.deleteOperations.length}`,
  ];

  if (plan.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    lines.push(...plan.warnings.map((warning) => `- ${warning}`));
  }

  if (plan.copyOperations.length > 0) {
    lines.push("");
    lines.push("Copy operations:");
    lines.push(...plan.copyOperations.slice(0, 10).map((operation) => `- ${operation.relativePath} <= ${operation.sourcePath}`));
    if (plan.copyOperations.length > 10) {
      lines.push(`- ... ${plan.copyOperations.length - 10} more`);
    }
  }

  if (plan.deleteOperations.length > 0) {
    lines.push("");
    lines.push("Delete operations:");
    lines.push(...plan.deleteOperations.slice(0, 10).map((relativePath) => `- ${relativePath}`));
    if (plan.deleteOperations.length > 10) {
      lines.push(`- ... ${plan.deleteOperations.length - 10} more`);
    }
  }

  return lines;
}

export function SyncScreen({
  devices,
  selectedDeviceId,
  focusZone,
  stacked,
  targetListHeight,
  onlineDeviceIds,
  plan,
  onDeviceChange,
}: SyncScreenProps) {
  const selectedDeviceIndex = Math.max(
    0,
    devices.findIndex((device) => device.id === selectedDeviceId),
  );

  const lines = buildPlanLines(plan);

  return (
    <box flexDirection={stacked ? "column" : "row"} gap={1} flexGrow={1} height="100%">
      <Panel title="Sync Target" focused={focusZone === "syncDeviceList"} width={stacked ? "100%" : 34} minHeight={12}>
        {devices.length === 0 ? (
          <text fg={theme.textMuted}>No managed devices yet.</text>
        ) : (
          <select
            focused={focusZone === "syncDeviceList"}
            selectedIndex={selectedDeviceIndex}
            height={targetListHeight}
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
        <text fg={theme.textMuted}>Shortcut: `s` performs the sync for the selected mounted device.</text>
      </Panel>

      <Panel title="Sync Preview" focused={focusZone === "syncPlan"} flexGrow={1} minHeight={18} height="100%">
        <scrollbox
          focused={focusZone === "syncPlan"}
          flexGrow={1}
          style={{
            rootOptions: { backgroundColor: theme.surfaceRaised, flexGrow: 1 },
            wrapperOptions: { backgroundColor: theme.surfaceRaised, flexGrow: 1 },
            viewportOptions: { backgroundColor: theme.surfaceRaised, flexGrow: 1 },
            contentOptions: { backgroundColor: theme.surfaceRaised },
          }}
        >
          {lines.map((line, index) => (
            <text
              key={`plan-line-${index}`}
              fg={
                line.startsWith("- ")
                  ? theme.textMuted
                  : line.startsWith("Warnings")
                    ? theme.warn
                    : line.startsWith("Copy")
                      ? theme.good
                      : line.startsWith("Delete")
                        ? theme.bad
                        : theme.text
              }
            >
              {line}
            </text>
          ))}
        </scrollbox>
      </Panel>
    </box>
  );
}
