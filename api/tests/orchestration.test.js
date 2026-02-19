import { TokenTalosPrompt } from '../../lib/engine/parameterizer.js';

describe('TokenTalosPrompt Orchestrator', () => {
  test('should build a prompt with multiple parts', () => {
    const prompt = new TokenTalosPrompt('gemini', 'gemini-1.5-flash');
    prompt.addSystem('You are a helpful assistant');
    prompt.addContext('User is located in Tel Aviv');
    prompt.addUserQuery('What is the weather?');

    const messages = prompt.toMessages();
    expect(messages).toHaveLength(3);
    expect(messages[0]).toEqual({ role: 'system', content: 'You are a helpful assistant' });
    expect(messages[1]).toEqual({ role: 'user', content: 'User is located in Tel Aviv' });
    expect(messages[2]).toEqual({ role: 'user', content: 'What is the weather?' });
  });

  test('should correctly count tokens (using tiktoken fallback or mock)', () => {
    const prompt = new TokenTalosPrompt('openai', 'gpt-4o');
    prompt.add('test', 'hello world');
    
    const data = prompt.getTrackingData();
    expect(data.total_tokens).toBeGreaterThan(0);
    expect(data.variables[0].name).toBe('test');
  });
});
