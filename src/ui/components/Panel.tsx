import type { ReactNode } from "react";

import { theme } from "../theme.ts";

interface PanelProps {
  title: string;
  focused?: boolean;
  children?: ReactNode;
  flexGrow?: number;
  minHeight?: number;
  width?: number | `${number}%` | "auto";
  height?: number | `${number}%` | "auto";
}

export function Panel({ title, focused = false, children, flexGrow, minHeight, width, height }: PanelProps) {
  return (
    <box
      backgroundColor={focused ? theme.surfaceRaised : theme.surface}
      paddingX={1}
      paddingY={0}
      flexGrow={flexGrow}
      minHeight={minHeight}
      width={width}
      height={height}
      flexDirection="column"
    >
      <box minHeight={2} flexDirection="row" alignItems="center">
        <text fg={focused ? theme.accent : theme.textMuted}>
          {focused ? ">" : "-"} {title}
        </text>
      </box>
      <box minHeight={1} backgroundColor={focused ? theme.accentLine : theme.line} />
      <box flexGrow={1} flexDirection="column" paddingTop={1}>
        {children}
      </box>
    </box>
  );
}
