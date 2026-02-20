# TokenTalos Tech Stack

## Backend
- **Distribution:** Public npm registry (`@meller/tokentalos`).
- **Engine:** Standalone host-agnostic logic layer (`lib/engine`).
- **Framework:** Express.js (Node.js)
- **Database:** SQLite (Default) / PostgreSQL
- **LLM Clients:** @google/generative-ai, anthropic, openai (Unified execution interface).
- **Utilities:** js-tiktoken (Tokenization), chalk, inquirer, commander

## Dashboard
- **Framework:** Vite + React (TypeScript)
- **Styling:** Tailwind CSS v4 (using @tailwindcss/vite).
- **Charts:** Recharts
- **Icons:** Lucide-React

## CLI
- **Entry:** `bin/tokentalos.js`
- **Commands:** stats, list, heatmap, setup, export, dashboard
