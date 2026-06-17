import { homedir } from "node:os";
import { join, resolve } from "node:path";

export interface AppPaths {
  appHome: string;
  stateFile: string;
}

export function resolveAppPaths(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  homeDirectory: string = homedir(),
): AppPaths {
  const override = env.IPOD_SHUFFLE_HOME?.trim();

  if (override) {
    const appHome = resolve(override);
    return {
      appHome,
      stateFile: join(appHome, "state.json"),
    };
  }

  let appHome: string;

  if (platform === "darwin") {
    appHome = join(homeDirectory, "Library", "Application Support", "ipod-shuffle");
  } else if (env.XDG_CONFIG_HOME) {
    appHome = join(env.XDG_CONFIG_HOME, "ipod-shuffle");
  } else {
    appHome = join(homeDirectory, ".config", "ipod-shuffle");
  }

  return {
    appHome,
    stateFile: join(appHome, "state.json"),
  };
}
