# Meta-Deep Research

A LangGraph-based background worker that orchestrates parallel deep research across Gemini, OpenAI, and Perplexity APIs with async polling and persistent state management.

## Overview

This application provides a unified research orchestration system that:
1. Takes a user query and creates a research plan using Claude Sonnet
2. Dispatches the query to three parallel deep research agents in parallel:
   - **Gemini Deep Research** (`deep-research-pro-preview-12-2025`) via Interactions API
   - **OpenAI o3 Deep Research** (`o3-deep-research`) via Responses API with background mode
   - **Perplexity Deep Research** (`sonar-deep-research`)
3. Synthesizes the results into a consensus report using Claude

## Architecture

### Backend (Python/FastAPI)
- **Framework**: FastAPI with LangGraph StateGraph
- **Database**: PostgreSQL for users, sessions, and configuration
- **Persistence**: AsyncSqliteSaver with `replit_state.db` for LangGraph state
- **Port**: 5000

### Frontend (React/Vite)
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Markdown**: react-markdown

## Project Structure

```
├── main.py                 # FastAPI server + LangGraph definition + auth endpoints
├── database.py             # SQLAlchemy models (User, Session, SupervisorConfig)
├── auth.py                 # Authentication utilities and dependencies
├── client/
│   ├── src/
│   │   ├── App.tsx        # Main React component with login UI + admin settings
│   │   ├── index.css      # Tailwind imports
│   │   └── main.tsx       # React entry point
│   ├── dist/              # Built frontend (served by FastAPI)
│   ├── vite.config.ts     # Vite configuration
│   └── package.json       # Frontend dependencies
├── pyproject.toml         # Python dependencies
└── replit_state.db        # SQLite persistence (auto-created)
```

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
- **Supervisor Model**: Model used to create research plans
- **Supervisor Prompt**: Prompt template for research planning (use `{query}` placeholder)
- **Synthesizer Model**: Model used to synthesize research reports

Available Claude models:
- claude-sonnet-4-20250514 (default)
- claude-3-5-sonnet-20241022
- claude-3-opus-20240229
- claude-3-haiku-20240307

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Admin (requires admin role)
- `GET /api/admin/config` - Get supervisor configuration
- `PATCH /api/admin/config` - Update supervisor configuration

### Research (requires authentication)
- `POST /api/research` - Create a research plan (requires approval)
- `POST /api/research/{run_id}/approve` - Approve plan and start research
- `GET /api/status/{run_id}` - Poll research job status

### Other
- `GET /api/health` - Health check with API key configuration status

## Two-Phase Research Flow

1. **Plan Creation Phase**: User submits query, supervisor creates a research plan
2. **Approval Phase**: User reviews the plan and clicks "Approve & Start Research" or "Cancel"
3. **Research Phase**: All three agents run in parallel, results are synthesized into consensus report

## Environment Variables Required

- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Secret for signing session cookies
- `GEMINI_API_KEY` - Google Gemini API key
- `OPENAI_API_KEY` - OpenAI API key  
- `PERPLEXITY_API_KEY` - Perplexity API key
- `ANTHROPIC_API_KEY` - Anthropic API key (for supervisor and synthesizer)
- `INITIAL_ADMIN_EMAIL` - (optional) Email for initial admin user
- `INITIAL_ADMIN_PASSWORD` - (optional) Password for initial admin user

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
