import { GoogleGenerativeAI } from '@google/generative-ai';
import { getCostCalculator } from './pricing.js';

export async function runAIAnalysis(config, usageRecord, variables) {
  if (config.llmProvider !== 'gemini') return null;

  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const variableInfo = variables.map(v => `${v.name} (${v.token_count} tokens): "${v.content.substring(0, 100)}..."`).join('\n');
    
    const prompt = `
    Analyze this LLM prompt structure and suggest optimizations to reduce costs while maintaining performance.
    
    Usage Context:
    - Provider: ${usageRecord.provider}
    - Model: ${usageRecord.model}
    - Total Tokens: ${usageRecord.total_tokens}
    - Total Cost: $${usageRecord.total_cost}
    
    Variables:
    ${variableInfo}
    
    Return a JSON object with:
    - detected_issues (array of strings)
    - optimization_suggestions (array of strings)
    - estimated_savings_pct (number)
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Attempt to parse JSON from response
    try {
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}') + 1;
      const analysis = JSON.parse(text.substring(jsonStart, jsonEnd));
      
      const calculator = getCostCalculator();
      const mceResult = calculator.getBestAlternative(
        usageRecord.provider, 
        usageRecord.model, 
        usageRecord.input_tokens, 
        usageRecord.output_tokens,
        config.comparisonProviders
      );
      
      if (mceResult) {
        analysis.mce_best_alternative_model = mceResult.model;
        analysis.mce_best_alternative_provider = mceResult.provider;
        analysis.mce_best_alternative_cost = mceResult.cost;
        analysis.mce_savings_pct = ((usageRecord.total_cost - mceResult.cost) / usageRecord.total_cost) * 100;
      }
      
      return analysis;
    } catch (err) {
      console.warn('AI analysis JSON parsing failed:', err);
      return null;
    }
  } catch (err) {
    console.error('AI analysis error:', err);
    return null;
  }
}
