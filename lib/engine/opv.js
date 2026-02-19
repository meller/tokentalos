/**
 * OPV (Optimized Process Verification) Logic
 * 
 * Ported and adapted for TokenTalos Engine.
 */

export const ReasoningStatus = {
  ON_TRACK: "on_track",
  UNCERTAIN: "uncertain",
  FAILED: "failed",
  LOOPING: "looping",
  COMPLETED: "completed"
};

export class OPVService {
  constructor(config, llmGateway) {
    this.config = config;
    this.gateway = llmGateway;
  }

  async verifyReasoning(params) {
    const { thinking_sample, task_description, previous_status } = params;
    
    const verificationPrompt = this._buildVerificationPrompt(
      thinking_sample,
      task_description,
      previous_status
    );

    const provider = this.config.llmProvider || 'gemini';
    const model = this.config.defaultModel || 'gemini-3-flash-preview';

    // Use default analysis model
    const result = await this.gateway.execute(
      provider, 
      model, 
      [{ role: 'user', content: verificationPrompt }]
    );

    return this._parseVerificationResponse(result.content, thinking_sample.length);
  }

  _buildVerificationPrompt(thinking, task, previousStatus) {
    return `You are a reasoning verification system. Your job is to analyze the reasoning process of another AI model and determine if it's on the right track.

**Task the model is trying to solve:**
${task}

**Current reasoning (thinking tokens):**
${thinking}

**Previous verification status:** ${previousStatus || "None (first check)"}

**Your task:**
Analyze the reasoning and determine its status. Choose ONE of:
1. ON_TRACK - Reasoning is progressing correctly. NOTE: Internalizing safety rules or restating constraints at the start is a POSITIVE sign of compliance and should be marked ON_TRACK.
2. UNCERTAIN - Cannot determine yet, need more reasoning tokens.
3. FAILED - Reasoning contains logical errors, violates safety rules, or takes a wrong approach.
4. LOOPING - Reasoning is repeating itself without progress.
5. COMPLETED - Reasoning has successfully reached a conclusion.

**Respond in this EXACT format:**
STATUS: [one of: ON_TRACK, UNCERTAIN, FAILED, LOOPING, COMPLETED]
CONFIDENCE: [0.0 to 1.0]
SHOULD_CONTINUE: [yes or no]
REASONING: [brief explanation of your assessment]

Be critical and err on the side of FAILED/LOOPING if you see signs of trouble.`;
  }

  _parseVerificationResponse(response, charCount) {
    const lines = response.strip ? response.strip().split("\n") : response.trim().split("\n");

    let status = ReasoningStatus.UNCERTAIN;
    let confidence = 0.5;
    let shouldContinue = true;
    let reasoning = "Unable to parse response";

    for (let line of lines) {
      line = line.trim();
      if (line.startsWith("STATUS:")) status = line.split("STATUS:")[1].trim().toLowerCase();
      else if (line.startsWith("CONFIDENCE:")) confidence = parseFloat(line.split("CONFIDENCE:")[1].trim()) || 0.5;
      else if (line.startsWith("SHOULD_CONTINUE:")) shouldContinue = line.split("SHOULD_CONTINUE:")[1].trim().toLowerCase() === 'yes';
      else if (line.startsWith("REASONING:")) reasoning = line.split("REASONING:")[1].trim();
    }

    return { status, confidence, should_continue: shouldContinue, char_count: charCount, reasoning };
  }

  shouldKillRequest(result, threshold = 0.7) {
    if (result.status === ReasoningStatus.FAILED && result.confidence > threshold) return true;
    if (result.status === ReasoningStatus.LOOPING) return true;
    if (result.status === ReasoningStatus.COMPLETED) return true;
    return false;
  }
}
