import type { CopilotSource } from './schema';

export type ModelBudget = {
  inputCap: number;
  outputReserve: number;
};

export const MID_MODEL_BUDGET: ModelBudget = {
  inputCap: 8000,
  outputReserve: 1200,
};

export const STRONG_MODEL_BUDGET: ModelBudget = {
  inputCap: 16000,
  outputReserve: 2500,
};

export function getBudgetForModel(model: string, midModel: string): ModelBudget {
  return model === midModel ? MID_MODEL_BUDGET : STRONG_MODEL_BUDGET;
}

export function approximateTokens(input: string): number {
  const text = input.trim();
  if (!text) return 0;
  return Math.ceil(text.split(/\s+/).length * 1.35);
}

export function fitSourcesIntoBudget(params: {
  sources: CopilotSource[];
  modelBudget: ModelBudget;
  promptOverheadTokens: number;
}): CopilotSource[] {
  const available = Math.max(1000, params.modelBudget.inputCap - params.modelBudget.outputReserve - params.promptOverheadTokens);

  const poolTargets = {
    case: Math.floor(available * 0.7),
    kb: Math.floor(available * 0.2),
    brief: Math.max(200, Math.floor(available * 0.1)),
  };

  const sorted = [...params.sources].sort((a, b) => b.similarity - a.similarity);
  const byPool: Record<CopilotSource['pool'], CopilotSource[]> = {
    case: [],
    kb: [],
    brief: [],
  };

  for (const source of sorted) {
    byPool[source.pool].push(source);
  }

  const selected = [
    ...selectPool(byPool.case, poolTargets.case),
    ...selectPool(byPool.kb, poolTargets.kb),
    ...selectPool(byPool.brief, poolTargets.brief),
  ];

  return selected.sort((a, b) => b.similarity - a.similarity);
}

function selectPool(pool: CopilotSource[], tokenTarget: number): CopilotSource[] {
  const picked: CopilotSource[] = [];
  let used = 0;

  for (const source of pool) {
    if (picked.length >= 20) break;
    const tokens = approximateTokens(source.content);
    if (tokens > tokenTarget && picked.length > 0) {
      continue;
    }
    if (used + tokens > tokenTarget && picked.length > 0) {
      continue;
    }

    picked.push({
      ...source,
      content: truncateByTokenEstimate(source.content, Math.min(tokens, 900)),
    });
    used += Math.min(tokens, 900);
  }

  return picked;
}

export function truncateByTokenEstimate(text: string, maxTokens: number): string {
  const words = text.split(/\s+/);
  const maxWords = Math.floor(maxTokens / 1.35);
  if (words.length <= maxWords) {
    return text;
  }
  return `${words.slice(0, maxWords).join(' ')} ...`;
}
