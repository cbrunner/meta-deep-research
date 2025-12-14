# Meta-Deep Research

A LangGraph-based background worker that orchestrates parallel deep research across Gemini, OpenAI, and Perplexity APIs with async polling and persistent state management.

## Overview

This application provides a unified research orchestration system that:
1. Takes a user query and creates a research plan using OpenRouter (configurable model)
2. Dispatches the query to three parallel deep research agents in parallel:
   - **Gemini Deep Research** (`deep-research-pro-preview-12-2025`) via Google Interactions API
   - **OpenAI o3 Deep Research** (`openai/o3-deep-research`) via OpenRouter
   - **Perplexity Deep Research** (`sonar-deep-research`) via Perplexity API
3. Synthesizes the results into a consensus report using OpenRouter (configurable model)
4. Collects and deduplicates citations from all research agents into a unified bibliography
5. Allows users to download the final report (with citations) as Markdown or PDF

## Architecture

### Backend (Python/FastAPI)
- **Framework**: FastAPI with LangGraph StateGraph
- **Database**: PostgreSQL for users, sessions, and configuration
- **Persistence**: AsyncSqliteSaver with `replit_state.db` for LangGraph state
- **Port**: 5000

### Frontend (React/Vite)
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS with Typography plugin
- **Icons**: Lucide React
- **Markdown**: react-markdown with remark-gfm, rehype-sanitize
- **Syntax Highlighting**: react-syntax-highlighter (Prism with oneDark theme)

## Project Structure

```
├── main.py                 # FastAPI server + LangGraph definition + auth endpoints
├── database.py             # SQLAlchemy models (User, Session, SupervisorConfig)
├── auth.py                 # Authentication utilities and dependencies
├── client/
│   ├── src/
│   │   ├── App.tsx        # Main React component with login UI + admin settings
│   │   ├── index.css      # Tailwind imports + print/PDF styles
│   │   ├── main.tsx       # React entry point
│   │   └── components/    # Report rendering components
│   │       ├── ReportRenderer.tsx     # Enhanced Markdown renderer with syntax highlighting
│   │       ├── ReportContainer.tsx    # Full report wrapper with header/footer
│   │       ├── CitationList.tsx       # Formatted reference list
│   │       ├── Callout.tsx            # Styled callout boxes (info, warning, etc.)
│   │       ├── KeyFindingCard.tsx     # Gradient cards for key findings
│   │       ├── AgentSourceCard.tsx    # Agent-specific styled cards
│   │       └── ReportSection.tsx      # Section wrappers with variants
│   ├── dist/              # Built frontend (served by FastAPI)
│   ├── vite.config.ts     # Vite configuration
│   └── package.json       # Frontend dependencies
├── pyproject.toml         # Python dependencies
└── replit_state.db        # SQLite persistence (auto-created)
```

## Report Styling

Research reports use consulting-firm quality styling with:
- **Typography**: Tailwind Typography plugin for professional prose styling
- **Code Blocks**: Syntax highlighting with Prism (oneDark theme) and line numbers
- **Tables**: Enhanced styling with hover states and proper borders
- **Blockquotes**: Indigo-styled callout boxes for key findings
- **Links**: External link icons and opens in new tabs
- **Print/PDF**: Optimized styles for print media with proper page breaks

## Authentication

The app uses session-based authentication with signed cookies:

- **Register**: POST /api/auth/register - Create new user account
- **Login**: POST /api/auth/login - Authenticate with email/password
- **Logout**: POST /api/auth/logout - End session
- **Current User**: GET /api/auth/me - Get authenticated user info

### User Roles
- **user**: Regular user, can create and run research
- **admin**: Can access admin settings to configure models and prompts

### Initial Admin Setup
Set these environment variables before starting to create the first admin:
- `INITIAL_ADMIN_EMAIL`
- `INITIAL_ADMIN_PASSWORD`

## Admin Configuration

Admins can configure:
- **Supervisor Model**: Model used to create research plans (via OpenRouter)
- **Supervisor Prompt**: Prompt template for research planning (use `{query}` and `{current_date}` placeholders)
- **Synthesizer Model**: Model used to synthesize research reports (via OpenRouter)
- **Synthesizer Prompt**: Prompt template for synthesizing consensus reports (use `{query}` for the original query, `{combined_reports}` for the agent reports, and `{current_date}` for the current date)
- **Show Live Agent Feeds**: Toggle to display real-time streaming updates from each research agent during research
- **Agent Timeout (minutes)**: Maximum time each research agent is allowed to run before timing out (default: 120 minutes, range: 5-1440 minutes)
- **Active Research Jobs**: View all currently running research jobs with user email, query preview, and start time. Admins can cancel any running job.
- **User Management**: View all registered users, change user roles between user/admin, and delete users. Admins cannot modify or delete their own account for safety.

## Live Agent Status Streaming

When enabled, the app displays real-time updates from each research agent:
- **Gemini**: Shows research plan steps as a checklist with completion status
- **OpenAI**: Shows reasoning output as a terminal-style scrolling log
- **Perplexity**: Shows discovered sources with favicons and links

The live feeds are displayed within each agent card during active research and remain visible even after an individual agent completes, as long as the overall research session is still in progress.

### Individual Agent Status Updates

Each agent card shows its completion status immediately when that specific agent finishes, rather than waiting for all agents to complete. The frontend uses live update events (`completed`/`error`) to detect individual agent completion and updates the visual status (icon, text, styling) in real-time. This provides better user feedback during long-running research sessions.

## Thinking Token Filtering

Some research agents (notably Perplexity's `sonar-deep-research`) include internal reasoning wrapped in `<think>...</think>` tags in their output. These thinking tokens are:
- **Detected**: Each agent node logs whether thinking tokens are found in the output
- **Stripped**: Before synthesis, all agent outputs are cleaned of `<think>`, `<thinking>`, and `<reasoning>` tags to prevent internal reasoning from polluting the final consensus report

This filtering is automatic and logged in the console output.

## API Error Resilience

The Gemini agent includes retry logic for transient API errors:
- **500 Internal Server Errors**: Automatically retried up to 3 times with exponential backoff (5s, 10s, 15s delays)
- **Other Errors**: Non-500 errors are raised immediately without retry
- **Logging**: Each retry attempt is logged with the error message for debugging

This helps handle temporary Google API instability without failing the entire research job.

Available models via OpenRouter:
- google/gemini-3-pro-preview - Google Gemini 3 Pro Preview
- google/gemini-2.5-pro - Google Gemini 2.5 Pro
- anthropic/claude-opus-4.5 - Anthropic Claude 4.5 Opus
- anthropic/claude-sonnet-4.5 - Anthropic Claude 4.5 Sonnet (default)
- x-ai/grok-4.1-fast - xAI Grok 4.1 Fast
- x-ai/grok-4 - xAI Grok 4
- openai/gpt-5.2 - OpenAI GPT-5.2
- openai/o3 - OpenAI o3

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Admin (requires admin role)
- `GET /api/admin/config` - Get supervisor configuration
- `PATCH /api/admin/config` - Update supervisor configuration
- `GET /api/admin/jobs` - Get list of active research jobs
- `POST /api/admin/jobs/{run_id}/cancel` - Cancel an active research job
- `GET /api/admin/users` - Get list of all users
- `PATCH /api/admin/users/{user_id}` - Update user role
- `DELETE /api/admin/users/{user_id}` - Delete user (cannot delete self)

### Research (requires authentication)
- `POST /api/research` - Create a research plan (requires approval)
- `POST /api/research/immediate` - Start research immediately without planning
- `POST /api/research/{run_id}/approve` - Approve plan and start research
- `GET /api/status/{run_id}` - Poll research job status

### History (requires authentication)
- `GET /api/research/history` - Get user's research history (paginated, reverse chronological)
- `GET /api/research/history/{id}` - Get full details of a specific research

### Other
- `GET /api/health` - Health check with API key configuration status

## Research Flows

### Two-Phase Flow (Create Research Plan)
1. **Plan Creation Phase**: User submits query, supervisor creates a research plan
2. **Approval Phase**: User reviews the plan and clicks "Approve & Start Research" or "Cancel"
3. **Research Phase**: All three agents run in parallel, results are synthesized into consensus report

### Immediate Flow (Start Research Now)
1. User submits query and clicks "Start Research Now"
2. Research agents run immediately in parallel (no plan created)
3. Results are synthesized into consensus report

## Environment Variables Required

- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Secret for signing session cookies
- `GEMINI_API_KEY` - Google Gemini API key
- `PERPLEXITY_API_KEY` - Perplexity API key
- `AI_INTEGRATIONS_OPENROUTER_API_KEY` - (auto-configured) OpenRouter via Replit AI Integrations
- `AI_INTEGRATIONS_OPENROUTER_BASE_URL` - (auto-configured) OpenRouter via Replit AI Integrations
- `INITIAL_ADMIN_EMAIL` - (optional) Email for initial admin user
- `INITIAL_ADMIN_PASSWORD` - (optional) Password for initial admin user

Note: OpenRouter integration uses Replit AI Integrations, which provides API access without requiring your own API key. Usage is billed to your Replit credits.

## Running the Application

1. Set the required API keys and database URL as environment secrets
2. (Optional) Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD for admin access
3. The workflow runs `python main.py` which starts uvicorn on port 5000
4. Frontend is pre-built and served from `client/dist/`

## Development

To rebuild the frontend:
```bash
cd client && npm run build
```

To add Python packages:
```bash
pip install <package>
```
