import { TokenTalosPrompt } from '../../lib/engine/parameterizer.js';

describe('TokenTalos Granular Parts', () => {
  test('should support and track custom arbitrary parts', () => {
    const prompt = new TokenTalosPrompt('gemini', 'gemini-3-flash-preview');
    
    // Standard parts
    prompt.addSystem('System prompt');
    
    // Custom parts (as added in the_hero_journey)
    prompt.add('safety_guardrails', 'Safety rules...');
    prompt.add('jungian_context', 'Phase: Ego...');
    prompt.add('journey_state', 'Hero: Arthur...');
    
    prompt.addUserQuery('Hello');

    const trackingData = prompt.getTrackingData();
    const variableNames = trackingData.variables.map(v => v.name);

    expect(variableNames).toContain('system');
    expect(variableNames).toContain('safety_guardrails');
    expect(variableNames).toContain('jungian_context');
    expect(variableNames).toContain('journey_state');
    expect(variableNames).toContain('user_query');

    expect(trackingData.variables.find(v => v.name === 'safety_guardrails').content).toBe('Safety rules...');
    
    const messages = prompt.toMessages();
    // System is role:system, others are role:user by default in parameterizer.js
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user'); 
    expect(messages[1].content).toBe('Safety rules...');
  });
});
