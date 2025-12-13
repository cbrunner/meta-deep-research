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
- **Persistence**: AsyncSqliteSaver with `replit_state.db`
- **Port**: 5000

### Frontend (React/Vite)
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Markdown**: react-markdown

## Project Structure

```
├── main.py                 # FastAPI server + LangGraph definition
├── client/
│   ├── src/
│   │   ├── App.tsx        # Main React component
│   │   ├── index.css      # Tailwind imports
│   │   └── main.tsx       # React entry point
│   ├── dist/              # Built frontend (served by FastAPI)
│   ├── vite.config.ts     # Vite configuration
│   └── package.json       # Frontend dependencies
├── pyproject.toml         # Python dependencies
└── replit_state.db        # SQLite persistence (auto-created)
```

## API Endpoints

- `POST /api/research` - Start a new research job
  - Body: `{ "query": "your research question" }`
  - Returns: `{ "run_id": "uuid", "status": "started", "message": "..." }`

- `GET /api/status/{run_id}` - Poll research job status
  - Returns full state including agent statuses and consensus report

- `GET /api/health` - Health check with API key configuration status

## Environment Variables Required

- `GEMINI_API_KEY` - Google Gemini API key
- `OPENAI_API_KEY` - OpenAI API key  
- `PERPLEXITY_API_KEY` - Perplexity API key
- `ANTHROPIC_API_KEY` - Anthropic API key (for supervisor and synthesizer)

## State Schema

```python
class SubAgentState(TypedDict):
    status: str       # "idle", "polling", "completed", "failed"
    job_id: Optional[str]
    output: Optional[str]
    error: Optional[str]

class MetaResearchState(TypedDict):
    user_query: str
    research_plan: Optional[str]
    gemini_data: SubAgentState
    openai_data: SubAgentState
    perplexity_data: SubAgentState
    consensus_report: Optional[str]
    overall_status: str
```

## Running the Application

1. Set the required API keys as environment secrets
2. The workflow runs `python main.py` which starts uvicorn on port 5000
3. Frontend is pre-built and served from `client/dist/`

## Development

To rebuild the frontend:
```bash
cd client && npm run build
```

To add Python packages:
```bash
pip install <package>
```
