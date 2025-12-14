import os
import ssl
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, String, DateTime, Enum, Text, ForeignKey, Boolean, Integer
from sqlalchemy.sql import func
import enum

def prepare_database_url(url: str) -> tuple[str, dict]:
    """Prepare DATABASE_URL for asyncpg by removing sslmode and returning connect_args."""
    if not url:
        return "", {}
    
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    parsed = urlparse(url)
    query_params = parse_qs(parsed.query)
    
    connect_args = {}
    sslmode = query_params.pop("sslmode", [None])[0]
    if sslmode and sslmode != "disable":
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        connect_args["ssl"] = ssl_context
    
    new_query = urlencode({k: v[0] for k, v in query_params.items()})
    clean_url = urlunparse((
        parsed.scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        new_query,
        parsed.fragment
    ))
    
    return clean_url, connect_args

DATABASE_URL, CONNECT_ARGS = prepare_database_url(os.environ.get("DATABASE_URL", ""))

if DATABASE_URL:
    engine = create_async_engine(DATABASE_URL, echo=False, connect_args=CONNECT_ARGS)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
else:
    engine = None
    async_session = None


class Base(DeclarativeBase):
    pass


class UserRole(enum.Enum):
    user = "user"
    admin = "admin"


class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.user, nullable=False)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Session(Base):
    __tablename__ = "sessions"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class SupervisorConfig(Base):
    __tablename__ = "supervisor_config"
    
    id = Column(String, primary_key=True, default="default")
    supervisor_model = Column(String, default="anthropic/claude-sonnet-4.5")
    supervisor_prompt = Column(Text, default="""You are a research supervisor. Create a brief research plan for this query:

Query: {query}

Output a concise 2-3 sentence plan explaining how three parallel deep research agents (Gemini, OpenAI, Perplexity) should approach this query.""")
    synthesizer_model = Column(String, default="anthropic/claude-sonnet-4.5")
    synthesizer_prompt = Column(Text, default="""You are an expert Executive Intelligence Analyst producing a polished consensus report from three independent research agents.

<original_query>
{query}
</original_query>

<research_reports>
{combined_reports}
</research_reports>

## YOUR TASK

Synthesize the three agent reports into a single, authoritative briefing. Merge overlapping findings into a coherent narrative — do not summarize each agent separately.

## REPORT STRUCTURE

# [Descriptive Title Summarizing the Topic]

**Date:** [Current Date]  
**Subject:** {query}  
**Sources:** Synthesis of 3 independent research agents

---

## Executive Summary

2-3 paragraph overview of key findings and conclusions.

> **Key Insight:** Use blockquotes like this to highlight the single most important takeaway. These render as styled callout boxes.

---

## Key Findings

Organize findings thematically using ### H3 subsections.

> Important discoveries or critical data points should be wrapped in blockquotes to make them stand out visually.

Use tables when comparing data points:

| Metric | Value | Source |
|--------|-------|--------|
| Example | $500M | Agent 1 |

---

## Analysis

Deeper exploration of implications, trends, or strategic considerations. Include:
- Market dynamics
- Competitive landscape  
- Risk factors

When including code, data, or technical content, always specify the language:

```json
{
  "example": "data structure"
}
```

---

## Conclusion

Actionable takeaways or recommendations.

> **Bottom Line:** End with a blockquote summarizing the core recommendation or conclusion.

---

## Sources

List all unique citations from the agent reports. Deduplicate and format consistently:
- [Title](URL) — Brief description

## FORMATTING RULES

- Start directly with the H1 title. No preamble or introductory text.
- Use `##` for main sections, `###` for subsections. Never fake headers with bold text.
- Insert `---` horizontal rules before each ## section for clear visual separation.
- **Blockquotes for emphasis:** Wrap key insights, critical findings, or important callouts in `>` blockquote syntax. These render as styled callout boxes.
- **Bold key figures:** **$500M**, **Q3 2025**, **47%**.
- **Tables for comparisons:** Always use markdown tables when comparing metrics, prices, dates, specs, or any structured data. Include headers.
- **Code blocks with languages:** When including code, JSON, or structured data, always specify the language (```python, ```json, ```sql, etc.) for syntax highlighting.
- **Bullet points:** Use sparingly for lists. Prefer prose for narrative content.
- Write in a confident, analytical tone — not conversational.

## HANDLING CONFLICTS

When agents disagree:
1. Note the discrepancy briefly
2. Present the most credible or well-sourced position
3. If unresolvable, present both with appropriate hedging ("estimates range from X to Y")

Generate the report now.""")
    show_live_agent_feeds = Column(Boolean, default=True, nullable=False, server_default='true')
    agent_timeout_minutes = Column(Integer, default=120, nullable=False, server_default='120')
    updated_by = Column(String, ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ResearchHistory(Base):
    __tablename__ = "research_history"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    run_id = Column(String, unique=True, nullable=False, index=True)
    query = Column(Text, nullable=False)
    research_plan = Column(Text, nullable=True)
    gemini_output = Column(Text, nullable=True)
    openai_output = Column(Text, nullable=True)
    perplexity_output = Column(Text, nullable=True)
    consensus_report = Column(Text, nullable=True)
    overall_status = Column(String, nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    async with async_session() as session:
        yield session
