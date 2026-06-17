#!/usr/bin/env bun

import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";

import { AppController } from "./app/controller.ts";
import { App } from "./ui/App.tsx";

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  useKittyKeyboard: {},
});

const controller = new AppController();

function shutdown(error?: unknown) {
  if (error) {
    console.error(error);
  }

  renderer.destroy();

  if (error) {
    process.exitCode = 1;
  }
}

process.on("uncaughtException", shutdown);
process.on("unhandledRejection", shutdown);

createRoot(renderer).render(<App controller={controller} />);
