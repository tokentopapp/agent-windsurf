import * as fs from 'fs/promises';
import * as path from 'path';
import type { ModelMapping } from './types.ts';

interface ModelDefinition {
  key: string;
  alias: string;
  providerId: string;
  modelId: string;
}

function buildModelMap(definitions: ModelDefinition[]): Record<string, ModelMapping> {
  const modelMap: Record<string, ModelMapping> = {};

  for (const definition of definitions) {
    const mapping: ModelMapping = {
      providerId: definition.providerId,
      modelId: definition.modelId,
    };

    modelMap[definition.key] = mapping;
    modelMap[definition.key.toUpperCase()] = mapping;
    modelMap[definition.key.toLowerCase()] = mapping;
    modelMap[definition.alias] = mapping;
    modelMap[definition.alias.toUpperCase()] = mapping;
    modelMap[definition.alias.toLowerCase()] = mapping;
  }

  return modelMap;
}

const MODEL_DEFINITIONS: ModelDefinition[] = [
  { key: 'CLAUDE_3_OPUS', alias: 'claude-3-opus', providerId: 'anthropic', modelId: 'claude-3-opus' },
  { key: 'CLAUDE_3_SONNET', alias: 'claude-3-sonnet', providerId: 'anthropic', modelId: 'claude-3-sonnet' },
  { key: 'CLAUDE_3_HAIKU', alias: 'claude-3-haiku', providerId: 'anthropic', modelId: 'claude-3-haiku' },
  { key: 'CLAUDE_3_5_SONNET', alias: 'claude-3.5-sonnet', providerId: 'anthropic', modelId: 'claude-3.5-sonnet' },
  { key: 'CLAUDE_3_5_SONNET_20241022', alias: 'claude-3.5-sonnet-20241022', providerId: 'anthropic', modelId: 'claude-3.5-sonnet-20241022' },
  { key: 'CLAUDE_3_5_HAIKU', alias: 'claude-3.5-haiku', providerId: 'anthropic', modelId: 'claude-3.5-haiku' },
  { key: 'CLAUDE_3_7_SONNET', alias: 'claude-3.7-sonnet', providerId: 'anthropic', modelId: 'claude-3.7-sonnet' },
  { key: 'CLAUDE_3_7_SONNET_20250219', alias: 'claude-3.7-sonnet-20250219', providerId: 'anthropic', modelId: 'claude-3.7-sonnet-20250219' },
  { key: 'CLAUDE_3_7_SONNET_THINKING', alias: 'claude-3.7-sonnet-thinking', providerId: 'anthropic', modelId: 'claude-3.7-sonnet-thinking' },
  { key: 'CLAUDE_3_7_SONNET_20250219_THINKING', alias: 'claude-3.7-sonnet-20250219-thinking', providerId: 'anthropic', modelId: 'claude-3.7-sonnet-20250219-thinking' },
  { key: 'CLAUDE_4_OPUS', alias: 'claude-4-opus', providerId: 'anthropic', modelId: 'claude-4-opus' },
  { key: 'CLAUDE_4_OPUS_THINKING', alias: 'claude-4-opus-thinking', providerId: 'anthropic', modelId: 'claude-4-opus-thinking' },
  { key: 'CLAUDE_4_SONNET', alias: 'claude-4-sonnet', providerId: 'anthropic', modelId: 'claude-4-sonnet' },
  { key: 'CLAUDE_4_SONNET_THINKING', alias: 'claude-4-sonnet-thinking', providerId: 'anthropic', modelId: 'claude-4-sonnet-thinking' },
  { key: 'CLAUDE_4_1_OPUS', alias: 'claude-4.1-opus', providerId: 'anthropic', modelId: 'claude-4.1-opus' },
  { key: 'CLAUDE_4_1_OPUS_THINKING', alias: 'claude-4.1-opus-thinking', providerId: 'anthropic', modelId: 'claude-4.1-opus-thinking' },
  { key: 'CLAUDE_4_5_SONNET', alias: 'claude-4.5-sonnet', providerId: 'anthropic', modelId: 'claude-4.5-sonnet' },
  { key: 'CLAUDE_4_5_SONNET_THINKING', alias: 'claude-4.5-sonnet-thinking', providerId: 'anthropic', modelId: 'claude-4.5-sonnet-thinking' },
  { key: 'CLAUDE_4_5_OPUS', alias: 'claude-4.5-opus', providerId: 'anthropic', modelId: 'claude-4.5-opus' },
  { key: 'CLAUDE_4_5_OPUS_THINKING', alias: 'claude-4.5-opus-thinking', providerId: 'anthropic', modelId: 'claude-4.5-opus-thinking' },

  { key: 'GPT_4', alias: 'gpt-4', providerId: 'openai', modelId: 'gpt-4' },
  { key: 'GPT_4_TURBO', alias: 'gpt-4-turbo', providerId: 'openai', modelId: 'gpt-4-turbo' },
  { key: 'GPT_4O', alias: 'gpt-4o', providerId: 'openai', modelId: 'gpt-4o' },
  { key: 'GPT_4O_2024_08_06', alias: 'gpt-4o-2024-08-06', providerId: 'openai', modelId: 'gpt-4o-2024-08-06' },
  { key: 'GPT_4O_MINI', alias: 'gpt-4o-mini', providerId: 'openai', modelId: 'gpt-4o-mini' },
  { key: 'GPT_4_1', alias: 'gpt-4.1', providerId: 'openai', modelId: 'gpt-4.1' },
  { key: 'GPT_4_1_MINI', alias: 'gpt-4.1-mini', providerId: 'openai', modelId: 'gpt-4.1-mini' },
  { key: 'GPT_4_1_NANO', alias: 'gpt-4.1-nano', providerId: 'openai', modelId: 'gpt-4.1-nano' },
  { key: 'GPT_4_5', alias: 'gpt-4.5', providerId: 'openai', modelId: 'gpt-4.5' },
  { key: 'GPT_5', alias: 'gpt-5', providerId: 'openai', modelId: 'gpt-5' },
  { key: 'GPT_5_NANO', alias: 'gpt-5-nano', providerId: 'openai', modelId: 'gpt-5-nano' },
  { key: 'GPT_5_CODEX', alias: 'gpt-5-codex', providerId: 'openai', modelId: 'gpt-5-codex' },
  { key: 'GPT_5_1_CODEX', alias: 'gpt-5.1-codex', providerId: 'openai', modelId: 'gpt-5.1-codex' },
  { key: 'GPT_5_1_CODEX_MINI', alias: 'gpt-5.1-codex-mini', providerId: 'openai', modelId: 'gpt-5.1-codex-mini' },
  { key: 'GPT_5_1_CODEX_MAX', alias: 'gpt-5.1-codex-max', providerId: 'openai', modelId: 'gpt-5.1-codex-max' },
  { key: 'GPT_5_2', alias: 'gpt-5.2', providerId: 'openai', modelId: 'gpt-5.2' },

  { key: 'O1', alias: 'o1', providerId: 'openai', modelId: 'o1' },
  { key: 'O1_MINI', alias: 'o1-mini', providerId: 'openai', modelId: 'o1-mini' },
  { key: 'O3', alias: 'o3', providerId: 'openai', modelId: 'o3' },
  { key: 'O3_MINI', alias: 'o3-mini', providerId: 'openai', modelId: 'o3-mini' },
  { key: 'O3_PRO', alias: 'o3-pro', providerId: 'openai', modelId: 'o3-pro' },
  { key: 'O4_MINI', alias: 'o4-mini', providerId: 'openai', modelId: 'o4-mini' },

  { key: 'GEMINI_2_0_FLASH', alias: 'gemini-2.0-flash', providerId: 'google', modelId: 'gemini-2.0-flash' },
  { key: 'GEMINI_2_5_FLASH', alias: 'gemini-2.5-flash', providerId: 'google', modelId: 'gemini-2.5-flash' },
  { key: 'GEMINI_2_5_FLASH_THINKING', alias: 'gemini-2.5-flash-thinking', providerId: 'google', modelId: 'gemini-2.5-flash-thinking' },
  { key: 'GEMINI_2_5_FLASH_LITE', alias: 'gemini-2.5-flash-lite', providerId: 'google', modelId: 'gemini-2.5-flash-lite' },
  { key: 'GEMINI_2_5_PRO', alias: 'gemini-2.5-pro', providerId: 'google', modelId: 'gemini-2.5-pro' },
  { key: 'GEMINI_3_0_FLASH', alias: 'gemini-3.0-flash', providerId: 'google', modelId: 'gemini-3.0-flash' },
  { key: 'GEMINI_3_0_FLASH_HIGH', alias: 'gemini-3.0-flash-high', providerId: 'google', modelId: 'gemini-3.0-flash-high' },
  { key: 'GEMINI_3_0_PRO', alias: 'gemini-3.0-pro', providerId: 'google', modelId: 'gemini-3.0-pro' },
  { key: 'GEMINI_3_0_PRO_HIGH', alias: 'gemini-3.0-pro-high', providerId: 'google', modelId: 'gemini-3.0-pro-high' },

  { key: 'DEEPSEEK_V3', alias: 'deepseek-v3', providerId: 'deepseek', modelId: 'deepseek-v3' },
  { key: 'DEEPSEEK_V3_2', alias: 'deepseek-v3.2', providerId: 'deepseek', modelId: 'deepseek-v3.2' },
  { key: 'DEEPSEEK_R1', alias: 'deepseek-r1', providerId: 'deepseek', modelId: 'deepseek-r1' },
  { key: 'DEEPSEEK_R1_FAST', alias: 'deepseek-r1-fast', providerId: 'deepseek', modelId: 'deepseek-r1-fast' },
  { key: 'DEEPSEEK_R1_SLOW', alias: 'deepseek-r1-slow', providerId: 'deepseek', modelId: 'deepseek-r1-slow' },

  { key: 'LLAMA_3_1_8B', alias: 'llama-3.1-8b', providerId: 'meta', modelId: 'llama-3.1-8b' },
  { key: 'LLAMA_3_1_70B', alias: 'llama-3.1-70b', providerId: 'meta', modelId: 'llama-3.1-70b' },
  { key: 'LLAMA_3_1_405B', alias: 'llama-3.1-405b', providerId: 'meta', modelId: 'llama-3.1-405b' },
  { key: 'LLAMA_3_3_70B', alias: 'llama-3.3-70b', providerId: 'meta', modelId: 'llama-3.3-70b' },
  { key: 'LLAMA_3_3_70B_R1', alias: 'llama-3.3-70b-r1', providerId: 'meta', modelId: 'llama-3.3-70b-r1' },

  { key: 'QWEN_2_5_7B', alias: 'qwen-2.5-7b', providerId: 'alibaba', modelId: 'qwen-2.5-7b' },
  { key: 'QWEN_2_5_32B', alias: 'qwen-2.5-32b', providerId: 'alibaba', modelId: 'qwen-2.5-32b' },
  { key: 'QWEN_2_5_72B', alias: 'qwen-2.5-72b', providerId: 'alibaba', modelId: 'qwen-2.5-72b' },
  { key: 'QWEN_2_5_32B_R1', alias: 'qwen-2.5-32b-r1', providerId: 'alibaba', modelId: 'qwen-2.5-32b-r1' },
  { key: 'QWEN_3_235B', alias: 'qwen-3-235b', providerId: 'alibaba', modelId: 'qwen-3-235b' },
  { key: 'QWEN_3_CODER_480B', alias: 'qwen-3-coder-480b', providerId: 'alibaba', modelId: 'qwen-3-coder-480b' },
  { key: 'QWEN_3_CODER_480B_FAST', alias: 'qwen-3-coder-480b-fast', providerId: 'alibaba', modelId: 'qwen-3-coder-480b-fast' },

  { key: 'GROK_2', alias: 'grok-2', providerId: 'xai', modelId: 'grok-2' },
  { key: 'GROK_3', alias: 'grok-3', providerId: 'xai', modelId: 'grok-3' },
  { key: 'GROK_3_MINI', alias: 'grok-3-mini', providerId: 'xai', modelId: 'grok-3-mini' },
  { key: 'GROK_CODE_FAST', alias: 'grok-code-fast', providerId: 'xai', modelId: 'grok-code-fast' },

  { key: 'SWE_1', alias: 'swe-1', providerId: 'codeium', modelId: 'swe-1' },
  { key: 'SWE_1_5', alias: 'swe-1.5', providerId: 'codeium', modelId: 'swe-1.5' },
  { key: 'cognition-swe-1.5', alias: 'cognition-swe-1.5', providerId: 'codeium', modelId: 'cognition-swe-1.5' },
  { key: 'swe-1-model-id', alias: 'swe-1-model-id', providerId: 'codeium', modelId: 'swe-1-model-id' },
  { key: 'swe-1-lite-model-id', alias: 'swe-1-lite-model-id', providerId: 'codeium', modelId: 'swe-1-lite-model-id' },
  { key: 'vista-model-id', alias: 'vista-model-id', providerId: 'codeium', modelId: 'vista-model-id' },
  { key: 'shamu-model-id', alias: 'shamu-model-id', providerId: 'codeium', modelId: 'shamu-model-id' },
  { key: 'VISTA', alias: 'vista', providerId: 'codeium', modelId: 'vista' },
  { key: 'SHAMU', alias: 'shamu', providerId: 'codeium', modelId: 'shamu' },

  { key: 'MISTRAL_7B', alias: 'mistral-7b', providerId: 'mistral', modelId: 'mistral-7b' },
  { key: 'KIMI_K2', alias: 'kimi-k2', providerId: 'moonshot', modelId: 'kimi-k2' },
  { key: 'KIMI_K2_THINKING', alias: 'kimi-k2-thinking', providerId: 'moonshot', modelId: 'kimi-k2-thinking' },
  { key: 'GLM_4_5', alias: 'glm-4.5', providerId: 'zhipu', modelId: 'glm-4.5' },
  { key: 'GLM_4_5_FAST', alias: 'glm-4.5-fast', providerId: 'zhipu', modelId: 'glm-4.5-fast' },
  { key: 'GLM_4_6', alias: 'glm-4.6', providerId: 'zhipu', modelId: 'glm-4.6' },
  { key: 'GLM_4_6_FAST', alias: 'glm-4.6-fast', providerId: 'zhipu', modelId: 'glm-4.6-fast' },
  { key: 'GLM_4_7', alias: 'glm-4.7', providerId: 'zhipu', modelId: 'glm-4.7' },
  { key: 'GLM_4_7_FAST', alias: 'glm-4.7-fast', providerId: 'zhipu', modelId: 'glm-4.7-fast' },
  { key: 'MINIMAX_M2', alias: 'minimax-m2', providerId: 'minimax', modelId: 'minimax-m2' },
  { key: 'MINIMAX_M2_1', alias: 'minimax-m2.1', providerId: 'minimax', modelId: 'minimax-m2.1' },
];

export const MODEL_MAP: Record<string, ModelMapping> = buildModelMap(MODEL_DEFINITIONS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export async function readJsonFilesInDir(dirPath: string): Promise<Array<{ filePath: string; data: unknown }>> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const results: Array<{ filePath: string; data: unknown }> = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }
      const filePath = path.join(dirPath, entry.name);
      const data = await readJsonFile<unknown>(filePath);
      if (data !== null) {
        results.push({ filePath, data });
      }
    }
    return results;
  } catch {
    return [];
  }
}

export function estimateTokenCount(text: string): number {
  if (text.length === 0) {
    return 0;
  }
  return Math.ceil(text.length / 4);
}

export function extractTextContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((item) => {
      if (typeof item === 'string') {
        return item;
      }
      if (!isRecord(item)) {
        return '';
      }
      if (typeof item.text === 'string') {
        return item.text;
      }
      if (typeof item.content === 'string') {
        return item.content;
      }
      return '';
    })
    .join('');
}

export function resolveModel(rawModelId: string): ModelMapping {
  const normalized = rawModelId.trim();
  const direct = MODEL_MAP[normalized] ?? MODEL_MAP[normalized.toUpperCase()] ?? MODEL_MAP[normalized.toLowerCase()];
  if (direct) {
    return direct;
  }

  const lower = normalized.toLowerCase();
  if (lower.includes('claude')) {
    return { providerId: 'anthropic', modelId: lower };
  }
  if (lower.includes('gpt') || lower.startsWith('o1') || lower.startsWith('o3') || lower.startsWith('o4')) {
    return { providerId: 'openai', modelId: lower };
  }
  if (lower.includes('gemini')) {
    return { providerId: 'google', modelId: lower };
  }
  if (lower.includes('deepseek')) {
    return { providerId: 'deepseek', modelId: lower };
  }
  if (lower.includes('llama')) {
    return { providerId: 'meta', modelId: lower };
  }
  if (lower.includes('qwen')) {
    return { providerId: 'alibaba', modelId: lower };
  }
  if (lower.includes('grok')) {
    return { providerId: 'xai', modelId: lower };
  }
  if (lower.includes('swe') || lower.includes('vista') || lower.includes('shamu') || lower.includes('cognition')) {
    return { providerId: 'codeium', modelId: lower };
  }
  if (lower.includes('mistral')) {
    return { providerId: 'mistral', modelId: lower };
  }
  if (lower.includes('kimi')) {
    return { providerId: 'moonshot', modelId: lower };
  }
  if (lower.includes('glm')) {
    return { providerId: 'zhipu', modelId: lower };
  }
  if (lower.includes('minimax')) {
    return { providerId: 'minimax', modelId: lower };
  }

  return { providerId: 'unknown', modelId: lower };
}
