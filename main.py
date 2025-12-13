import os
import asyncio
import uuid
import re
from typing import TypedDict, Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

import httpx
from openai import AsyncOpenAI
from google import genai

from datetime import datetime, timezone
from database import init_db, get_db, User, SupervisorConfig, ResearchHistory, async_session
from auth import (
    hash_password, verify_password, create_session, delete_session,
    get_current_user, get_current_user_optional, require_admin,
    set_session_cookie, clear_session_cookie, create_initial_admin,
    unsign_session_id, SESSION_COOKIE_NAME
)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
PERPLEXITY_API_KEY = os.environ.get("PERPLEXITY_API_KEY", "")

AI_INTEGRATIONS_OPENROUTER_API_KEY = os.environ.get("AI_INTEGRATIONS_OPENROUTER_API_KEY", "")
AI_INTEGRATIONS_OPENROUTER_BASE_URL = os.environ.get("AI_INTEGRATIONS_OPENROUTER_BASE_URL", "")

POLL_INTERVAL = 30


class SubAgentState(TypedDict):
    status: str
    job_id: Optional[str]
    output: Optional[str]
    error: Optional[str]
    citations: Optional[List[dict]]


def create_default_subagent_state() -> SubAgentState:
    return {"status": "idle", "job_id": None, "output": None, "error": None, "citations": None}


class MetaResearchState(TypedDict):
    user_query: str
    research_plan: Optional[str]
    gemini_data: SubAgentState
    openai_data: SubAgentState
    perplexity_data: SubAgentState
    consensus_report: Optional[str]
    overall_status: str
    citations: Optional[List[dict]]


def extract_citations_from_markdown(text: str, source_agent: str) -> List[dict]:
    """Extract [title](url) markdown links from text."""
    if not text:
        return []
    pattern = r'\[([^\]]+)\]\(([^)]+)\)'
    matches = re.findall(pattern, text)
    citations = []
    seen_urls = set()
    for title, url in matches:
        url = url.strip()
        if url.startswith(('http://', 'https://')) and url not in seen_urls:
            seen_urls.add(url)
            citations.append({
                "title": title.strip(),
                "url": url,
                "source_agent": source_agent
            })
    return citations


async def get_supervisor_config() -> Optional[SupervisorConfig]:
    """Fetch supervisor config from database."""
    async with async_session() as db:
        result = await db.execute(select(SupervisorConfig).where(SupervisorConfig.id == "default"))
        return result.scalar_one_or_none()


async def supervisor_node(state: MetaResearchState) -> MetaResearchState:
    """Supervisor: Creates research plan using OpenRouter via Replit AI Integrations."""
    query = state["user_query"]
    
    print(f"\n{'='*60}")
    print(f"[SUPERVISOR] === SUPERVISOR NODE START ===")
    print(f"[SUPERVISOR] INPUT query: {query[:500]}{'...' if len(query) > 500 else ''}")
    print(f"{'='*60}")
    
    config = await get_supervisor_config()
    model = config.supervisor_model if config else "anthropic/claude-sonnet-4.5"
    prompt_template = config.supervisor_prompt if config else """You are a research supervisor. Create a brief research plan for this query:

Query: {query}

Output a concise 2-3 sentence plan explaining how three parallel deep research agents (Gemini, OpenAI, Perplexity) should approach this query."""
    
    if not AI_INTEGRATIONS_OPENROUTER_API_KEY or not AI_INTEGRATIONS_OPENROUTER_BASE_URL:
        print(f"[SUPERVISOR] OpenRouter not configured, using fallback plan")
        plan = f"Research plan for: {query}\n- Gather comprehensive data from Gemini Deep Research\n- Analyze with OpenAI Deep Research\n- Cross-reference with Perplexity Deep Research"
    else:
        try:
            print(f"[SUPERVISOR] Model: {model}")
            print(f"[SUPERVISOR] Base URL: {AI_INTEGRATIONS_OPENROUTER_BASE_URL}")
            client = AsyncOpenAI(
                api_key=AI_INTEGRATIONS_OPENROUTER_API_KEY,
                base_url=AI_INTEGRATIONS_OPENROUTER_BASE_URL
            )
            prompt = prompt_template.replace("{query}", query)
            response = await client.chat.completions.create(
                model=model,
                max_tokens=65536,
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )
            print(f"[SUPERVISOR] Response model: {response.model}")
            print(f"[SUPERVISOR] Choices count: {len(response.choices)}")
            
            plan = None
            if response.choices:
                choice = response.choices[0]
                print(f"[SUPERVISOR] Choice finish_reason: {choice.finish_reason}")
                
                # Try content first
                if choice.message.content:
                    plan = choice.message.content
                    print(f"[SUPERVISOR] Got plan from content field")
                # Fallback to reasoning field for thinking models
                elif hasattr(choice.message, 'reasoning') and choice.message.reasoning:
                    plan = choice.message.reasoning
                    print(f"[SUPERVISOR] Got plan from reasoning field")
                # Check reasoning_content as another fallback
                elif hasattr(choice.message, 'reasoning_content') and choice.message.reasoning_content:
                    plan = choice.message.reasoning_content
                    print(f"[SUPERVISOR] Got plan from reasoning_content field")
            
            if not plan:
                plan = "Plan generation failed - no content returned from model"
                print(f"[SUPERVISOR] WARNING: No content found in response")
            else:
                print(f"[SUPERVISOR] OUTPUT plan length: {len(plan)} chars")
                print(f"[SUPERVISOR] OUTPUT plan preview: {plan[:500]}{'...' if len(plan) > 500 else ''}")
        except Exception as e:
            print(f"[SUPERVISOR] ERROR: {type(e).__name__}: {str(e)}")
            plan = f"Research plan for: {query}\n- Gather comprehensive data from all three research engines\nError creating detailed plan: {str(e)}"
    
    print(f"[SUPERVISOR] === SUPERVISOR NODE END ===\n")
    
    return {
        **state,
        "research_plan": plan,
        "overall_status": "pending_approval"
    }


async def gemini_submit_node(state: MetaResearchState) -> MetaResearchState:
    """Submit research job to Gemini Deep Research using Interactions API with polling."""
    query = state["user_query"]
    gemini_data = state["gemini_data"].copy()
    
    print(f"\n{'='*60}")
    print(f"[GEMINI] === GEMINI NODE START ===")
    print(f"[GEMINI] INPUT query: {query[:500]}{'...' if len(query) > 500 else ''}")
    print(f"[GEMINI] Model: deep-research-pro-preview-12-2025")
    print(f"{'='*60}")
    
    if not GEMINI_API_KEY:
        gemini_data["status"] = "failed"
        gemini_data["error"] = "GEMINI_API_KEY not configured"
        print(f"[GEMINI] ERROR: GEMINI_API_KEY not configured")
        print(f"[GEMINI] === GEMINI NODE END ===\n")
        return {**state, "gemini_data": gemini_data}
    
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        print(f"[GEMINI] Submitting to Interactions API...")
        
        interaction = await client.aio.interactions.create(
            input=query,
            agent="deep-research-pro-preview-12-2025",
            background=True,
            agent_config={"type": "deep-research", "thinking_summaries": "auto"}
        )
        
        interaction_id = interaction.id
        gemini_data["job_id"] = interaction_id[:8] if interaction_id else str(uuid.uuid4())[:8]
        print(f"[GEMINI] Job submitted, interaction_id: {interaction_id}")
        
        poll_count = 0
        while True:
            result = await client.aio.interactions.get(interaction_id)
            poll_count += 1
            print(f"[GEMINI] Poll #{poll_count}: status={result.status}")
            
            if result.status == "completed":
                gemini_data["status"] = "completed"
                gemini_data["output"] = result.outputs[-1].text if result.outputs else "No output received"
                gemini_data["citations"] = extract_citations_from_markdown(gemini_data["output"], "Gemini")
                print(f"[GEMINI] OUTPUT length: {len(gemini_data['output'])} chars")
                print(f"[GEMINI] Citations extracted: {len(gemini_data['citations'])}")
                print(f"[GEMINI] OUTPUT preview: {gemini_data['output'][:500]}{'...' if len(gemini_data['output']) > 500 else ''}")
                break
            elif result.status in ["failed", "cancelled"]:
                gemini_data["status"] = "failed"
                gemini_data["error"] = f"Gemini research {result.status}"
                print(f"[GEMINI] ERROR: {gemini_data['error']}")
                break
            
            await asyncio.sleep(POLL_INTERVAL)
        
    except Exception as e:
        gemini_data["status"] = "failed"
        gemini_data["error"] = str(e)
        print(f"[GEMINI] EXCEPTION: {type(e).__name__}: {str(e)}")
    
    print(f"[GEMINI] === GEMINI NODE END ===\n")
    return {**state, "gemini_data": gemini_data}


async def openai_submit_node(state: MetaResearchState) -> MetaResearchState:
    """Submit research job to OpenAI o3 Deep Research via OpenRouter."""
    query = state["user_query"]
    openai_data = state["openai_data"].copy()
    
    print(f"\n{'='*60}")
    print(f"[OPENAI] === OPENAI NODE START ===")
    print(f"[OPENAI] INPUT query: {query[:500]}{'...' if len(query) > 500 else ''}")
    print(f"[OPENAI] Model: openai/o3-deep-research (via OpenRouter)")
    print(f"{'='*60}")
    
    if not AI_INTEGRATIONS_OPENROUTER_API_KEY or not AI_INTEGRATIONS_OPENROUTER_BASE_URL:
        openai_data["status"] = "failed"
        openai_data["error"] = "OpenRouter not configured"
        print(f"[OPENAI] ERROR: OpenRouter not configured")
        print(f"[OPENAI] === OPENAI NODE END ===\n")
        return {**state, "openai_data": openai_data}
    
    try:
        print(f"[OPENAI] Sending request to OpenRouter...")
        client = AsyncOpenAI(
            api_key=AI_INTEGRATIONS_OPENROUTER_API_KEY,
            base_url=AI_INTEGRATIONS_OPENROUTER_BASE_URL,
            timeout=3600.0
        )
        
        response = await client.chat.completions.create(
            model="openai/o3-deep-research",
            max_tokens=100000,
            messages=[{
                "role": "user",
                "content": query
            }]
        )
        
        openai_data["job_id"] = response.id[:8] if response.id else str(uuid.uuid4())[:8]
        print(f"[OPENAI] Response received, id: {response.id}")
        print(f"[OPENAI] finish_reason: {response.choices[0].finish_reason if response.choices else 'N/A'}")
        
        # Extract content from response
        output = None
        if response.choices:
            choice = response.choices[0]
            # Try content first
            if choice.message.content:
                output = choice.message.content
                print(f"[OPENAI] Got output from content field")
            # Fallback to reasoning field for thinking models
            elif hasattr(choice.message, 'reasoning') and choice.message.reasoning:
                output = choice.message.reasoning
                print(f"[OPENAI] Got output from reasoning field")
            elif hasattr(choice.message, 'reasoning_content') and choice.message.reasoning_content:
                output = choice.message.reasoning_content
                print(f"[OPENAI] Got output from reasoning_content field")
        
        if output:
            openai_data["status"] = "completed"
            openai_data["output"] = output
            openai_data["citations"] = extract_citations_from_markdown(output, "OpenAI")
            print(f"[OPENAI] OUTPUT length: {len(output)} chars")
            print(f"[OPENAI] Citations extracted: {len(openai_data['citations'])}")
            print(f"[OPENAI] OUTPUT preview: {output[:500]}{'...' if len(output) > 500 else ''}")
        else:
            openai_data["status"] = "failed"
            openai_data["error"] = "No content returned from OpenAI deep research"
            print(f"[OPENAI] WARNING: No content found in response")
        
    except Exception as e:
        print(f"[OPENAI] EXCEPTION: {type(e).__name__}: {str(e)}")
        openai_data["status"] = "failed"
        openai_data["error"] = str(e)
    
    print(f"[OPENAI] === OPENAI NODE END ===\n")
    return {**state, "openai_data": openai_data}


async def perplexity_submit_node(state: MetaResearchState) -> MetaResearchState:
    """Submit research job to Perplexity Sonar Deep Research."""
    query = state["user_query"]
    perplexity_data = state["perplexity_data"].copy()
    
    print(f"\n{'='*60}")
    print(f"[PERPLEXITY] === PERPLEXITY NODE START ===")
    print(f"[PERPLEXITY] INPUT query: {query[:500]}{'...' if len(query) > 500 else ''}")
    print(f"[PERPLEXITY] Model: sonar-deep-research")
    print(f"{'='*60}")
    
    if not PERPLEXITY_API_KEY:
        perplexity_data["status"] = "failed"
        perplexity_data["error"] = "PERPLEXITY_API_KEY not configured"
        print(f"[PERPLEXITY] ERROR: PERPLEXITY_API_KEY not configured")
        print(f"[PERPLEXITY] === PERPLEXITY NODE END ===\n")
        return {**state, "perplexity_data": perplexity_data}
    
    try:
        print(f"[PERPLEXITY] Sending request to Perplexity API...")
        async with httpx.AsyncClient(timeout=600.0) as client:
            response = await client.post(
                "https://api.perplexity.ai/chat/completions",
                headers={
                    "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "sonar-deep-research",
                    "messages": [{
                        "role": "user",
                        "content": query
                    }]
                }
            )
            response.raise_for_status()
            data = response.json()
            
            perplexity_data["status"] = "completed"
            perplexity_data["output"] = data["choices"][0]["message"]["content"]
            perplexity_data["job_id"] = data.get("id", str(uuid.uuid4()))[:8]
            
            # Extract citations from Perplexity API response and markdown
            api_citations = data.get("citations", [])
            perplexity_citations = []
            seen_urls = set()
            for i, url in enumerate(api_citations):
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    perplexity_citations.append({
                        "title": f"Source {i+1}",
                        "url": url,
                        "source_agent": "Perplexity"
                    })
            # Also extract markdown citations
            md_citations = extract_citations_from_markdown(perplexity_data["output"], "Perplexity")
            for c in md_citations:
                if c["url"] not in seen_urls:
                    seen_urls.add(c["url"])
                    perplexity_citations.append(c)
            perplexity_data["citations"] = perplexity_citations
            
            print(f"[PERPLEXITY] Response received, id: {perplexity_data['job_id']}")
            print(f"[PERPLEXITY] OUTPUT length: {len(perplexity_data['output'])} chars")
            print(f"[PERPLEXITY] Citations extracted: {len(perplexity_data['citations'])} (API: {len(api_citations)}, MD: {len(md_citations)})")
            print(f"[PERPLEXITY] OUTPUT preview: {perplexity_data['output'][:500]}{'...' if len(perplexity_data['output']) > 500 else ''}")
            
    except Exception as e:
        perplexity_data["status"] = "failed"
        perplexity_data["error"] = str(e)
        print(f"[PERPLEXITY] EXCEPTION: {type(e).__name__}: {str(e)}")
    
    print(f"[PERPLEXITY] === PERPLEXITY NODE END ===\n")
    return {**state, "perplexity_data": perplexity_data}


async def synthesizer_node(state: MetaResearchState) -> MetaResearchState:
    """Synthesize all research reports using OpenRouter via Replit AI Integrations."""
    print(f"\n{'='*60}")
    print(f"[SYNTHESIZER] === SYNTHESIZER NODE START ===")
    print(f"[SYNTHESIZER] INPUT query: {state['user_query'][:500]}{'...' if len(state['user_query']) > 500 else ''}")
    print(f"{'='*60}")
    
    gemini_output = state["gemini_data"].get("output", "Not available")
    openai_output = state["openai_data"].get("output", "Not available")
    perplexity_output = state["perplexity_data"].get("output", "Not available")
    
    gemini_status = state["gemini_data"].get("status", "unknown")
    openai_status = state["openai_data"].get("status", "unknown")
    perplexity_status = state["perplexity_data"].get("status", "unknown")
    
    print(f"[SYNTHESIZER] INPUT Gemini status: {gemini_status}, output length: {len(gemini_output) if gemini_output else 0}")
    print(f"[SYNTHESIZER] INPUT OpenAI status: {openai_status}, output length: {len(openai_output) if openai_output else 0}")
    print(f"[SYNTHESIZER] INPUT Perplexity status: {perplexity_status}, output length: {len(perplexity_output) if perplexity_output else 0}")
    
    available_reports = []
    if gemini_status == "completed" and gemini_output:
        available_reports.append(f"## Gemini Research Report\n\n{gemini_output}")
    if openai_status == "completed" and openai_output:
        available_reports.append(f"## OpenAI Research Report\n\n{openai_output}")
    if perplexity_status == "completed" and perplexity_output:
        available_reports.append(f"## Perplexity Research Report\n\n{perplexity_output}")
    
    print(f"[SYNTHESIZER] Available reports count: {len(available_reports)}")
    
    if not available_reports:
        print(f"[SYNTHESIZER] ERROR: No reports available for synthesis")
        print(f"[SYNTHESIZER] === SYNTHESIZER NODE END ===\n")
        return {
            **state,
            "consensus_report": "# Research Failed\n\nNo research agents were able to complete their analysis. Please check your API keys and try again.",
            "overall_status": "failed"
        }
    
    combined_reports = "\n\n---\n\n".join(available_reports)
    print(f"[SYNTHESIZER] Combined reports length: {len(combined_reports)} chars")
    
    config = await get_supervisor_config()
    model = config.synthesizer_model if config else "anthropic/claude-sonnet-4.5"
    
    default_synthesizer_prompt = """You are a research synthesis expert. Analyze the following research reports from three different AI research agents and create a comprehensive consensus report.

Original Query: {query}

{combined_reports}

---

Create a well-structured consensus report in Markdown format that:
1. Synthesizes the key findings from all available reports
2. Identifies areas of agreement and any conflicting information
3. Provides a balanced, comprehensive answer to the original query
4. Includes citations where the source reports provided them
5. Highlights the most reliable and well-supported conclusions

Format with clear headers, bullet points, and proper Markdown formatting."""
    
    prompt_template = config.synthesizer_prompt if config and config.synthesizer_prompt else default_synthesizer_prompt
    prompt = prompt_template.replace("{query}", state['user_query']).replace("{combined_reports}", combined_reports)
    
    if not AI_INTEGRATIONS_OPENROUTER_API_KEY or not AI_INTEGRATIONS_OPENROUTER_BASE_URL:
        print(f"[SYNTHESIZER] OpenRouter not configured, using fallback synthesis")
        consensus = f"# Meta-Deep Research Consensus Report\n\n**Query:** {state['user_query']}\n\n---\n\n{combined_reports}"
    else:
        try:
            print(f"[SYNTHESIZER] Model: {model}")
            print(f"[SYNTHESIZER] Sending request to OpenRouter...")
            client = AsyncOpenAI(
                api_key=AI_INTEGRATIONS_OPENROUTER_API_KEY,
                base_url=AI_INTEGRATIONS_OPENROUTER_BASE_URL
            )
            response = await client.chat.completions.create(
                model=model,
                max_tokens=65536,
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )
            consensus = response.choices[0].message.content or "Synthesis failed"
            print(f"[SYNTHESIZER] OUTPUT consensus length: {len(consensus)} chars")
            print(f"[SYNTHESIZER] OUTPUT preview: {consensus[:500]}{'...' if len(consensus) > 500 else ''}")
        except Exception as e:
            print(f"[SYNTHESIZER] EXCEPTION: {type(e).__name__}: {str(e)}")
            consensus = f"# Meta-Deep Research Report\n\n**Query:** {state['user_query']}\n\n*Synthesis error: {str(e)}*\n\n---\n\n{combined_reports}"
    
    # Collect and deduplicate citations from all agents
    all_citations = []
    seen_urls = {}
    for agent_data, agent_name in [
        (state["gemini_data"], "Gemini"),
        (state["openai_data"], "OpenAI"),
        (state["perplexity_data"], "Perplexity")
    ]:
        agent_citations = agent_data.get("citations") or []
        for c in agent_citations:
            url = c.get("url", "")
            if url:
                if url in seen_urls:
                    # Merge source_agents for duplicates
                    existing = seen_urls[url]
                    if agent_name not in existing["source_agent"]:
                        existing["source_agent"] = f"{existing['source_agent']}, {agent_name}"
                else:
                    citation_copy = {
                        "title": c.get("title", "Untitled"),
                        "url": url,
                        "source_agent": agent_name
                    }
                    seen_urls[url] = citation_copy
                    all_citations.append(citation_copy)
    
    print(f"[SYNTHESIZER] Total unique citations: {len(all_citations)}")
    print(f"[SYNTHESIZER] === SYNTHESIZER NODE END ===\n")
    return {
        **state,
        "consensus_report": consensus,
        "overall_status": "completed",
        "citations": all_citations
    }


async def start_research_node(state: MetaResearchState) -> MetaResearchState:
    """Initialize research state after approval."""
    return {
        **state,
        "gemini_data": {"status": "polling", "job_id": None, "output": None, "error": None, "citations": None},
        "openai_data": {"status": "polling", "job_id": None, "output": None, "error": None, "citations": None},
        "perplexity_data": {"status": "polling", "job_id": None, "output": None, "error": None, "citations": None},
        "overall_status": "researching"
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


def build_plan_graph():
    """Build graph for creating research plan (phase 1)."""
    workflow = StateGraph(MetaResearchState)
    workflow.add_node("supervisor", supervisor_node)
    workflow.add_edge(START, "supervisor")
    workflow.add_edge("supervisor", END)
    return workflow


def build_research_graph():
    """Build graph for executing research after approval (phase 2)."""
    workflow = StateGraph(MetaResearchState)
    workflow.add_node("start_research", start_research_node)
    workflow.add_node("parallel_research", parallel_research_node)
    workflow.add_node("synthesizer", synthesizer_node)
    workflow.add_edge(START, "start_research")
    workflow.add_edge("start_research", "parallel_research")
    workflow.add_edge("parallel_research", "synthesizer")
    workflow.add_edge("synthesizer", END)
    return workflow


checkpointer = None
plan_graph = None
research_graph = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global checkpointer, plan_graph, research_graph
    
    await init_db()
    
    async with async_session() as db:
        await create_initial_admin(db)
        
        result = await db.execute(select(SupervisorConfig).where(SupervisorConfig.id == "default"))
        if not result.scalar_one_or_none():
            default_config = SupervisorConfig(id="default")
            db.add(default_config)
            await db.commit()
            print("Created default supervisor config")
    
    async with AsyncSqliteSaver.from_conn_string("replit_state.db") as saver:
        checkpointer = saver
        await saver.setup()
        
        plan_workflow = build_plan_graph()
        plan_graph = plan_workflow.compile(checkpointer=saver)
        
        research_workflow = build_research_graph()
        research_graph = research_workflow.compile(checkpointer=saver)
        
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


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    first_name: Optional[str]
    last_name: Optional[str]


class ConfigResponse(BaseModel):
    supervisor_model: str
    supervisor_prompt: str
    synthesizer_model: str
    synthesizer_prompt: str


class ConfigUpdateRequest(BaseModel):
    supervisor_model: Optional[str] = None
    supervisor_prompt: Optional[str] = None
    synthesizer_model: Optional[str] = None
    synthesizer_prompt: Optional[str] = None


@app.post("/api/auth/register")
async def register(request: RegisterRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """Register a new user account."""
    result = await db.execute(select(User).where(User.email == request.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(
        id=str(uuid.uuid4()),
        email=request.email,
        password_hash=hash_password(request.password),
        first_name=request.first_name,
        last_name=request.last_name
    )
    db.add(user)
    await db.commit()
    
    session_id = await create_session(db, user.id)
    set_session_cookie(response, session_id)
    
    return {
        "message": "Registration successful",
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role.value,
            "first_name": user.first_name,
            "last_name": user.last_name
        }
    }


@app.post("/api/auth/login")
async def login(request: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """Log in with email and password."""
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    session_id = await create_session(db, user.id)
    set_session_cookie(response, session_id)
    
    return {
        "message": "Login successful",
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role.value,
            "first_name": user.first_name,
            "last_name": user.last_name
        }
    }


@app.post("/api/auth/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Log out the current user."""
    signed_session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if signed_session_id:
        session_id = unsign_session_id(signed_session_id)
        if session_id:
            await delete_session(db, session_id)
    
    clear_session_cookie(response)
    return {"message": "Logged out successfully"}


@app.get("/api/auth/me")
async def get_me(user: User = Depends(get_current_user_optional)):
    """Get the current authenticated user."""
    if not user:
        return {"authenticated": False, "user": None}
    
    return {
        "authenticated": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role.value,
            "first_name": user.first_name,
            "last_name": user.last_name
        }
    }


@app.get("/api/admin/config")
async def get_admin_config(user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    """Get the current supervisor configuration (admin only)."""
    result = await db.execute(select(SupervisorConfig).where(SupervisorConfig.id == "default"))
    config = result.scalar_one_or_none()
    
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    return {
        "supervisor_model": config.supervisor_model,
        "supervisor_prompt": config.supervisor_prompt,
        "synthesizer_model": config.synthesizer_model,
        "synthesizer_prompt": config.synthesizer_prompt or ""
    }


@app.patch("/api/admin/config")
async def update_admin_config(
    request: ConfigUpdateRequest,
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update the supervisor configuration (admin only)."""
    result = await db.execute(select(SupervisorConfig).where(SupervisorConfig.id == "default"))
    config = result.scalar_one_or_none()
    
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    if request.supervisor_model is not None:
        config.supervisor_model = request.supervisor_model
    if request.supervisor_prompt is not None:
        config.supervisor_prompt = request.supervisor_prompt
    if request.synthesizer_model is not None:
        config.synthesizer_model = request.synthesizer_model
    if request.synthesizer_prompt is not None:
        config.synthesizer_prompt = request.synthesizer_prompt
    
    config.updated_by = user.id
    await db.commit()
    
    return {
        "message": "Configuration updated",
        "supervisor_model": config.supervisor_model,
        "supervisor_prompt": config.supervisor_prompt,
        "synthesizer_model": config.synthesizer_model,
        "synthesizer_prompt": config.synthesizer_prompt or ""
    }


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
            "POST /api/research": "Create a research plan (requires approval)",
            "POST /api/research/immediate": "Start research immediately without planning",
            "POST /api/research/{run_id}/approve": "Approve plan and start research",
            "GET /api/status/{run_id}": "Get research job status",
            "POST /api/auth/register": "Register a new user",
            "POST /api/auth/login": "Log in",
            "POST /api/auth/logout": "Log out",
            "GET /api/auth/me": "Get current user",
            "GET /api/admin/config": "Get admin config (admin only)",
            "PATCH /api/admin/config": "Update admin config (admin only)"
        }
    }


class PlanResponse(BaseModel):
    run_id: str
    status: str
    research_plan: str
    message: str


@app.post("/api/research")
async def create_research_plan(request: ResearchRequest, user: User = Depends(get_current_user)):
    """Create a research plan that requires user approval before starting."""
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
        "overall_status": "creating_plan"
    }
    
    config = {"configurable": {"thread_id": run_id}}
    
    try:
        result = None
        async for event in plan_graph.astream(initial_state, config, stream_mode="values"):
            result = event
        
        plan = result.get("research_plan", "Plan generation failed") if result else "Plan generation failed"
        
        return {
            "run_id": run_id,
            "status": "pending_approval",
            "research_plan": plan,
            "message": "Research plan created. Approve to start research."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create research plan: {str(e)}")


@app.post("/api/research/immediate")
async def start_research_immediately(request: ResearchRequest, user: User = Depends(get_current_user)):
    """Start research immediately without creating a plan first."""
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    
    run_id = str(uuid.uuid4())
    
    initial_state: MetaResearchState = {
        "user_query": request.query,
        "research_plan": f"Direct research query: {request.query}",
        "gemini_data": {"status": "polling", "job_id": None, "output": None, "error": None},
        "openai_data": {"status": "polling", "job_id": None, "output": None, "error": None},
        "perplexity_data": {"status": "polling", "job_id": None, "output": None, "error": None},
        "consensus_report": None,
        "overall_status": "researching"
    }
    
    config = {"configurable": {"thread_id": run_id}}
    
    try:
        await research_graph.aupdate_state(config, initial_state)
        
        asyncio.create_task(run_research(run_id, user.id, initial_state, config))
        
        return {
            "run_id": run_id,
            "status": "started",
            "message": "Research started immediately. Poll /api/status/{run_id} for updates."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start research: {str(e)}")


@app.post("/api/research/{run_id}/approve")
async def approve_research(run_id: str, user: User = Depends(get_current_user)):
    """Approve the research plan and start the actual research."""
    config = {"configurable": {"thread_id": run_id}}
    
    try:
        state = await plan_graph.aget_state(config)
        
        if not state.values:
            raise HTTPException(status_code=404, detail="Research job not found")
        
        if state.values.get("overall_status") != "pending_approval":
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot approve research in status: {state.values.get('overall_status')}"
            )
        
        current_state = dict(state.values)
        
        approved_state = {**current_state, "overall_status": "approved"}
        await plan_graph.aupdate_state(config, approved_state)
        
        asyncio.create_task(run_research(run_id, user.id, current_state, config))
        
        return {
            "run_id": run_id,
            "status": "started",
            "message": "Research approved and started. Poll /api/status/{run_id} for updates."
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to approve research: {str(e)}")


async def save_research_history(run_id: str, user_id: str, state: dict):
    """Save completed research to history database."""
    try:
        async with async_session() as db:
            existing = await db.execute(
                select(ResearchHistory).where(ResearchHistory.run_id == run_id)
            )
            history = existing.scalar_one_or_none()
            
            gemini_data = state.get("gemini_data", {})
            openai_data = state.get("openai_data", {})
            perplexity_data = state.get("perplexity_data", {})
            
            if history:
                history.research_plan = state.get("research_plan")
                history.gemini_output = gemini_data.get("output")
                history.openai_output = openai_data.get("output")
                history.perplexity_output = perplexity_data.get("output")
                history.consensus_report = state.get("consensus_report")
                history.overall_status = state.get("overall_status", "unknown")
                history.completed_at = datetime.now(timezone.utc)
            else:
                history = ResearchHistory(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    run_id=run_id,
                    query=state.get("user_query", ""),
                    research_plan=state.get("research_plan"),
                    gemini_output=gemini_data.get("output"),
                    openai_output=openai_data.get("output"),
                    perplexity_output=perplexity_data.get("output"),
                    consensus_report=state.get("consensus_report"),
                    overall_status=state.get("overall_status", "unknown"),
                    completed_at=datetime.now(timezone.utc)
                )
                db.add(history)
            
            await db.commit()
    except Exception as e:
        print(f"Error saving research history for {run_id}: {e}")


async def run_research(run_id: str, user_id: str, current_state: dict, config: dict):
    """Run the research graph asynchronously."""
    final_state = current_state
    try:
        async for event in research_graph.astream(current_state, config, stream_mode="values"):
            final_state = event
    except Exception as e:
        print(f"Research error for {run_id}: {e}")
        final_state["overall_status"] = "failed"
    
    await save_research_history(run_id, user_id, final_state)


@app.get("/api/status/{run_id}")
async def get_status(run_id: str, user: User = Depends(get_current_user)):
    """Get the current status of a research job."""
    config = {"configurable": {"thread_id": run_id}}
    
    try:
        research_state = await research_graph.aget_state(config)
        if research_state.values:
            return {
                "run_id": run_id,
                "user_query": research_state.values.get("user_query", ""),
                "research_plan": research_state.values.get("research_plan"),
                "gemini_data": research_state.values.get("gemini_data", create_default_subagent_state()),
                "openai_data": research_state.values.get("openai_data", create_default_subagent_state()),
                "perplexity_data": research_state.values.get("perplexity_data", create_default_subagent_state()),
                "consensus_report": research_state.values.get("consensus_report"),
                "overall_status": research_state.values.get("overall_status", "unknown"),
                "citations": research_state.values.get("citations", [])
            }
        
        plan_state = await plan_graph.aget_state(config)
        if plan_state.values:
            return {
                "run_id": run_id,
                "user_query": plan_state.values.get("user_query", ""),
                "research_plan": plan_state.values.get("research_plan"),
                "gemini_data": plan_state.values.get("gemini_data", create_default_subagent_state()),
                "openai_data": plan_state.values.get("openai_data", create_default_subagent_state()),
                "perplexity_data": plan_state.values.get("perplexity_data", create_default_subagent_state()),
                "consensus_report": plan_state.values.get("consensus_report"),
                "overall_status": plan_state.values.get("overall_status", "unknown"),
                "citations": plan_state.values.get("citations", [])
            }
        
        raise HTTPException(status_code=404, detail="Research job not found")
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching status: {str(e)}")


@app.get("/api/research/history")
async def get_research_history(
    user: User = Depends(get_current_user),
    limit: int = 20,
    offset: int = 0
):
    """Get the user's research history, sorted by most recent first."""
    async with async_session() as db:
        result = await db.execute(
            select(ResearchHistory)
            .where(ResearchHistory.user_id == user.id)
            .order_by(ResearchHistory.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        history_items = result.scalars().all()
        
        return {
            "items": [
                {
                    "id": item.id,
                    "run_id": item.run_id,
                    "query": item.query,
                    "overall_status": item.overall_status,
                    "created_at": item.created_at.isoformat() if item.created_at else None,
                    "completed_at": item.completed_at.isoformat() if item.completed_at else None
                }
                for item in history_items
            ],
            "limit": limit,
            "offset": offset
        }


@app.get("/api/research/history/{history_id}")
async def get_research_history_detail(
    history_id: str,
    user: User = Depends(get_current_user)
):
    """Get the full details of a specific research history item."""
    async with async_session() as db:
        result = await db.execute(
            select(ResearchHistory)
            .where(ResearchHistory.id == history_id)
            .where(ResearchHistory.user_id == user.id)
        )
        item = result.scalar_one_or_none()
        
        if not item:
            raise HTTPException(status_code=404, detail="Research history not found")
        
        return {
            "id": item.id,
            "run_id": item.run_id,
            "query": item.query,
            "research_plan": item.research_plan,
            "gemini_output": item.gemini_output,
            "openai_output": item.openai_output,
            "perplexity_output": item.perplexity_output,
            "consensus_report": item.consensus_report,
            "overall_status": item.overall_status,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "completed_at": item.completed_at.isoformat() if item.completed_at else None
        }


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
