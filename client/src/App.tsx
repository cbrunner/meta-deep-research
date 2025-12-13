import { useState, useEffect, useCallback } from 'react'
import { Search, Loader2, CheckCircle, XCircle, Brain, Sparkles, Globe, Cpu, PlayCircle, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import axios from 'axios'

interface SubAgentState {
  status: string
  job_id: string | null
  output: string | null
  error: string | null
}

interface ResearchStatus {
  run_id: string
  user_query: string
  research_plan: string | null
  gemini_data: SubAgentState
  openai_data: SubAgentState
  perplexity_data: SubAgentState
  consensus_report: string | null
  overall_status: string
}

interface PlanResponse {
  run_id: string
  status: string
  research_plan: string
  message: string
}

function AgentCard({ 
  name, 
  icon: Icon, 
  data, 
  color 
}: { 
  name: string
  icon: React.ComponentType<{ className?: string }>
  data: SubAgentState
  color: string
}) {
  const [showRaw, setShowRaw] = useState(false)
  
  const getStatusStyles = () => {
    switch (data.status) {
      case 'idle':
        return 'opacity-50 border-gray-600'
      case 'polling':
        return `border-${color}-500 animate-pulse`
      case 'completed':
        return `border-green-500 bg-green-500/10`
      case 'failed':
        return 'border-red-500 bg-red-500/10'
      default:
        return 'border-gray-600'
    }
  }
  
  const getStatusIcon = () => {
    switch (data.status) {
      case 'idle':
        return <Icon className="w-6 h-6 text-gray-400" />
      case 'polling':
        return <Loader2 className={`w-6 h-6 text-${color}-500 animate-spin`} />
      case 'completed':
        return <CheckCircle className="w-6 h-6 text-green-500" />
      case 'failed':
        return <XCircle className="w-6 h-6 text-red-500" />
      default:
        return <Icon className="w-6 h-6 text-gray-400" />
    }
  }
  
  const getStatusText = () => {
    switch (data.status) {
      case 'idle':
        return 'Waiting for assignment'
      case 'polling':
        return 'Agent Working...'
      case 'completed':
        return 'Report Ready'
      case 'failed':
        return 'Failed'
      default:
        return 'Unknown'
    }
  }

  return (
    <div className={`rounded-xl border-2 p-4 transition-all duration-300 ${getStatusStyles()}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <h3 className="font-semibold text-lg">{name}</h3>
        </div>
        <span className={`text-sm px-2 py-1 rounded-full ${
          data.status === 'completed' ? 'bg-green-500/20 text-green-400' :
          data.status === 'failed' ? 'bg-red-500/20 text-red-400' :
          data.status === 'polling' ? `bg-${color}-500/20 text-${color}-400` :
          'bg-gray-700 text-gray-400'
        }`}>
          {getStatusText()}
        </span>
      </div>
      
      {data.job_id && (
        <p className="text-xs text-gray-500 mb-2">Job ID: {data.job_id}</p>
      )}
      
      {data.error && (
        <p className="text-sm text-red-400 mt-2">{data.error}</p>
      )}
      
      {data.status === 'completed' && data.output && (
        <div className="mt-3">
          <button 
            onClick={() => setShowRaw(!showRaw)}
            className="text-sm text-blue-400 hover:text-blue-300 underline"
          >
            {showRaw ? 'Hide Raw Data' : 'Show Raw Data'}
          </button>
          {showRaw && (
            <div className="mt-2 p-3 bg-gray-800 rounded-lg text-sm text-gray-300 max-h-64 overflow-y-auto">
              <pre className="whitespace-pre-wrap">{data.output}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function App() {
  const [query, setQuery] = useState('')
  const [runId, setRunId] = useState<string | null>(null)
  const [status, setStatus] = useState<ResearchStatus | null>(null)
  const [pendingPlan, setPendingPlan] = useState<PlanResponse | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [isCreatingPlan, setIsCreatingPlan] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    const savedRunId = localStorage.getItem('meta_research_run_id')
    const savedPlan = localStorage.getItem('meta_research_pending_plan')
    if (savedPlan) {
      const plan = JSON.parse(savedPlan) as PlanResponse
      setPendingPlan(plan)
      setRunId(plan.run_id)
    } else if (savedRunId) {
      setRunId(savedRunId)
      setIsPolling(true)
    }
  }, [])
  
  const pollStatus = useCallback(async (id: string) => {
    try {
      const response = await axios.get<ResearchStatus>(`/api/status/${id}`)
      setStatus(response.data)
      setError(null)
      
      if (response.data.overall_status === 'completed' || response.data.overall_status === 'failed') {
        setIsPolling(false)
        localStorage.removeItem('meta_research_run_id')
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        localStorage.removeItem('meta_research_run_id')
        setRunId(null)
        setIsPolling(false)
      }
    }
  }, [])
  
  useEffect(() => {
    if (!isPolling || !runId) return
    
    pollStatus(runId)
    
    const interval = setInterval(() => {
      pollStatus(runId)
    }, 3000)
    
    return () => clearInterval(interval)
  }, [isPolling, runId, pollStatus])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    
    setError(null)
    setStatus(null)
    setIsCreatingPlan(true)
    
    try {
      const response = await axios.post<PlanResponse>('/api/research', { query })
      setPendingPlan(response.data)
      setRunId(response.data.run_id)
      localStorage.setItem('meta_research_pending_plan', JSON.stringify(response.data))
    } catch (err) {
      setError('Failed to create research plan. Please try again.')
    } finally {
      setIsCreatingPlan(false)
    }
  }
  
  const handleApprove = async () => {
    if (!pendingPlan) return
    
    setIsApproving(true)
    setError(null)
    
    try {
      await axios.post(`/api/research/${pendingPlan.run_id}/approve`)
      localStorage.removeItem('meta_research_pending_plan')
      localStorage.setItem('meta_research_run_id', pendingPlan.run_id)
      setPendingPlan(null)
      setIsPolling(true)
    } catch (err) {
      setError('Failed to approve research. Please try again.')
    } finally {
      setIsApproving(false)
    }
  }
  
  const handleCancel = () => {
    setPendingPlan(null)
    setRunId(null)
    localStorage.removeItem('meta_research_pending_plan')
  }
  
  const handleReset = () => {
    setQuery('')
    setRunId(null)
    setStatus(null)
    setPendingPlan(null)
    setIsPolling(false)
    setError(null)
    localStorage.removeItem('meta_research_run_id')
    localStorage.removeItem('meta_research_pending_plan')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <header className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Brain className="w-12 h-12 text-purple-500" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">
              Meta-Deep Research
            </h1>
          </div>
          <p className="text-gray-400 text-lg">
            Orchestrating AI research across Gemini, OpenAI, and Perplexity
          </p>
        </header>
        
        {!runId && !pendingPlan && (
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto mb-12">
            <div className="relative mb-4">
              <Search className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter your research query... Be as detailed as possible for better results."
                rows={4}
                disabled={isCreatingPlan}
                className="w-full pl-12 pr-4 py-4 bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg resize-none disabled:opacity-50"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!query.trim() || isCreatingPlan}
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {isCreatingPlan ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating Plan...
                  </>
                ) : (
                  'Create Research Plan'
                )}
              </button>
            </div>
          </form>
        )}
        
        {pendingPlan && !isPolling && (
          <div className="max-w-3xl mx-auto mb-12">
            <div className="p-6 bg-gray-800/50 border-2 border-purple-500/50 rounded-xl">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl font-semibold text-purple-400">Research Plan Ready for Approval</h2>
              </div>
              <div className="mb-6 p-4 bg-gray-900/50 rounded-lg">
                <p className="text-gray-300 whitespace-pre-wrap">{pendingPlan.research_plan}</p>
              </div>
              <div className="flex items-center justify-end gap-4">
                <button
                  onClick={handleCancel}
                  disabled={isApproving}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                  Cancel
                </button>
                <button
                  onClick={handleApprove}
                  disabled={isApproving}
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl font-semibold transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isApproving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-5 h-5" />
                      Approve & Start Research
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {error && (
          <div className="max-w-2xl mx-auto mb-8 p-4 bg-red-500/20 border border-red-500 rounded-xl text-red-400">
            {error}
          </div>
        )}
        
        {status && (
          <>
            {status.research_plan && (
              <div className="mb-8 p-6 bg-gray-800/50 border border-purple-500/30 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <h2 className="font-semibold text-purple-400">Supervisor's Plan</h2>
                </div>
                <p className="text-gray-300">{status.research_plan}</p>
              </div>
            )}
            
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <AgentCard 
                name="Gemini" 
                icon={Sparkles}
                data={status.gemini_data} 
                color="blue"
              />
              <AgentCard 
                name="o3 Deep Research" 
                icon={Cpu}
                data={status.openai_data} 
                color="green"
              />
              <AgentCard 
                name="Perplexity Deep Research" 
                icon={Globe}
                data={status.perplexity_data} 
                color="orange"
              />
            </div>
            
            {status.overall_status === 'researching' && (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-500" />
                <p className="text-gray-400">Research in progress... Polling for updates every 3 seconds</p>
              </div>
            )}
            
            {status.consensus_report && (
              <div className="mt-8 p-8 bg-gray-800/70 border border-gray-700 rounded-xl">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                    Consensus Report
                  </h2>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                  >
                    New Research
                  </button>
                </div>
                <div className="prose prose-invert prose-lg max-w-none">
                  <ReactMarkdown>{status.consensus_report}</ReactMarkdown>
                </div>
              </div>
            )}
            
            {status.overall_status === 'failed' && !status.consensus_report && (
              <div className="text-center py-8">
                <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <p className="text-red-400 text-lg mb-4">Research failed. Please check your API keys and try again.</p>
                <button
                  onClick={handleReset}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}
          </>
        )}
        
        {!runId && !status && !pendingPlan && (
          <div className="text-center py-12">
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="p-6 bg-gray-800/30 rounded-xl border border-gray-700">
                <Sparkles className="w-10 h-10 text-blue-400 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Gemini Deep Research</h3>
                <p className="text-gray-400 text-sm">Google's advanced reasoning capabilities</p>
              </div>
              <div className="p-6 bg-gray-800/30 rounded-xl border border-gray-700">
                <Cpu className="w-10 h-10 text-green-400 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">o3 Deep Research</h3>
                <p className="text-gray-400 text-sm">OpenAI's comprehensive deep research</p>
              </div>
              <div className="p-6 bg-gray-800/30 rounded-xl border border-gray-700">
                <Globe className="w-10 h-10 text-orange-400 mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Perplexity Deep Research</h3>
                <p className="text-gray-400 text-sm">Real-time web research with citations</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
