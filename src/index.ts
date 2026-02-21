import * as fs from 'fs';
import {
  createAgentPlugin,
  type AgentFetchContext,
  type PluginContext,
  type SessionParseOptions,
  type SessionUsageData,
} from '@tokentop/plugin-sdk';
import { CACHE_TTL_MS, SESSION_AGGREGATE_CACHE_MAX, sessionAggregateCache, sessionCache, sessionMetadataIndex } from './cache.ts';
import { parseSessionsFromProjects } from './parser.ts';
import { WINDSURF_CASCADE_PATH, WINDSURF_CODEIUM_DIR, WINDSURF_CONFIG_PATH } from './paths.ts';
import { RECONCILIATION_INTERVAL_MS, startActivityWatch, stopActivityWatch } from './watcher.ts';

const windsurfAgentPlugin = createAgentPlugin({
  id: 'windsurf',
  type: 'agent',
  name: 'Windsurf',
  version: '0.1.0',

  meta: {
    description: 'Windsurf (Codeium) editor session tracking',
    homepage: 'https://codeium.com/windsurf',
  },

  permissions: {
    filesystem: {
      read: true,
      paths: ['~/.codeium', '~/.windsurf'],
    },
  },

  agent: {
    name: 'Windsurf',
    command: 'windsurf',
    configPath: WINDSURF_CONFIG_PATH,
    sessionPath: WINDSURF_CASCADE_PATH,
  },

  capabilities: {
    sessionParsing: true,
    authReading: false,
    realTimeTracking: true,
    multiProvider: true,
  },

  startActivityWatch(_ctx: PluginContext, callback): void {
    startActivityWatch(callback);
  },

  stopActivityWatch(_ctx: PluginContext): void {
    stopActivityWatch();
  },

  async isInstalled(_ctx: PluginContext): Promise<boolean> {
    return fs.existsSync(WINDSURF_CASCADE_PATH) || fs.existsSync(WINDSURF_CODEIUM_DIR);
  },

  async parseSessions(options: SessionParseOptions, ctx: AgentFetchContext): Promise<SessionUsageData[]> {
    return parseSessionsFromProjects(options, ctx);
  },
});

export {
  CACHE_TTL_MS,
  RECONCILIATION_INTERVAL_MS,
  SESSION_AGGREGATE_CACHE_MAX,
  WINDSURF_CASCADE_PATH,
  WINDSURF_CODEIUM_DIR,
  WINDSURF_CONFIG_PATH,
  sessionAggregateCache,
  sessionCache,
  sessionMetadataIndex,
};

export default windsurfAgentPlugin;
