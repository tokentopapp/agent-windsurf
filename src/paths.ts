import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

const home = os.homedir();
const platform = os.platform();

export const WINDSURF_CODEIUM_DIR = path.join(home, '.codeium');
export const WINDSURF_CONFIG_PATH = path.join(WINDSURF_CODEIUM_DIR, 'windsurf');
export const WINDSURF_CASCADE_PATH = path.join(WINDSURF_CONFIG_PATH, 'cascade');

function getApplicationSupportPath(): string {
  switch (platform) {
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', 'Windsurf');
    case 'win32':
      return path.join(process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming'), 'Windsurf');
    default:
      return path.join(home, '.config', 'Windsurf');
  }
}

export const WINDSURF_APP_SUPPORT_PATH = getApplicationSupportPath();
export const WINDSURF_GLOBALSTORAGE_PATH = path.join(
  WINDSURF_APP_SUPPORT_PATH,
  'User',
  'globalStorage',
);

export async function getCascadeFiles(): Promise<string[]> {
  try {
    const entries = await fs.readdir(WINDSURF_CASCADE_PATH, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        files.push(path.join(WINDSURF_CASCADE_PATH, entry.name));
      }
    }
    return files;
  } catch {
    return [];
  }
}

export async function getCascadeDirs(): Promise<string[]> {
  try {
    const entries = await fs.readdir(WINDSURF_CASCADE_PATH, { withFileTypes: true });
    const dirs: string[] = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        dirs.push(path.join(WINDSURF_CASCADE_PATH, entry.name));
      }
    }
    return dirs;
  } catch {
    return [];
  }
}

export function getInstallationPaths(): string[] {
  return [
    WINDSURF_CASCADE_PATH,
    WINDSURF_CONFIG_PATH,
    WINDSURF_CODEIUM_DIR,
    WINDSURF_APP_SUPPORT_PATH,
  ];
}
