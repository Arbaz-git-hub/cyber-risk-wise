# CyberRisk Guardian

CyberRisk AI is a full-stack application for continuous cyber risk quantification and security investment optimization. It provides a cybersecurity workspace for risk scoring, threat assessment, vulnerability tracking, financial loss estimation, security investment analysis, AI-assisted recommendations, authentication, and report generation.

## Tech stack

- TanStack Start and React
- TypeScript and Vite
- Supabase for authentication and data
- Tailwind CSS and Radix UI
- AI SDK integrations

## Development

Requirements: Node.js and Bun (the repository includes `bun.lock`).

```sh
git clone https://github.com/Arbaz-git-hub/cyber-risk-wise.git
cd cyber-risk-wise
bun install
bun run dev
```

## Available scripts

- `bun run dev` — start the development server
- `bun run build` — create a production build
- `bun run preview` — preview the production build
- `bun run lint` — run ESLint
- `bun run format` — format the project with Prettier

## Environment

Configure the Supabase project values required by the application in your local `.env` file. Do not commit private service-role keys or other secrets.
