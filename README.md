# Marketing Intelligence Platform

Marketing Intelligence Platform is a web application for collecting a brand's marketing context, connecting its data, and exploring marketing questions with an AI assistant. The repository contains a Next.js web app and a separate Python investigation agent.

## Features

- Brand onboarding for positioning, audience, market, marketing, measurement, and brand voice.
- Account registration and sign-in backed by Supabase Auth.
- PostgreSQL connection setup, including schema discovery and selection of tables and columns for agent access.
- A brand assistant experience backed by a Python agent that can retrieve marketing knowledge and query approved data.
- Retrieval and evaluation utilities for the marketing handbook and agent workflows.

## Technology

- **Web:** Next.js 16, React 19, TypeScript, Tailwind CSS
- **Authentication and app data:** Supabase
- **Database connectivity:** PostgreSQL
- **Agent:** Python, LangGraph, and Google Generative AI
- **Knowledge retrieval:** Pinecone, Jina, and Groq

## Requirements

- Node.js 20.9 or later and npm
- A Supabase project configured for the application
- For the Python agent: Python and credentials for the model, database, and retrieval providers it uses

## Run the web application

From the `marketing-intelligence-platform` directory:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Create a `.env.local` file in this directory and configure:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
CREDENTIALS_KEY=your-base64-encoded-32-byte-key
```

Generate a suitable credentials-encryption key with Python:

```bash
python -c "import base64,secrets; print(base64.b64encode(secrets.token_bytes(32)).decode())"
```

The value of `CREDENTIALS_KEY` must be the same anywhere the app encrypts or decrypts stored database credentials. Keep `.env.local` and all provider credentials private; do not commit them.

## Python agent

The agent code is in `agent/`. Its command-line entry point accepts a brand ID and a question:

```bash
python -m agent.scripts.ask "<brand-id>" "How did our marketing performance change last month?"
```

Configure the agent's required credentials in `agent/.env` before running it:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
SECRET_SUPABASE_KEY=your-supabase-service-role-key
CREDENTIALS_KEY=your-base64-encoded-32-byte-key
MODEL=your-google-generative-ai-model
GOOGLE_API_KEY=your-google-api-key
JINA_API_KEY=your-jina-api-key
GROQ_API_KEY=your-groq-api-key
PINECONE_API_KEY=your-pinecone-api-key
```

`LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` can also be set to enable tracing. Python dependencies are tracked in [`agent/requirements.txt`](./agent/requirements.txt); the agent also depends on provider and framework packages imported by its modules, so verify those dependencies are installed in your Python environment before running it.

The web app and Python agent are separate processes: `npm run dev` does not start the agent. Agent-backed features also require the corresponding Supabase, database, model, and retrieval services to be configured.

## Available npm commands

```bash
npm run dev    # Start the development server
npm run lint   # Run ESLint
npm run build  # Build the production app
npm run start  # Start the production server
```

## Project layout

```text
src/
  app/          Next.js routes, pages, and API handlers
  components/   Shared React components
  lib/          Supabase, database, and MCP helpers
  types/        Shared TypeScript types
agent/
  graph/        Investigation workflow
  retrieval/    Marketing knowledge retrieval
  security/     Agent context and SQL safeguards
  tools/        Agent tools for data and reporting
  tests/        Python tests
```
