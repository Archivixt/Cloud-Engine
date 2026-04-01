import * as fs from 'fs';
import * as path from 'path';

export interface DiscordConfig {
  token: string;
  storageChannelId: string;
}

export interface ServerConfig {
  port: number;
  host: string;
}

export interface UploadConfig {
  chunkSizeMB: number;
  maxFileSizeMB: number;
}

export interface PathsConfig {
  chunksDir: string;
  tempDir: string;
  database: string;
}

export interface Config {
  discord: DiscordConfig;
  server: ServerConfig;
  upload: UploadConfig;
  paths: PathsConfig;
}

let configCache: Config | null = null;

export function loadConfig(): Config {
  if (configCache) return configCache;

  const configPath = path.resolve(process.cwd(), 'config.json');
  
  if (!fs.existsSync(configPath)) {
    throw new Error('config.json not found. Please create it from config.example.json');
  }

  const rawConfig = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(rawConfig) as Config;

  const dirs = [config.paths.chunksDir, config.paths.tempDir, path.dirname(config.paths.database)];
  dirs.forEach(dir => {
    const absoluteDir = path.resolve(process.cwd(), dir);
    if (!fs.existsSync(absoluteDir)) {
      fs.mkdirSync(absoluteDir, { recursive: true });
    }
  });

  configCache = config;
  return config;
}

export function getChunkSizeBytes(): number {
  return loadConfig().upload.chunkSizeMB * 1024 * 1024;
}

export function getMaxFileSizeBytes(): number {
  return loadConfig().upload.maxFileSizeMB * 1024 * 1024;
}
