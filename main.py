import os
import asyncio
import uuid
from typing import TypedDict, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

import httpx
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
from google import genai

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
PERPLEXITY_API_KEY = os.environ.get("PERPLEXITY_API_KEY", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

POLL_INTERVAL = 30


class SubAgentState(TypedDict):
    status: str
    job_id: Optional[str]
    output: Optional[str]
    error: Optional[str]


def create_default_subagent_state() -> SubAgentState:
    return {"status": "idle", "job_id": None, "output": None, "error": None}


class MetaResearchState(TypedDict):
    user_query: str
    research_plan: Optional[str]
    gemini_data: SubAgentState
    openai_data: SubAgentState
    perplexity_data: SubAgentState
    consensus_report: Optional[str]
    overall_status: str


async def supervisor_node(state: MetaResearchState) -> MetaResearchState:
    """Supervisor: Creates research plan and routes to all three agents."""
    query = state["user_query"]
    
    if not ANTHROPIC_API_KEY:
        plan = f"Research plan for: {query}\n- Gather comprehensive data from Gemini Deep Research\n- Analyze with OpenAI Deep Research\n- Cross-reference with Perplexity Deep Research"
    else:
        try:
            client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
            response = await client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=500,
                messages=[{
                    "role": "user",
                    "content": f"""You are a research supervisor. Create a brief research plan for this query:
                    
Query: {query}

Output a concise 2-3 sentence plan explaining how three parallel deep research agents (Gemini, OpenAI, Perplexity) should approach this query."""
                }]
            )
            plan = response.content[0].text if hasattr(response.content[0], 'text') else str(response.content[0])
        except Exception as e:
            plan = f"Research plan for: {query}\n- Gather comprehensive data from all three research engines\nError creating detailed plan: {str(e)}"
    
    return {
        **state,
        "research_plan": plan,
        "gemini_data": {"status": "polling", "job_id": None, "output": None, "error": None},
        "openai_data": {"status": "polling", "job_id": None, "output": None, "error": None},
        "perplexity_data": {"status": "polling", "job_id": None, "output": None, "error": None},
        "overall_status": "researching"
    }


async def gemini_submit_node(state: MetaResearchState) -> MetaResearchState:
    """Submit research job to Gemini using google-genai SDK."""
    query = state["user_query"]
    gemini_data = state["gemini_data"].copy()
    
    if not GEMINI_API_KEY:
        gemini_data["status"] = "failed"
        gemini_data["error"] = "GEMINI_API_KEY not configured"
        return {**state, "gemini_data": gemini_data}
    
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        
        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-2.0-flash",
            contents=f"""You are a deep research agent. Conduct comprehensive research on the following query and provide a detailed, well-structured report with citations where possible.

Query: {query}

Provide a thorough analysis covering:
1. Key findings and facts
2. Multiple perspectives
3. Supporting evidence
4. Conclusions and recommendations"""
        )
        
        gemini_data["status"] = "completed"
        gemini_data["output"] = response.text
        gemini_data["job_id"] = str(uuid.uuid4())[:8]
        
    except Exception as e:
        gemini_data["status"] = "failed"
        gemini_data["error"] = str(e)
    
    return {**state, "gemini_data": gemini_data}


async def openai_submit_node(state: MetaResearchState) -> MetaResearchState:
    """Submit research job to OpenAI using responses API."""
    query = state["user_query"]
    openai_data = state["openai_data"].copy()
    
    if not OPENAI_API_KEY:
        openai_data["status"] = "failed"
        openai_data["error"] = "OPENAI_API_KEY not configured"
        return {**state, "openai_data": openai_data}
    
    try:
        client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[{
                "role": "user",
                "content": f"""You are a deep research agent. Conduct comprehensive research on the following query and provide a detailed, well-structured report.

Query: {query}

Provide a thorough analysis covering:
1. Key findings and facts
2. Multiple perspectives  
3. Supporting evidence
4. Conclusions and recommendations"""
            }],
            max_tokens=4000
        )
        
        openai_data["status"] = "completed"
        openai_data["output"] = response.choices[0].message.content
        openai_data["job_id"] = response.id[:8] if response.id else str(uuid.uuid4())[:8]
        
    except Exception as e:
        openai_data["status"] = "failed"
        openai_data["error"] = str(e)
    
    return {**state, "openai_data": openai_data}


async def perplexity_submit_node(state: MetaResearchState) -> MetaResearchState:
    """Submit research job to Perplexity using their API."""
    query = state["user_query"]
    perplexity_data = state["perplexity_data"].copy()
    
    if not PERPLEXITY_API_KEY:
        perplexity_data["status"] = "failed"
        perplexity_data["error"] = "PERPLEXITY_API_KEY not configured"
        return {**state, "perplexity_data": perplexity_data}
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={
                    "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "sonar-pro",
                    "messages": [{
                        "role": "user",
                        "content": f"""You are a deep research agent with access to real-time web data. Conduct comprehensive research on the following query and provide a detailed, well-structured report with citations.

Query: {query}

Provide a thorough analysis covering:
1. Key findings and facts (with sources)
2. Multiple perspectives
3. Supporting evidence
4. Conclusions and recommendations"""
                    }],
                    "max_tokens": 4000
                }
            )
            response.raise_for_status()
            data = response.json()
            
            perplexity_data["status"] = "completed"
            perplexity_data["output"] = data["choices"][0]["message"]["content"]
            perplexity_data["job_id"] = data.get("id", str(uuid.uuid4()))[:8]
            
    except Exception as e:
        perplexity_data["status"] = "failed"
        perplexity_data["error"] = str(e)
    
    return {**state, "perplexity_data": perplexity_data}


async def synthesizer_node(state: MetaResearchState) -> MetaResearchState:
    """Synthesize all research reports into a consensus report using Claude."""
    gemini_output = state["gemini_data"].get("output", "Not available")
    openai_output = state["openai_data"].get("output", "Not available")
    perplexity_output = state["perplexity_data"].get("output", "Not available")
    
    gemini_status = state["gemini_data"].get("status", "unknown")
    openai_status = state["openai_data"].get("status", "unknown")
    perplexity_status = state["perplexity_data"].get("status", "unknown")
    
    available_reports = []
    if gemini_status == "completed" and gemini_output:
        available_reports.append(f"## Gemini Research Report\n\n{gemini_output}")
    if openai_status == "completed" and openai_output:
        available_reports.append(f"## OpenAI Research Report\n\n{openai_output}")
    if perplexity_status == "completed" and perplexity_output:
        available_reports.append(f"## Perplexity Research Report\n\n{perplexity_output}")
    
    if not available_reports:
        return {
            **state,
            "consensus_report": "# Research Failed\n\nNo research agents were able to complete their analysis. Please check your API keys and try again.",
            "overall_status": "failed"
        }
    
    combined_reports = "\n\n---\n\n".join(available_reports)
    
    if not ANTHROPIC_API_KEY:
        consensus = f"# Meta-Deep Research Consensus Report\n\n**Query:** {state['user_query']}\n\n---\n\n{combined_reports}"
    else:
        try:
            client = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
            response = await client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=6000,
                messages=[{
                    "role": "user",
                    "content": f"""You are a research synthesis expert. Analyze the following research reports from three different AI research agents and create a comprehensive consensus report.

Original Query: {state['user_query']}

{combined_reports}

---

Create a well-structured consensus report in Markdown format that:
1. Synthesizes the key findings from all available reports
2. Identifies areas of agreement and any conflicting information
3. Provides a balanced, comprehensive answer to the original query
4. Includes citations where the source reports provided them
5. Highlights the most reliable and well-supported conclusions

Format with clear headers, bullet points, and proper Markdown formatting."""
                }]
            )
            consensus = response.content[0].text if hasattr(response.content[0], 'text') else str(response.content[0])
        except Exception as e:
            consensus = f"# Meta-Deep Research Report\n\n**Query:** {state['user_query']}\n\n*Synthesis error: {str(e)}*\n\n---\n\n{combined_reports}"
    
    return {
        **state,
        "consensus_report": consensus,
        "overall_status": "completed"
    }


async def parallel_research_node(state: MetaResearchState) -> MetaResearchState:
    """Execute all three research agents in parallel using asyncio.gather."""
    gemini_task = gemini_submit_node(state)
    openai_task = openai_submit_node(state)
    perplexity_task = perplexity_submit_node(state)
    
    results = await asyncio.gather(gemini_task, openai_task, perplexity_task)
    
    gemini_result = results[0]
    openai_result = results[1]
    perplexity_result = results[2]
    
    return {
        **state,
        "gemini_data": gemini_result["gemini_data"],
        "openai_data": openai_result["openai_data"],
        "perplexity_data": perplexity_result["perplexity_data"],
    }


def build_graph():
    """Build the LangGraph StateGraph."""
    workflow = StateGraph(MetaResearchState)
    
    workflow.add_node("supervisor", supervisor_node)
    workflow.add_node("parallel_research", parallel_research_node)
    workflow.add_node("synthesizer", synthesizer_node)
    
    workflow.add_edge(START, "supervisor")
    workflow.add_edge("supervisor", "parallel_research")
    workflow.add_edge("parallel_research", "synthesizer")
    workflow.add_edge("synthesizer", END)
    
    return workflow


checkpointer = None
graph = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global checkpointer, graph
    
    async with AsyncSqliteSaver.from_conn_string("replit_state.db") as saver:
        checkpointer = saver
        await saver.setup()
        
        workflow = build_graph()
        graph = workflow.compile(checkpointer=saver)
        
        yield


app = FastAPI(
    title="Meta-Deep Research API",
    description="Orchestrates parallel deep research across Gemini, OpenAI, and Perplexity",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ResearchRequest(BaseModel):
    query: str


class ResearchResponse(BaseModel):
    run_id: str
    status: str
    message: str


@app.get("/api")
async def api_root():
    return {
        "service": "Meta-Deep Research API",
        "version": "1.0.0",
        "endpoints": {
            "POST /api/research": "Start a new research job",
            "GET /api/status/{run_id}": "Get research job status"
        }
    }


@app.post("/api/research", response_model=ResearchResponse)
async def start_research(request: ResearchRequest):
    """Start a new meta-deep research job."""
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    
    run_id = str(uuid.uuid4())
    
    initial_state: MetaResearchState = {
        "user_query": request.query,
        "research_plan": None,
        "gemini_data": create_default_subagent_state(),
        "openai_data": create_default_subagent_state(),
        "perplexity_data": create_default_subagent_state(),
        "consensus_report": None,
        "overall_status": "starting"
    }
    
    config = {"configurable": {"thread_id": run_id}}
    
    asyncio.create_task(run_research(run_id, initial_state, config))
    
    return ResearchResponse(
        run_id=run_id,
        status="started",
        message="Research job started. Poll /api/status/{run_id} for updates."
    )


async def run_research(run_id: str, initial_state: MetaResearchState, config: dict):
    """Run the research graph asynchronously."""
    try:
        async for event in graph.astream(initial_state, config, stream_mode="values"):
            pass
    except Exception as e:
        print(f"Research error for {run_id}: {e}")


@app.get("/api/status/{run_id}")
async def get_status(run_id: str):
    """Get the current status of a research job."""
    config = {"configurable": {"thread_id": run_id}}
    
    try:
        state = await graph.aget_state(config)
        
        if state.values:
            return {
                "run_id": run_id,
                "user_query": state.values.get("user_query", ""),
                "research_plan": state.values.get("research_plan"),
                "gemini_data": state.values.get("gemini_data", create_default_subagent_state()),
                "openai_data": state.values.get("openai_data", create_default_subagent_state()),
                "perplexity_data": state.values.get("perplexity_data", create_default_subagent_state()),
                "consensus_report": state.values.get("consensus_report"),
                "overall_status": state.values.get("overall_status", "unknown")
            }
        else:
            raise HTTPException(status_code=404, detail="Research job not found")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching status: {str(e)}")


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "gemini_configured": bool(GEMINI_API_KEY),
        "openai_configured": bool(OPENAI_API_KEY),
        "perplexity_configured": bool(PERPLEXITY_API_KEY),
        "anthropic_configured": bool(ANTHROPIC_API_KEY)
    }


app.mount("/assets", StaticFiles(directory="client/dist/assets"), name="assets")


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """Serve the React SPA for all non-API routes."""
    file_path = f"client/dist/{full_path}"
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    return FileResponse("client/dist/index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
