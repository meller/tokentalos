import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('Dashboard App', () => {
  it('should render the header after loading', async () => {
    render(<App />);
    // Wait for loading to finish and header to appear
    await waitFor(() => {
      expect(screen.getByText('TokenTalos Analytics')).toBeInTheDocument();
    }, { timeout: 2000 });
  });
});
