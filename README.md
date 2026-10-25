# Marketing Intelligence Platform

Marketing Intelligence Platform is a workspace for organizing a brand's marketing knowledge and making its business data available for structured analysis. It combines a Next.js web application for account setup and brand onboarding with a separate Python agent designed to investigate marketing questions using approved database data and marketing guidance.

## Features

- **Brand workspace:** Create a brand profile with its positioning, target customers, brand voice, market, marketing priorities, constraints, and success measures. Onboarding also includes business-data, channel, and document steps.
- **Accounts and saved context:** Sign up and sign in with Supabase Auth. The dashboard loads the signed-in user's brand information for display and contextual lookup.
- **Guided database access:** Connect a PostgreSQL database, discover its schema, and choose which tables and columns are relevant. The setup flow creates a restricted database role for the agent rather than giving it the owner's general database credentials.
- **Marketing investigation agent:** The Python agent can build a bounded investigation plan, inspect the allowed schema, run read-only SQL queries, and search a marketing handbook for analytical methods and recommendations.
- **Evidence-based reporting:** Agent findings are expected to cite evidence returned by its tools. The report is validated before it is returned, and the report schema supports summaries, findings, recommended actions, knowledge citations, and explicit unknowns.
- **Knowledge retrieval and evaluation:** The agent includes handbook retrieval and evaluation scripts to assess retrieval and investigation behavior.

## What the agent does

The Python agent is an analytical assistant for answering questions about a brand's marketing and business data. It does not launch or change campaigns. It gathers relevant evidence, applies marketing guidance, and returns a structured answer.

For a question such as “How did our marketing performance change last month?”, the agent:

1. **Loads relevant marketing guidance.** It searches its knowledge base for handbook material that may help with the analysis. This guidance can inform methods and recommendations, but it is not treated as evidence about the brand's actual results.
2. **Plans an investigation.** A language model turns the question into a small, bounded plan. Steps identify what evidence is needed and can depend on earlier results. The plan is checked against the tools and data available to that brand.
3. **Checks the available data.** The agent can inspect the permitted database schema and its descriptions to understand which tables and columns are available.
4. **Queries approved business data.** When needed, it runs read-only `SELECT` queries against the configured PostgreSQL connection. Queries are checked by a SQL guard, run in a read-only transaction, and have a timeout and result-size cap.
5. **Builds and verifies the answer.** The final report can include a summary, evidence-linked findings, suggested actions, handbook citations, and questions the data could not answer. A verification step checks the report against collected evidence before accepting it.

This design separates **what the brand's data shows** from **general marketing advice**, and is intended to avoid presenting unsupported numbers as facts. The agent runs independently from the web server.

## How the project works

1. A user creates an account and enters the brand's business and marketing context during onboarding.
2. The user can connect a PostgreSQL data source, inspect the discovered schema, and select approved tables and columns.
3. The Python agent uses a brand ID and question to investigate, as described above. Its database access is restricted to the configured agent role and approved data.

The repository currently contains two related but separate experiences: the web dashboard's assistant is a saved-brand-profile lookup and explicitly notes that generative replies are not connected; the Python investigation agent is run independently from the command line. Starting the Next.js app does not start the Python agent.

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
