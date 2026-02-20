export const PRICING_DATA = {
  "openai": {
    "o3-2025-12-15": { "input": 2.00, "output": 8.00 },
    "gpt-5.2-preview": { "input": 1.75, "output": 14.00 },
    "o4-mini": { "input": 0.15, "output": 0.60 },
    "gpt-4o": { "input": 2.50, "output": 10.00, "deprecated": true },
    "gpt-4o-mini": { "input": 0.15, "output": 0.60, "deprecated": true }
  },
  "anthropic": {
    "claude-4-6-opus": { "input": 5.00, "output": 25.00 },
    "claude-4-6-sonnet": { "input": 3.00, "output": 15.00 },
    "claude-4-5-haiku": { "input": 1.00, "output": 5.00 },
    "claude-3-5-sonnet-latest": { "input": 3.00, "output": 15.00, "deprecated": true }
  },
  "google": {
    "gemini-3-pro-001": { "input": 2.00, "output": 12.00 },
    "gemini-3-flash": { "input": 0.50, "output": 3.00 },
    "gemini-3-flash-preview": { "input": 0.50, "output": 3.00 },
    "gemini-2.5-flash-lite": { "input": 0.10, "output": 0.40 },
    "gemini-1.5-pro": { "input": 1.25, "output": 3.75, "deprecated": true },
    "gemini-1.5-flash": { "input": 0.075, "output": 0.30, "deprecated": true }
  },
  "deepseek": {
    "deepseek-reasoner": { "input": 0.55, "output": 2.19 },
    "deepseek-chat": { "input": 0.27, "output": 1.10 }
  },
  "mistral": {
    "mistral-large-2601": { "input": 2.00, "output": 6.00 },
    "magistral-beta": { "input": 4.00, "output": 12.00 },
    "ministral-3-14b": { "input": 0.10, "output": 0.10 }
  },
  "meta": {
    "llama-4-405b": { "input": 5.00, "output": 15.00 },
    "llama-4-maverick-17b": { "input": 0.20, "output": 0.50 }
  },
  "amazon": {
    "amazon.nova-premier-v1": { "input": 2.50, "output": 12.50 },
    "amazon.nova-micro-v1": { "input": 0.05, "output": 0.20 }
  },
  "alibaba": {
    "qwen-3.5-omni": { "input": 0.70, "output": 8.40 },
    "qwen3-coder-32b": { "input": 0.50, "output": 2.00 }
  },
  "xai": {
    "grok-4": { "input": 3.00, "output": 15.00 },
    "grok-4-fast": { "input": 0.20, "output": 0.50 }
  },
  "cohere": {
    "command-r7-plus": { "input": 3.00, "output": 15.00 }
  }
};

export class CostCalculator {
  calculateCost(provider, model, inputTokens, outputTokens) {
    const providerPricing = PRICING_DATA[provider.toLowerCase()];
    if (!providerPricing) return [0, 0];

    const modelPricing = providerPricing[model.toLowerCase()];
    if (!modelPricing) return [0, 0];

    // Rates are per 1M tokens
    const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
    const outputCost = (outputTokens / 1_000_000) * modelPricing.output;

    return [inputCost, outputCost];
  }

  getBestAlternative(provider, model, inputTokens, outputTokens, preferredProviders = []) {
    const alternatives = this.getAllAlternatives(provider, model, inputTokens, outputTokens, preferredProviders);
    if (alternatives.length === 0) return null;
    return alternatives[0];
  }

  getAllAlternatives(provider, model, inputTokens, outputTokens, preferredProviders = []) {
    let alternatives = [];
    let currentCost = this.calculateCost(provider, model, inputTokens, outputTokens).reduce((a, b) => a + b, 0);

    const targets = preferredProviders.length > 0 ? preferredProviders : Object.keys(PRICING_DATA);

    for (const targetProvider of targets) {
      const models = PRICING_DATA[targetProvider];
      if (!models) continue;

      for (const targetModel in models) {
        const pricing = models[targetModel];
        if ((targetProvider === provider.toLowerCase() && targetModel === model.toLowerCase()) || pricing.deprecated) continue;

        const [altInput, altOutput] = this.calculateCost(targetProvider, targetModel, inputTokens, outputTokens);
        const altTotal = altInput + altOutput;

        alternatives.push({
          model: targetModel,
          provider: targetProvider,
          cost: altTotal,
          savingsPct: currentCost > 0 ? ((currentCost - altTotal) / currentCost) * 100 : 0
        });
      }
    }

    // Sort by cost ascending
    return alternatives.sort((a, b) => a.cost - b.cost);
  }
}

let calculator;
export function getCostCalculator() {
  if (!calculator) {
    calculator = new CostCalculator();
  }
  return calculator;
}
