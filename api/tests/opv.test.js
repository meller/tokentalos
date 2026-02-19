import { OPVService, ReasoningStatus } from '../../lib/engine/opv.js';

describe('OPV Logic', () => {
  let opv;

  beforeEach(() => {
    opv = new OPVService({}, null);
  });

  test('should parse valid Gemini verification response', () => {
    const response = `
      STATUS: ON_TRACK
      CONFIDENCE: 0.9
      SHOULD_CONTINUE: yes
      REASONING: The model is following the logical steps correctly.
    `;
    
    const result = opv._parseVerificationResponse(response, 100);
    
    expect(result.status).toBe(ReasoningStatus.ON_TRACK);
    expect(result.confidence).toBe(0.9);
    expect(result.should_continue).toBe(true);
    expect(result.reasoning).toContain('following the logical steps');
  });

  test('should handle FAILED status and suggest kill', () => {
    const result = { status: ReasoningStatus.FAILED, confidence: 0.8 };
    expect(opv.shouldKillRequest(result)).toBe(true);
  });

  test('should handle LOOPING status and suggest kill', () => {
    const result = { status: ReasoningStatus.LOOPING, confidence: 0.5 };
    expect(opv.shouldKillRequest(result)).toBe(true);
  });
});
