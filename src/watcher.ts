import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import type { ActivityCallback, ActivityUpdate } from '@tokentop/plugin-sdk';
import { WINDSURF_CASCADE_PATH, getCascadeDirs } from './paths.ts';
import type { WindsurfMessageEntry } from './types.ts';
import { estimateTokenCount, extractTextContent, resolveModel } from './utils.ts';

export interface SessionWatcherState {
  cascadeWatcher: fsSync.FSWatcher | null;
  subDirWatchers: Map<string, fsSync.FSWatcher>;
  dirtyPaths: Set<string>;
  reconciliationTimer: ReturnType<typeof setInterval> | null;
  started: boolean;
}

interface ActivityWatcherState {
  cascadeWatcher: fsSync.FSWatcher | null;
  subDirWatchers: Map<string, fsSync.FSWatcher>;
  callback: ActivityCallback | null;
  fileOffsets: Map<string, number>;
  started: boolean;
}

export const RECONCILIATION_INTERVAL_MS = 10 * 60 * 1000;

export const sessionWatcher: SessionWatcherState = {
  cascadeWatcher: null,
  subDirWatchers: new Map(),
  dirtyPaths: new Set(),
  reconciliationTimer: null,
  started: false,
};

const activityWatcher: ActivityWatcherState = {
  cascadeWatcher: null,
  subDirWatchers: new Map(),
  callback: null,
  fileOffsets: new Map(),
  started: false,
};

export let forceFullReconciliation = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Type guard for assistant-like messages that have model info
export function isAssistantMessage(entry: unknown): entry is WindsurfMessageEntry {
  if (!isRecord(entry)) return false;

  if (entry.role !== 'assistant') return false;

  const content = entry.content;
  const hasContent = typeof content === 'string' || Array.isArray(content) || typeof entry.text === 'string';
  if (!hasContent) return false;

  const hasModel =
    (typeof entry.model === 'string' && entry.model.length > 0)
    || (typeof entry.modelId === 'string' && entry.modelId.length > 0);
  if (!hasModel) return false;

  return true;
}

function isMessageLike(entry: unknown): entry is WindsurfMessageEntry {
  if (!isRecord(entry)) return false;
  return typeof entry.role === 'string';
}

function toTimestamp(value: string | number | undefined): number {
  if (value === undefined) return Date.now();
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function markDirtyJsonFile(filePath: string): void {
  if (!filePath.endsWith('.json')) return;
  sessionWatcher.dirtyPaths.add(filePath);
}

function parseChunkAsJsonValues(chunk: string): unknown[] {
  const trimmed = chunk.trim();
  if (!trimmed) return [];

  try {
    return [JSON.parse(trimmed) as unknown];
  } catch {
  }

  const values: unknown[] = [];
  for (const line of chunk.split(/\r?\n/)) {
    const lineTrimmed = line.trim();
    if (!lineTrimmed) continue;
    try {
      values.push(JSON.parse(lineTrimmed) as unknown);
    } catch {
    }
  }
  return values;
}

function extractConversationMessages(value: unknown): WindsurfMessageEntry[] {
  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    const allMessages = value.every((item) => isMessageLike(item));
    if (allMessages) {
      return value;
    }

    const nested: WindsurfMessageEntry[] = [];
    for (const item of value) {
      nested.push(...extractConversationMessages(item));
    }
    return nested;
  }

  if (!isRecord(value)) return [];

  const messages = value.messages;
  if (Array.isArray(messages)) {
    return messages.filter((message): message is WindsurfMessageEntry => isMessageLike(message));
  }

  const entries = value.entries;
  if (Array.isArray(entries)) {
    return entries.filter((message): message is WindsurfMessageEntry => isMessageLike(message));
  }

  if (isMessageLike(value)) {
    return [value];
  }

  return [];
}

function extractSessionIdFromValue(filePath: string, value: unknown): string {
  if (isRecord(value)) {
    if (typeof value.id === 'string' && value.id.length > 0) {
      return value.id;
    }
    if (typeof value.conversationId === 'string' && value.conversationId.length > 0) {
      return value.conversationId;
    }
  }
  return path.basename(filePath, '.json');
}

export function watchCascadeDir(): void {
  if (sessionWatcher.cascadeWatcher) return;

  try {
    sessionWatcher.cascadeWatcher = fsSync.watch(WINDSURF_CASCADE_PATH, (eventType, filename) => {
      if (!filename) return;

      const targetPath = path.join(WINDSURF_CASCADE_PATH, filename);
      if (filename.endsWith('.json')) {
        markDirtyJsonFile(targetPath);
        return;
      }

      if (eventType === 'rename') {
        watchSubDir(targetPath);
      }
    });
  } catch {
  }
}

export function watchSubDir(dirPath: string): void {
  if (sessionWatcher.subDirWatchers.has(dirPath)) return;

  try {
    const watcher = fsSync.watch(dirPath, (_eventType, filename) => {
      if (!filename || !filename.endsWith('.json')) return;
      markDirtyJsonFile(path.join(dirPath, filename));
    });
    sessionWatcher.subDirWatchers.set(dirPath, watcher);
  } catch {
  }
}

export function startSessionWatcher(): void {
  if (sessionWatcher.started) return;
  sessionWatcher.started = true;

  watchCascadeDir();

  void getCascadeDirs().then((dirs) => {
    for (const dirPath of dirs) {
      watchSubDir(dirPath);
    }
  });

  sessionWatcher.reconciliationTimer = setInterval(() => {
    forceFullReconciliation = true;
  }, RECONCILIATION_INTERVAL_MS);
}

export function stopSessionWatcher(): void {
  if (sessionWatcher.reconciliationTimer) {
    clearInterval(sessionWatcher.reconciliationTimer);
    sessionWatcher.reconciliationTimer = null;
  }

  for (const watcher of sessionWatcher.subDirWatchers.values()) {
    watcher.close();
  }
  sessionWatcher.subDirWatchers.clear();

  if (sessionWatcher.cascadeWatcher) {
    sessionWatcher.cascadeWatcher.close();
    sessionWatcher.cascadeWatcher = null;
  }

  sessionWatcher.dirtyPaths.clear();
  sessionWatcher.started = false;
}

export function consumeForceFullReconciliation(): boolean {
  const value = forceFullReconciliation;
  if (forceFullReconciliation) {
    forceFullReconciliation = false;
  }
  return value;
}

function watchCascadeDirForActivityTarget(dirPath: string, isRoot: boolean): void {
  const existing = isRoot ? activityWatcher.cascadeWatcher : activityWatcher.subDirWatchers.get(dirPath);
  if (existing) return;

  try {
    const watcher = fsSync.watch(dirPath, (eventType, filename) => {
      if (!filename) return;
      const targetPath = path.join(dirPath, filename);

      if (filename.endsWith('.json')) {
        void processJsonDelta(targetPath);
        return;
      }

      if (isRoot && eventType === 'rename') {
        watchCascadeDirForActivityTarget(targetPath, false);
        void primeFileOffsets(targetPath);
      }
    });

    if (isRoot) {
      activityWatcher.cascadeWatcher = watcher;
    } else {
      activityWatcher.subDirWatchers.set(dirPath, watcher);
    }
  } catch {
  }
}

export function watchCascadeDirForActivity(dirPath?: string): void {
  if (dirPath) {
    watchCascadeDirForActivityTarget(dirPath, false);
    return;
  }
  watchCascadeDirForActivityTarget(WINDSURF_CASCADE_PATH, true);
}

export async function primeFileOffsets(dirPath: string): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;

    const filePath = path.join(dirPath, entry.name);
    try {
      const stat = await fs.stat(filePath);
      activityWatcher.fileOffsets.set(filePath, stat.size);
    } catch {
    }
  }
}

export async function processJsonDelta(filePath: string): Promise<void> {
  const callback = activityWatcher.callback;
  if (!callback) return;

  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(filePath);
  } catch {
    activityWatcher.fileOffsets.delete(filePath);
    return;
  }

  const knownOffset = activityWatcher.fileOffsets.get(filePath) ?? 0;
  const startOffset = stat.size < knownOffset ? 0 : knownOffset;
  if (stat.size === startOffset) return;

  let chunk = '';
  try {
    const handle = await fs.open(filePath, 'r');
    const length = stat.size - startOffset;
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, startOffset);
    await handle.close();
    chunk = buffer.toString('utf-8');
  } catch {
    return;
  }

  activityWatcher.fileOffsets.set(filePath, stat.size);

  const parsedValues = parseChunkAsJsonValues(chunk);
  if (parsedValues.length === 0) return;

  for (const parsedValue of parsedValues) {
    const sessionId = extractSessionIdFromValue(filePath, parsedValue);
    const messages = extractConversationMessages(parsedValue);
    if (messages.length === 0) continue;

    let lastUserText = '';
    let assistantSequence = 0;

    for (const message of messages) {
      const messageText = extractTextContent(message.content) || (typeof message.text === 'string' ? message.text : '');

      if (message.role === 'user') {
        lastUserText = messageText;
        continue;
      }

      if (!isAssistantMessage(message)) {
        continue;
      }

      const rawModelId = typeof message.model === 'string' && message.model.length > 0
        ? message.model
        : typeof message.modelId === 'string'
          ? message.modelId
          : '';
      if (!rawModelId) continue;

      resolveModel(rawModelId);

      const output = estimateTokenCount(messageText);
      const input = estimateTokenCount(lastUserText);
      const timestamp = toTimestamp(message.timestamp);
      const messageId = typeof message.id === 'string' && message.id.length > 0
        ? message.id
        : `${sessionId}-${timestamp}-${Date.now()}-${assistantSequence}`;

      const update: ActivityUpdate = {
        sessionId,
        messageId,
        tokens: {
          input,
          output,
        },
        timestamp,
      };

      callback(update);
      assistantSequence += 1;
      lastUserText = '';
    }
  }
}

export function startActivityWatch(callback: ActivityCallback): void {
  activityWatcher.callback = callback;

  if (activityWatcher.started) return;
  activityWatcher.started = true;

  watchCascadeDirForActivity();
  void primeFileOffsets(WINDSURF_CASCADE_PATH);

  void getCascadeDirs().then((dirs) => {
    for (const dirPath of dirs) {
      watchCascadeDirForActivity(dirPath);
      void primeFileOffsets(dirPath);
    }
  });
}

export function stopActivityWatch(): void {
  for (const watcher of activityWatcher.subDirWatchers.values()) {
    watcher.close();
  }
  activityWatcher.subDirWatchers.clear();

  if (activityWatcher.cascadeWatcher) {
    activityWatcher.cascadeWatcher.close();
    activityWatcher.cascadeWatcher = null;
  }

  activityWatcher.fileOffsets.clear();
  activityWatcher.callback = null;
  activityWatcher.started = false;

  stopSessionWatcher();
}
