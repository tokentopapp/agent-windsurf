import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  createAgentPlugin,
  type AgentFetchContext,
  type PluginContext,
  type SessionParseOptions,
  type SessionUsageData,
} from '@tokentop/plugin-sdk';

// TODO: Implement session parsing for Windsurf
// See @tokentop/agent-opencode for a complete reference implementation.

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
      paths: ['~/.windsurf', '~/.codeium'],
    },
  },

  agent: {
    name: 'Windsurf',
    command: 'windsurf',
    configPath: path.join(os.homedir(), '.windsurf'),
    sessionPath: path.join(os.homedir(), '.windsurf'),
  },

  capabilities: {
    sessionParsing: false,
    authReading: false,
    realTimeTracking: false,
    multiProvider: false,
  },

  async isInstalled(_ctx: PluginContext): Promise<boolean> {
    return fs.existsSync(path.join(os.homedir(), '.windsurf')) || fs.existsSync(path.join(os.homedir(), '.codeium'));
  },

  async parseSessions(_options: SessionParseOptions, _ctx: AgentFetchContext): Promise<SessionUsageData[]> {
    return [];
  },
});

export default windsurfAgentPlugin;
