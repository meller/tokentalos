import { getCostCalculator, PRICING_DATA } from '../../lib/engine/pricing.js';

describe('Pricing Engine (CostCalculator)', () => {
    let calculator;

    beforeEach(() => {
        calculator = getCostCalculator();
    });

    test('calculates correct input and output costs', () => {
        // gemini-3-flash: input 0.50, output 3.00 per 1M tokens
        const [inputCost, outputCost] = calculator.calculateCost('google', 'gemini-3-flash', 1_000_000, 2_000_000);
        expect(inputCost).toBe(0.50);
        expect(outputCost).toBe(6.00);
    });

    test('getBestAlternative returns the cheapest alternative', () => {
        const bestAlt = calculator.getBestAlternative('openai', 'o3-2025-12-15', 1000, 1000);
        expect(bestAlt).not.toBeNull();
        // amazon.nova-micro-v1 at 0.05 input / 0.20 output should be the cheapest theoretically
        expect(bestAlt.cost).toBeLessThan(0.0003); // Total should be very low
    });

    test('getAllAlternatives returns a sorted list of all alternatives', () => {
        const allAlts = calculator.getAllAlternatives('openai', 'o3-2025-12-15', 1000, 1000);
        expect(allAlts).toBeInstanceOf(Array);
        expect(allAlts.length).toBeGreaterThan(5);

        // Verify it is sorted by cost
        for (let i = 0; i < allAlts.length - 1; i++) {
            expect(allAlts[i].cost).toBeLessThanOrEqual(allAlts[i + 1].cost);
        }
    });

    test('getAllAlternatives returns savingsPct correctly', () => {
        // Current price vs slightly cheaper models
        const allAlts = calculator.getAllAlternatives('anthropic', 'claude-4-6-opus', 1000, 1000);
        const someAlt = allAlts.find(a => a.savingsPct > 0);
        expect(someAlt).toBeDefined();
        expect(someAlt.savingsPct).toBeGreaterThan(0);
        expect(someAlt.savingsPct).toBeLessThanOrEqual(100);
    });
});
