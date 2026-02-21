import * as fs from 'fs/promises';
import * as path from 'path';
import type { AgentFetchContext, SessionParseOptions, SessionUsageData } from '@tokentop/plugin-sdk';
import { CACHE_TTL_MS, evictSessionAggregateCache, sessionAggregateCache, sessionCache, sessionMetadataIndex } from './cache.ts';
import { WINDSURF_CASCADE_PATH, getCascadeDirs } from './paths.ts';
import type { WindsurfMessageEntry } from './types.ts';
import { estimateTokenCount, extractTextContent, readJsonFile, resolveModel } from './utils.ts';
import {
  consumeForceFullReconciliation,
  isAssistantMessage,
  sessionWatcher,
  startSessionWatcher,
  watchSubDir,
} from './watcher.ts';

interface ParsedSessionFile {
  sessionId: string;
  filePath: string;
  mtimeMs: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMessageLike(entry: unknown): entry is WindsurfMessageEntry {
  if (!isRecord(entry)) return false;
  return typeof entry.role === 'string';
}

function toTimestamp(value: string | number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value === 'number') return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function extractSessionId(filePath: string, data: unknown): string {
  if (isRecord(data)) {
    if (typeof data.id === 'string' && data.id.length > 0) {
      return data.id;
    }
    if (typeof data.conversationId === 'string' && data.conversationId.length > 0) {
      return data.conversationId;
    }
  }
  return path.basename(filePath, '.json');
}

function extractMessages(data: unknown): WindsurfMessageEntry[] {
  if (Array.isArray(data)) {
    if (data.length === 0) return [];
    if (data.every((item) => isMessageLike(item))) {
      return data;
    }
    const nested: WindsurfMessageEntry[] = [];
    for (const item of data) {
      nested.push(...extractMessages(item));
    }
    return nested;
  }

  if (!isRecord(data)) return [];

  if (Array.isArray(data.messages)) {
    return data.messages.filter((msg): msg is WindsurfMessageEntry => isMessageLike(msg));
  }

  if (Array.isArray(data.entries)) {
    return data.entries.filter((msg): msg is WindsurfMessageEntry => isMessageLike(msg));
  }

  if (isMessageLike(data)) {
    return [data];
  }

  return [];
}

export function parseConversationFile(
  filePath: string,
  data: unknown,
  mtimeMs: number,
): SessionUsageData[] {
  const sessionId = extractSessionId(filePath, data);
  const messages = extractMessages(data);

  const sessionName = isRecord(data) && typeof data.title === 'string' && data.title.length > 0
    ? data.title
    : undefined;

  const projectPath = isRecord(data)
    ? (typeof data.workspacePath === 'string' && data.workspacePath.length > 0
      ? data.workspacePath
      : typeof data.projectPath === 'string' && data.projectPath.length > 0
        ? data.projectPath
        : undefined)
    : undefined;

  const deduped = new Map<string, SessionUsageData>();
  let lastUserText = '';

  for (let i = 0; i < messages.length; i += 1) {
    const msg = messages[i];
    const messageText = extractTextContent(msg.content) || (typeof msg.text === 'string' ? msg.text : '');

    if (msg.role === 'user') {
      lastUserText = messageText;
      continue;
    }

    if (!isAssistantMessage(msg)) {
      continue;
    }

    const rawModelId = typeof msg.model === 'string' && msg.model.length > 0
      ? msg.model
      : typeof msg.modelId === 'string'
        ? msg.modelId
        : '';
    if (!rawModelId) continue;

    const resolved = resolveModel(rawModelId);
    const inputTokens = estimateTokenCount(lastUserText);
    const outputTokens = estimateTokenCount(messageText);
    const timestamp = toTimestamp(msg.timestamp, mtimeMs);

    const messageId = typeof msg.id === 'string' && msg.id.length > 0
      ? msg.id
      : `${sessionId}-${timestamp}-${i}`;

    const usage: SessionUsageData = {
      sessionId,
      providerId: resolved.providerId,
      modelId: resolved.modelId,
      tokens: {
        input: inputTokens,
        output: outputTokens,
      },
      timestamp,
      sessionUpdatedAt: mtimeMs,
    };

    if (sessionName) {
      usage.sessionName = sessionName;
    }
    if (projectPath) {
      usage.projectPath = projectPath;
    }

    deduped.set(messageId, usage);
    lastUserText = '';
  }

  return Array.from(deduped.values());
}

export async function parseSessionsFromProjects(
  options: SessionParseOptions,
  ctx: AgentFetchContext,
): Promise<SessionUsageData[]> {
  const limit = options.limit ?? 100;
  const since = options.since;

  try {
    await fs.access(WINDSURF_CASCADE_PATH);
  } catch {
    ctx.logger.debug('No Windsurf cascade directory found');
    return [];
  }

  startSessionWatcher();

  const now = Date.now();
  if (
    !options.sessionId &&
    limit === sessionCache.lastLimit &&
    now - sessionCache.lastCheck < CACHE_TTL_MS &&
    sessionCache.lastResult.length > 0 &&
    sessionCache.lastSince === since
  ) {
    ctx.logger.debug('Windsurf: using cached sessions (within TTL)', { count: sessionCache.lastResult.length });
    return sessionCache.lastResult;
  }

  const dirtyPaths = new Set(sessionWatcher.dirtyPaths);
  sessionWatcher.dirtyPaths.clear();

  const needsFullStat = consumeForceFullReconciliation();
  if (needsFullStat) {
    ctx.logger.debug('Windsurf: full reconciliation sweep triggered');
  }

  const sessionFiles: ParsedSessionFile[] = [];
  const seenFilePaths = new Set<string>();

  let statCount = 0;
  let statSkipCount = 0;
  let dirtyHitCount = 0;

  const dirsToScan: string[] = [WINDSURF_CASCADE_PATH];
  const subDirs = await getCascadeDirs();
  dirsToScan.push(...subDirs);

  for (const dirPath of dirsToScan) {
    if (dirPath !== WINDSURF_CASCADE_PATH) {
      watchSubDir(dirPath);
    }

    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;

      const filePath = path.join(dirPath, entry.name);
      seenFilePaths.add(filePath);

      const isDirty = dirtyPaths.has(filePath);
      if (isDirty) dirtyHitCount++;

      const metadata = sessionMetadataIndex.get(filePath);

      if (options.sessionId && metadata && metadata.sessionId !== options.sessionId) continue;

      if (!isDirty && !needsFullStat && metadata) {
        statSkipCount++;

        if (!since || metadata.mtimeMs >= since) {
          sessionFiles.push({
            sessionId: metadata.sessionId,
            filePath,
            mtimeMs: metadata.mtimeMs,
          });
        }
        continue;
      }

      statCount++;
      let mtimeMs: number;
      try {
        const stat = await fs.stat(filePath);
        mtimeMs = stat.mtimeMs;
      } catch {
        sessionMetadataIndex.delete(filePath);
        continue;
      }

      if (metadata && metadata.mtimeMs === mtimeMs) {
        if (options.sessionId && metadata.sessionId !== options.sessionId) continue;

        if (!since || metadata.mtimeMs >= since) {
          sessionFiles.push({
            sessionId: metadata.sessionId,
            filePath,
            mtimeMs: metadata.mtimeMs,
          });
        }
        continue;
      }

      const data = await readJsonFile<unknown>(filePath);
      if (data === null) {
        sessionMetadataIndex.delete(filePath);
        continue;
      }

      const sessionId = extractSessionId(filePath, data);
      sessionMetadataIndex.set(filePath, { mtimeMs, sessionId });

      if (options.sessionId && sessionId !== options.sessionId) continue;

      if (!since || mtimeMs >= since) {
        sessionFiles.push({ sessionId, filePath, mtimeMs });
      }
    }
  }

  for (const cachedPath of sessionMetadataIndex.keys()) {
    if (!seenFilePaths.has(cachedPath)) {
      sessionMetadataIndex.delete(cachedPath);
    }
  }

  sessionFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);

  const sessions: SessionUsageData[] = [];
  let aggregateCacheHits = 0;
  let aggregateCacheMisses = 0;

  for (const file of sessionFiles) {
    const cached = sessionAggregateCache.get(file.sessionId);
    if (cached && cached.updatedAt === file.mtimeMs) {
      cached.lastAccessed = now;
      aggregateCacheHits++;
      sessions.push(...cached.usageRows);
      continue;
    }

    aggregateCacheMisses++;

    const data = await readJsonFile<unknown>(file.filePath);
    if (data === null) continue;

    const usageRows = parseConversationFile(file.filePath, data, file.mtimeMs);

    sessionAggregateCache.set(file.sessionId, {
      updatedAt: file.mtimeMs,
      usageRows,
      lastAccessed: now,
    });

    sessions.push(...usageRows);
  }

  evictSessionAggregateCache();

  if (!options.sessionId) {
    sessionCache.lastCheck = Date.now();
    sessionCache.lastResult = sessions;
    sessionCache.lastLimit = limit;
    sessionCache.lastSince = since;
  }

  ctx.logger.debug('Windsurf: parsed sessions', {
    count: sessions.length,
    sessionFiles: sessionFiles.length,
    statChecks: statCount,
    statSkips: statSkipCount,
    dirtyHits: dirtyHitCount,
    aggregateCacheHits,
    aggregateCacheMisses,
    metadataIndexSize: sessionMetadataIndex.size,
    aggregateCacheSize: sessionAggregateCache.size,
  });

  return sessions;
}
