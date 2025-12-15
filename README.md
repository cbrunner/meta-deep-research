# **Meta-Deep Research**

**Meta-Deep Research** is a LangGraph-based background worker designed to orchestrate parallel deep research across multiple LLM providers. It automates the research lifecycle by generating a comprehensive plan and dispatching it simultaneously to **Google Gemini**, **OpenAI**, and **Perplexity** APIs, managing state persistence and async polling throughout the process.

## **Overview**

This application provides a unified research orchestration system that:

1. **Orchestrates**: Takes a user query and creates a research plan using a configurable Supervisor model.  
2. **Parallels**: Dispatches the query to three deep research agents simultaneously:  
   * **Gemini Deep Research** (deep-research-pro-preview-12-2025)  
   * **OpenAI o3 Deep Research** (openai/o3-deep-research)  
   * **Perplexity Deep Research** (sonar-deep-research)  
3. **Synthesizes**: Merges results into a consensus report, collecting and deduplicating citations into a unified bibliography.  
4. **Visualizes**: Offers a "consulting-firm quality" frontend with live agent feeds, syntax highlighting, and PDF export.

## **Architecture**

### **Backend**

* **Framework**: FastAPI with LangGraph StateGraph.  
* **Database**: PostgreSQL for user/session management.  
* **Persistence**: AsyncSqliteSaver for LangGraph state.  
* **Authentication**: Session-based with signed cookies.

### **Frontend**

* **Core**: React with TypeScript and Vite.  
* **Styling**: Tailwind CSS with Typography plugin.  
* **Rendering**: Enhanced Markdown rendering (react-markdown) with Prism syntax highlighting (oneDark).

## **Key Features**

* **Live Agent Streaming**: View real-time updates from each agent:  
  * *Gemini*: Research plan checklists.  
  * *OpenAI*: Terminal-style reasoning logs.  
  * *Perplexity*: Source discovery cards with favicons.  
* **Thinking Token Filtering**: Automatically strips internal reasoning tags (\<think\>, \<thinking\>) from agent outputs to prevent pollution of the final report.  
* **Dual Research Flows**:  
  * *Two-Phase*: Plan creation → User Approval → Research.  
  * *Immediate*: Start research immediately without manual plan review.  
* **Admin Control**: Configure Supervisor/Synthesizer models, manage prompt templates, and view/cancel active jobs.

## **Installation & Setup**

### **Prerequisites**

Ensure you have the following environment variables set:

DATABASE\_URL="postgresql://..."  
SESSION\_SECRET="your\_secret\_key"  
GEMINI\_API\_KEY="your\_google\_key"  
PERPLEXITY\_API\_KEY="your\_perplexity\_key"

To enable the initial Admin user, also set:

INITIAL\_ADMIN\_EMAIL="admin@example.com"  
INITIAL\_ADMIN\_PASSWORD="secure\_password"

### **Running the Application**

1. **Install Python Dependencies**:  
   Bash  
   pip install \-r requirements.txt

2. **Build the Frontend**:  
   Bash  
   cd client  
   npm install  
   npm run build  
   cd ..

3. Start the Server:  
   The application uses Uvicorn on port 5000\.  
   Bash  
   python main.py

## ** Project Structure**

Plaintext

├── main.py                 \# FastAPI server \+ LangGraph definition  
├── database.py             \# SQLAlchemy models (User, Session, Config)  
├── auth.py                 \# Authentication utilities  
├── client/  
│   ├── src/  
│   │   ├── components/    \# UI Components (ReportRenderer, CitationList, etc.)  
│   │   ├── App.tsx        \# Main React Entry  
│   │   └── index.css      \# Tailwind \+ Print styles  
│   └── dist/              \# Compiled frontend assets  
└── replit\_state.db        \# SQLite persistence for LangGraph

## ** Authentication & Roles**

* **User**: Can create research plans, approve jobs, and view history.  
* **Admin**: Access to /api/admin endpoints to configure models, prompts, and manage global job queues.

## ** License**

This project is configured for internal research orchestration. See LICENSE for details.
