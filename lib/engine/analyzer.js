import { getCostCalculator, PRICING_DATA } from './pricing.js';

export function runHeuristicAnalysis(usageRecord, variables) {
  const issues = [];
  const suggestions = [];
  const variableAnalysis = [];
  let estimatedSavingsPct = 0;
  let estimatedSavingsUsd = 0;

  const totalTokens = usageRecord.total_tokens;
  if (totalTokens === 0) return null;

  // 1. Model Migration Insight (MCE - Model Cascading Efficiency)
  const calculator = getCostCalculator();
  const provider = usageRecord.provider;
  const model = usageRecord.model;
  // Use input/output tokens if available, otherwise estimate 80/20 split
  const inputTokens = usageRecord.input_tokens || Math.floor(totalTokens * 0.8);
  const outputTokens = usageRecord.output_tokens || Math.floor(totalTokens * 0.2);

  const bestAlt = calculator.getBestAlternative(provider, model, inputTokens, outputTokens);
  
  // Check if current model is deprecated
  const currentPricing = PRICING_DATA[provider.toLowerCase()]?.[model.toLowerCase()];
  if (currentPricing?.deprecated) {
    issues.push(`Model Retirement: ${model} is deprecated or retiring soon.`);
    suggestions.push(`Migrate to a current stable model (e.g., Gemini 2.0 Flash) to ensure service continuity.`);
  }

  let mceResult = {};
  if (bestAlt) {
    const currentCost = usageRecord.total_cost || 0;
    const savingsPct = currentCost > 0 ? ((currentCost - bestAlt.cost) / currentCost) * 100 : 0;
    
    if (savingsPct > 10) { // Only suggest if savings are > 10%
      mceResult = {
        mce_best_alternative_model: bestAlt.model,
        mce_best_alternative_provider: bestAlt.provider,
        mce_best_alternative_cost: bestAlt.cost,
        mce_savings_pct: savingsPct
      };
      suggestions.push(`Potential Migration: Switching to ${bestAlt.provider}/${bestAlt.model} could reduce this prompt's cost by ${savingsPct.toFixed(0)}%.`);
    }
  }

  for (const v of variables) {
    const rawPct = (v.token_count / totalTokens) * 100;
    const pct = Math.min(rawPct, 100); // Cap at 100% for display sanity
    
    const vAnalysis = {
      variable_name: v.name,
      token_count: v.token_count,
      percentage: pct,
      waste_reason: null,
      recommendation: null
    };

    // Parameter Dominance (>75%)
    if (pct > 75) {
      issues.push(`Parameter Dominance: '${v.name}' uses ${pct.toFixed(1)}% of total prompt weight.`);
      vAnalysis.waste_reason = 'Extreme dominance in prompt composition.';
      vAnalysis.recommendation = 'Implement semantic summarization (Action: Dev required).';
      suggestions.push(`Apply semantic compression to '${v.name}'. Summarizing this part could be ~70% effective in reducing total input tokens without context loss.`);
      estimatedSavingsPct += 20;
    }

    // Tokenizer Discrepancy (e.g. Hebrew/CJK efficiencies)
    if (rawPct > 120) {
      issues.push(`Tokenizer Discrepancy: Local estimate for '${v.name}' is ${rawPct.toFixed(0)}% of reported total.`);
      suggestions.push(`The LLM provider's tokenizer is significantly more efficient for this language than the local fallback. Trust the provider's 'Input Tokens' for billing, but use this breakdown for relative weighting.`);
    }

    // Context Bloat (>60%)
    if (v.name === 'context' && pct > 60) {
      issues.push(`Context Bloat: RAG/Context takes ${pct.toFixed(1)}% of tokens.`);
      vAnalysis.waste_reason = 'Context size may exceed actual relevance thresholds.';
      vAnalysis.recommendation = 'Implement re-ranking or top-k reduction.';
      suggestions.push(`Use more selective retrieval or re-rank results to reduce context size.`);
      estimatedSavingsPct += 15;
    }

    // History Bloat (>40%)
    if (v.name.startsWith('history') && pct > 40) {
      issues.push(`History Bloat: Conversation history takes ${pct.toFixed(1)}% of tokens.`);
      vAnalysis.waste_reason = 'Long conversation history causing token pressure.';
      vAnalysis.recommendation = 'Use sliding window or turn summarization.';
      suggestions.push(`Implement a sliding window or summarize old conversation turns.`);
      estimatedSavingsPct += 10;
    }

    // Whitespace Waste (Heuristic)
    if (v.content && v.content.includes('  ')) {
      const originalLen = v.content.length;
      const cleanedLen = v.content.replace(/\s+/g, ' ').length;
      const wastePct = ((originalLen - cleanedLen) / (originalLen || 1)) * 100;
      if (wastePct > 5) {
        issues.push(`Whitespace Waste: '${v.name}' has ${wastePct.toFixed(1)}% redundant whitespace.`);
        vAnalysis.waste_reason = vAnalysis.waste_reason || 'Excessive whitespace/formatting bloat.';
        vAnalysis.recommendation = vAnalysis.recommendation || 'Enable lossless compression for this project.';
        suggestions.push(`Normalize whitespace in '${v.name}' before sending to LLM.`);
      }
    }

    variableAnalysis.push(vAnalysis);
  }

  estimatedSavingsUsd = (usageRecord.total_cost * estimatedSavingsPct) / 100;

  return {
    ...mceResult,
    detected_issues: issues,
    optimization_suggestions: suggestions,
    variable_analysis: variableAnalysis,
    estimated_savings_pct: Math.min(estimatedSavingsPct, 90),
    estimated_savings_usd: estimatedSavingsUsd
  };
}
