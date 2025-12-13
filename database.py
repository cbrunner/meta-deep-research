import os
import ssl
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import Column, String, DateTime, Enum, Text, ForeignKey
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
    synthesizer_prompt = Column(Text, default="""You are a research synthesis expert. Analyze the following research reports from three different AI research agents and create a comprehensive consensus report.

Original Query: {query}

{combined_reports}

---

Create a well-structured consensus report in Markdown format that:
1. Synthesizes the key findings from all available reports
2. Identifies areas of agreement and any conflicting information
3. Provides a balanced, comprehensive answer to the original query
4. Includes citations where the source reports provided them
5. Highlights the most reliable and well-supported conclusions

Format with clear headers, bullet points, and proper Markdown formatting.""")
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
