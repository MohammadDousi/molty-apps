import { promises as fs } from "node:fs";
import path from "node:path";
import type { UserConfig } from "@molty/shared";

const defaultConfig: UserConfig = {
  username: "",
  apiKey: "",
  friends: []
};

export type ConfigStore = {
  get: () => Promise<UserConfig>;
  set: (config: UserConfig) => Promise<UserConfig>;
  update: (updater: (config: UserConfig) => UserConfig) => Promise<UserConfig>;
};

const readJson = async (filePath: string): Promise<UserConfig> => {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<UserConfig>;
  return {
    ...defaultConfig,
    ...parsed,
    friends: Array.isArray(parsed.friends) ? parsed.friends : []
  } as UserConfig;
};

export const createConfigStore = (dataDir: string): ConfigStore => {
  const configPath = path.join(dataDir, "config.json");

  const get = async () => {
    try {
      return await readJson(configPath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return { ...defaultConfig };
      }
      throw error;
    }
  };

  const set = async (config: UserConfig) => {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
    return config;
  };

  const update = async (updater: (config: UserConfig) => UserConfig) => {
    const current = await get();
    const next = updater(current);
    return set(next);
  };

  return { get, set, update };
};
