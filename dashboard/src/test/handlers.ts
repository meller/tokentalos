import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('http://localhost:8060/api/usage/stats', () => {
    return HttpResponse.json({
      total_tokens: 1000,
      total_cost: 0.05,
      total_requests: 10,
      by_provider: [],
      by_model: []
    });
  }),
  http.get('http://localhost:8060/api/analytics/heatmap', () => {
    return HttpResponse.json({ heatmap: [] });
  }),
];
