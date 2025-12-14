import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Loader2, CheckCircle, XCircle, Brain, Sparkles, Globe, Cpu, PlayCircle, X, LogIn, LogOut, Settings, User, Users, Save, History, Clock, ChevronLeft, FileText, ExternalLink, Check, Circle, AlertTriangle, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import axios from 'axios'
import html2pdf from 'html2pdf.js'
import { ReportContainer } from './components/ReportContainer'

axios.defaults.withCredentials = true

interface LiveUpdate {
  agent: string
  type: string
  data: Record<string, unknown>
  timestamp: string
}

interface PlanStep {
  step: string
  message: string
  completed: boolean
}

interface SourceUpdate {
  url: string
  title: string
}

function LiveResearchPlan({ updates }: { updates: LiveUpdate[] }) {
  const [steps, setSteps] = useState<PlanStep[]>([])
  const [latestProgress, setLatestProgress] = useState<string | null>(null)
  
  useEffect(() => {
    const newSteps: PlanStep[] = []
    let progress: string | null = null
    
    updates.forEach(update => {
      if (update.type === 'plan_step') {
        const data = update.data as { step?: string; message?: string; completed?: boolean }
        const existingIdx = newSteps.findIndex(s => s.step === data.step)
        if (existingIdx >= 0) {
          newSteps[existingIdx] = { 
            step: data.step || '', 
            message: data.message || '', 
            completed: data.completed || false 
          }
        } else {
          newSteps.push({ 
            step: data.step || '', 
            message: data.message || '', 
            completed: data.completed || false 
          })
        }
      } else if (update.type === 'progress') {
        const data = update.data as { status?: string }
        progress = data.status || null
      }
    })
    
    setSteps(newSteps)
    setLatestProgress(progress)
  }, [updates])
  
  if (steps.length === 0 && !latestProgress) {
    return (
      <div className="text-xs text-gray-500 italic">Waiting for research plan...</div>
    )
  }
  
  return (
    <div className="mt-3 space-y-2">
      {latestProgress && (
        <div className="text-xs text-blue-400 mb-2 animate-pulse">{latestProgress}</div>
      )}
      {steps.map((step, idx) => (
        <div key={idx} className="flex items-start gap-2 text-xs">
          {step.completed ? (
            <Check className="w-3 h-3 text-green-400 mt-0.5 shrink-0" />
          ) : (
            <Circle className="w-3 h-3 text-gray-500 mt-0.5 shrink-0" />
          )}
          <span className={step.completed ? 'text-gray-400 line-through' : 'text-gray-300'}>
            {step.message || step.step}
          </span>
        </div>
      ))}
    </div>
  )
}

function ReasoningLog({ updates }: { updates: LiveUpdate[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [messages, setMessages] = useState<string[]>([])
  
  useEffect(() => {
    const newMessages: string[] = []
    updates.forEach(update => {
      if (update.type === 'reasoning') {
        const data = update.data as { message?: string }
        if (data.message) newMessages.push(data.message)
      }
    })
    setMessages(newMessages)
  }, [updates])
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])
  
  if (messages.length === 0) {
    return (
      <div className="text-xs text-gray-500 italic">Waiting for reasoning output...</div>
    )
  }
  
  return (
    <div 
      ref={scrollRef}
      className="mt-3 p-2 bg-gray-900 rounded-lg max-h-32 overflow-y-auto font-mono text-xs text-green-400"
    >
      {messages.map((msg, idx) => (
        <div key={idx} className="mb-1 break-words">
          <span className="text-green-600">&gt;</span> {msg}
        </div>
      ))}
    </div>
  )
}

function LiveSources({ updates }: { updates: LiveUpdate[] }) {
  const [sources, setSources] = useState<SourceUpdate[]>([])
  
  useEffect(() => {
    const newSources: SourceUpdate[] = []
    updates.forEach(update => {
      if (update.type === 'source') {
        const data = update.data as { url?: string; title?: string }
        if (data.url && !newSources.find(s => s.url === data.url)) {
          newSources.push({ url: data.url, title: data.title || data.url })
        }
      }
    })
    setSources(newSources)
  }, [updates])
  
  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }
  
  if (sources.length === 0) {
    return (
      <div className="text-xs text-gray-500 italic">Discovering sources...</div>
    )
  }
  
  return (
    <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
      {sources.map((source, idx) => (
        <a
          key={idx}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-gray-300 hover:text-orange-400 transition-colors"
        >
          <img 
            src={`https://www.google.com/s2/favicons?domain=${getDomain(source.url)}&sz=16`} 
            alt="" 
            className="w-3 h-3"
          />
          <span className="truncate flex-1">{source.title}</span>
          <ExternalLink className="w-3 h-3 shrink-0 opacity-50" />
        </a>
      ))}
    </div>
  )
}

interface Citation {
  title: string
  url: string
  source_agent: string
}

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
  citations?: Citation[]
}

interface PlanResponse {
  run_id: string
  status: string
  research_plan: string
  message: string
}

interface UserData {
  id: string
  email: string
  role: string
  first_name: string | null
  last_name: string | null
}

interface AdminConfig {
  supervisor_model: string
  supervisor_prompt: string
  synthesizer_model: string
  synthesizer_prompt: string
  show_live_agent_feeds: boolean
  agent_timeout_minutes: number
}

interface HistoryItem {
  id: string
  run_id: string
  query: string
  overall_status: string
  created_at: string | null
  completed_at: string | null
}

interface ActiveJob {
  run_id: string
  user_id: string
  user_email: string
  query: string
  started_at: string
  status: string
  cancelled: boolean
}

interface UserItem {
  id: string
  email: string
  role: string
  first_name: string | null
  last_name: string | null
  created_at: string | null
}

interface HistoryDetail {
  id: string
  run_id: string
  query: string
  research_plan: string | null
  gemini_output: string | null
  openai_output: string | null
  perplexity_output: string | null
  consensus_report: string | null
  overall_status: string
  created_at: string | null
  completed_at: string | null
}

function AgentCard({ 
  name, 
  icon: Icon, 
  data, 
  color,
  agentType,
  liveUpdates,
  showLiveFeed,
  isResearchActive
}: { 
  name: string
  icon: React.ComponentType<{ className?: string }>
  data: SubAgentState
  color: string
  agentType?: 'gemini' | 'openai' | 'perplexity'
  liveUpdates?: LiveUpdate[]
  showLiveFeed?: boolean
  isResearchActive?: boolean
}) {
  const [showRaw, setShowRaw] = useState(false)
  
  const agentUpdates = liveUpdates?.filter(u => u.agent === agentType) || []
  
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
  
  const renderLiveFeed = () => {
    if (!showLiveFeed) return null
    if (data.status === 'idle') return null
    if (!isResearchActive && agentUpdates.length === 0) return null
    
    switch (agentType) {
      case 'gemini':
        return <LiveResearchPlan updates={agentUpdates} />
      case 'openai':
        return <ReasoningLog updates={agentUpdates} />
      case 'perplexity':
        return <LiveSources updates={agentUpdates} />
      default:
        return null
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
      
      {renderLiveFeed()}
      
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

function LoginForm({ onSuccess }: { onSuccess: (user: UserData) => void }) {
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isRegister) {
        const response = await axios.post('/api/auth/register', {
          email,
          password,
          first_name: firstName || undefined,
          last_name: lastName || undefined
        })
        onSuccess(response.data.user)
      } else {
        const response = await axios.post('/api/auth/login', { email, password })
        onSuccess(response.data.user)
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || 'An error occurred')
      } else {
        setError('An error occurred')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12">
      <div className="p-8 bg-gray-800/50 border border-gray-700 rounded-xl">
        <div className="flex items-center gap-2 mb-6 justify-center">
          <User className="w-6 h-6 text-purple-400" />
          <h2 className="text-xl font-semibold">{isRegister ? 'Create Account' : 'Sign In'}</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {isRegister && (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-1">First Name (optional)</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Last Name (optional)</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                {isRegister ? 'Create Account' : 'Sign In'}
              </>
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-gray-400 text-sm">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsRegister(!isRegister); setError(null) }}
            className="text-purple-400 hover:text-purple-300 underline"
          >
            {isRegister ? 'Sign In' : 'Create Account'}
          </button>
        </p>
      </div>
    </div>
  )
}

function AdminSettingsPage({ onBack }: { onBack: () => void }) {
  const [config, setConfig] = useState<AdminConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [cancellingJob, setCancellingJob] = useState<string | null>(null)
  const [users, setUsers] = useState<UserItem[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [updatingUser, setUpdatingUser] = useState<string | null>(null)
  const [deletingUser, setDeletingUser] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<UserData | null>(null)
  const [currentUserLoading, setCurrentUserLoading] = useState(true)

  const AVAILABLE_MODELS = [
    { id: 'google/gemini-3-pro-preview', name: 'Google Gemini 3 Pro Preview' },
    { id: 'google/gemini-2.5-pro', name: 'Google Gemini 2.5 Pro' },
    { id: 'anthropic/claude-opus-4.5', name: 'Anthropic Claude 4.5 Opus' },
    { id: 'anthropic/claude-sonnet-4.5', name: 'Anthropic Claude 4.5 Sonnet' },
    { id: 'x-ai/grok-4.1-fast', name: 'xAI Grok 4.1 Fast' },
    { id: 'x-ai/grok-4', name: 'xAI Grok 4' },
    { id: 'openai/gpt-5.2', name: 'OpenAI GPT-5.2' },
    { id: 'openai/o3', name: 'OpenAI o3' }
  ]

  const fetchActiveJobs = useCallback(async () => {
    try {
      const response = await axios.get('/api/admin/jobs')
      setActiveJobs(response.data.jobs)
    } catch (err) {
      console.error('Failed to fetch active jobs:', err)
    } finally {
      setLoadingJobs(false)
    }
  }, [])

  const fetchUsers = useCallback(async (showLoading = true) => {
    if (showLoading) setLoadingUsers(true)
    try {
      const response = await axios.get('/api/admin/users')
      setUsers(response.data.users)
    } catch (err) {
      console.error('Failed to fetch users:', err)
      setError('Failed to load users')
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  const fetchCurrentUser = useCallback(async () => {
    setCurrentUserLoading(true)
    try {
      const response = await axios.get('/api/auth/me')
      setCurrentUser(response.data)
    } catch (err) {
      console.error('Failed to fetch current user:', err)
      setError('Failed to identify current user. User management may not work correctly.')
    } finally {
      setCurrentUserLoading(false)
    }
  }, [])

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    setUpdatingUser(userId)
    setError(null)
    try {
      await axios.patch(`/api/admin/users/${userId}`, { role: newRole })
      await fetchUsers(false)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || 'Failed to update user role')
      } else {
        setError('Failed to update user role')
      }
    } finally {
      setUpdatingUser(null)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return
    }
    setDeletingUser(userId)
    setError(null)
    try {
      await axios.delete(`/api/admin/users/${userId}`)
      await fetchUsers(false)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || 'Failed to delete user')
      } else {
        setError('Failed to delete user')
      }
    } finally {
      setDeletingUser(null)
    }
  }

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await axios.get('/api/admin/config')
        setConfig(response.data)
      } catch (err) {
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.detail || 'Failed to load configuration')
        } else {
          setError('Failed to load configuration')
        }
      } finally {
        setLoading(false)
      }
    }
    fetchConfig()
    fetchActiveJobs()
    fetchUsers()
    fetchCurrentUser()
    const interval = setInterval(fetchActiveJobs, 5000)
    return () => clearInterval(interval)
  }, [fetchActiveJobs, fetchUsers, fetchCurrentUser])

  const handleCancelJob = async (runId: string) => {
    setCancellingJob(runId)
    try {
      await axios.post(`/api/admin/jobs/${runId}/cancel`)
      await fetchActiveJobs()
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || 'Failed to cancel job')
      }
    } finally {
      setCancellingJob(null)
    }
  }

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    return `${Math.floor(diffHours / 24)}d ago`
  }

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      await axios.patch('/api/admin/config', config)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || 'Failed to save configuration')
      } else {
        setError('Failed to save configuration')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-purple-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <header className="mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
          <div className="flex items-center gap-3">
            <Settings className="w-10 h-10 text-purple-500" />
            <h1 className="text-3xl font-bold">Admin Settings</h1>
          </div>
          <p className="text-gray-400 mt-2">Configure research models, prompts, and system behavior</p>
        </header>

        {error && (
          <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-400 mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-500/20 border border-green-500 rounded-lg text-green-400 mb-6">
            Configuration saved successfully!
          </div>
        )}

        <div className="space-y-8">
          <section className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" />
              Research Planning
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Supervisor Model</label>
                <select
                  value={config?.supervisor_model || ''}
                  onChange={(e) => setConfig(c => c ? { ...c, supervisor_model: e.target.value } : null)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {AVAILABLE_MODELS.map(model => (
                    <option key={model.id} value={model.id}>{model.name} ({model.id})</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Model used to create research plans</p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Supervisor Prompt</label>
                <textarea
                  value={config?.supervisor_prompt || ''}
                  onChange={(e) => setConfig(c => c ? { ...c, supervisor_prompt: e.target.value } : null)}
                  rows={8}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Use {'{query}'} as a placeholder for the user's research query</p>
              </div>
            </div>
          </section>

          <section className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-400" />
              Report Synthesis
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Synthesizer Model</label>
                <select
                  value={config?.synthesizer_model || ''}
                  onChange={(e) => setConfig(c => c ? { ...c, synthesizer_model: e.target.value } : null)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {AVAILABLE_MODELS.map(model => (
                    <option key={model.id} value={model.id}>{model.name} ({model.id})</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Model used to synthesize research reports</p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Synthesizer Prompt</label>
                <textarea
                  value={config?.synthesizer_prompt || ''}
                  onChange={(e) => setConfig(c => c ? { ...c, synthesizer_prompt: e.target.value } : null)}
                  rows={10}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Use {'{query}'} for the research query and {'{combined_reports}'} for the agent reports</p>
              </div>
            </div>
          </section>

          <section className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-blue-400" />
              Agent Settings
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Agent Timeout (minutes)</label>
                <input
                  type="number"
                  min={5}
                  max={1440}
                  value={config?.agent_timeout_minutes || 120}
                  onChange={(e) => setConfig(c => c ? { ...c, agent_timeout_minutes: parseInt(e.target.value) || 120 } : null)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">Maximum time (in minutes) each research agent is allowed to run before timing out. Valid range: 5-1440 minutes (24 hours).</p>
              </div>
            </div>
          </section>

          <section className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              Active Research Jobs
            </h2>
            {loadingJobs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : activeJobs.length === 0 ? (
              <p className="text-gray-500 text-sm">No active research jobs</p>
            ) : (
              <div className="space-y-3">
                {activeJobs.map(job => (
                  <div key={job.run_id} className={`p-4 rounded-lg border ${job.cancelled ? 'bg-red-900/20 border-red-800' : 'bg-gray-700/50 border-gray-600'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-gray-400">{job.run_id.slice(0, 8)}...</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${job.cancelled ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                            {job.cancelled ? 'Cancelled' : job.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-300 truncate">{job.query}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>{job.user_email}</span>
                          <span>{formatTimeAgo(job.started_at)}</span>
                        </div>
                      </div>
                      {!job.cancelled && (
                        <button
                          onClick={() => handleCancelJob(job.run_id)}
                          disabled={cancellingJob === job.run_id}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm font-medium flex items-center gap-1.5 shrink-0"
                        >
                          {cancellingJob === job.run_id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-400" />
              Display Settings
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm text-gray-300 font-medium">Show Live Agent Feeds</label>
                <p className="text-xs text-gray-500 mt-1">Display real-time streaming updates from each research agent during research</p>
              </div>
              <button
                onClick={() => setConfig(c => c ? { ...c, show_live_agent_feeds: !c.show_live_agent_feeds } : null)}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  config?.show_live_agent_feeds ? 'bg-purple-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    config?.show_live_agent_feeds ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </section>

          <section className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              User Management
            </h2>
            {loadingUsers || currentUserLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : users.length === 0 ? (
              <p className="text-gray-500 text-sm">No users found</p>
            ) : (
              <div className="space-y-3">
                {users.map(user => {
                  const isCurrentUser = currentUser?.id === user.id
                  const cannotModify = isCurrentUser || !currentUser
                  const displayName = user.first_name || user.last_name 
                    ? `${user.first_name || ''} ${user.last_name || ''}`.trim() 
                    : null
                  return (
                    <div key={user.id} className={`p-4 rounded-lg border ${isCurrentUser ? 'bg-purple-900/20 border-purple-700' : 'bg-gray-700/50 border-gray-600'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-200">{user.email}</span>
                            {isCurrentUser && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                                You
                              </span>
                            )}
                          </div>
                          {displayName && (
                            <p className="text-xs text-gray-400 mb-1">{displayName}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>Created: {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            value={user.role}
                            onChange={(e) => handleUpdateUserRole(user.id, e.target.value)}
                            disabled={cannotModify || updatingUser === user.id}
                            className={`px-3 py-1.5 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                              cannotModify 
                                ? 'bg-gray-600 border-gray-500 text-gray-400 cursor-not-allowed' 
                                : 'bg-gray-700 border-gray-600 text-gray-200'
                            }`}
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                          {updatingUser === user.id && (
                            <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                          )}
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={cannotModify || deletingUser === user.id}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${
                              cannotModify 
                                ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                                : 'bg-red-600 hover:bg-red-700 disabled:opacity-50'
                            }`}
                            title={isCurrentUser ? "You cannot delete your own account" : "Delete user"}
                          >
                            {deletingUser === user.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-700">
          <button
            onClick={onBack}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function HistoryPanel({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [selectedItem, setSelectedItem] = useState<HistoryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await axios.get('/api/research/history')
        setItems(response.data.items)
      } catch (err) {
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.detail || 'Failed to load history')
        } else {
          setError('Failed to load history')
        }
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [])

  const handleSelectItem = async (id: string) => {
    setLoadingDetail(true)
    setError(null)
    try {
      const response = await axios.get(`/api/research/history/${id}`)
      setSelectedItem(response.data)
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || 'Failed to load details')
      } else {
        setError('Failed to load details')
      }
    } finally {
      setLoadingDetail(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleString()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400'
      case 'failed':
        return 'bg-red-500/20 text-red-400'
      default:
        return 'bg-yellow-500/20 text-yellow-400'
    }
  }

  const handleDownloadMarkdown = () => {
    if (!selectedItem?.consensus_report) return
    
    let content = selectedItem.consensus_report
    
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `research-report-${new Date().toISOString().split('T')[0]}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDownloadPDF = () => {
    if (!selectedItem?.consensus_report) return
    const element = document.getElementById('history-report-content')
    if (!element) return
    
    const opt = {
      margin: [10, 10, 10, 10] as [number, number, number, number],
      filename: `research-report-${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    }
    
    html2pdf().set(opt).from(element).save()
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-800 p-8 rounded-xl">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {selectedItem && (
              <button
                onClick={() => setSelectedItem(null)}
                className="text-gray-400 hover:text-white mr-2"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            <History className="w-6 h-6 text-purple-400" />
            <h2 className="text-xl font-semibold">
              {selectedItem ? 'Research Details' : 'Research History'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-400 mb-4">
              {error}
            </div>
          )}

          {loadingDetail && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
          )}

          {!loadingDetail && selectedItem && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-300 mb-2">Query</h3>
                <p className="text-white bg-gray-700 p-4 rounded-lg">{selectedItem.query}</p>
              </div>
              
              <div className="flex gap-4 text-sm text-gray-400">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Started: {formatDate(selectedItem.created_at)}
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  Completed: {formatDate(selectedItem.completed_at)}
                </div>
                <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(selectedItem.overall_status)}`}>
                  {selectedItem.overall_status}
                </span>
              </div>

              {selectedItem.research_plan && (
                <div>
                  <h3 className="text-lg font-medium text-gray-300 mb-2">Research Plan</h3>
                  <div className="bg-gray-700 p-4 rounded-lg prose prose-invert max-w-none">
                    <ReactMarkdown>{selectedItem.research_plan}</ReactMarkdown>
                  </div>
                </div>
              )}

              {selectedItem.consensus_report && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-medium text-gray-300">Consensus Report</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDownloadMarkdown}
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-lg text-sm transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        Markdown
                      </button>
                      <button
                        onClick={handleDownloadPDF}
                        className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        PDF
                      </button>
                    </div>
                  </div>
                  <div id="history-report-content" className="bg-gray-700 p-4 rounded-lg prose prose-invert max-w-none max-h-96 overflow-y-auto">
                    <ReactMarkdown>{selectedItem.consensus_report}</ReactMarkdown>
                  </div>
                </div>
              )}

              <details className="group">
                <summary className="cursor-pointer text-gray-400 hover:text-white">
                  View Individual Agent Reports
                </summary>
                <div className="mt-4 space-y-4">
                  {selectedItem.gemini_output && (
                    <div>
                      <h4 className="text-md font-medium text-blue-400 mb-2">Gemini Output</h4>
                      <div className="bg-gray-700 p-4 rounded-lg prose prose-invert max-w-none max-h-64 overflow-y-auto text-sm">
                        <ReactMarkdown>{selectedItem.gemini_output}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                  {selectedItem.openai_output && (
                    <div>
                      <h4 className="text-md font-medium text-green-400 mb-2">OpenAI Output</h4>
                      <div className="bg-gray-700 p-4 rounded-lg prose prose-invert max-w-none max-h-64 overflow-y-auto text-sm">
                        <ReactMarkdown>{selectedItem.openai_output}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                  {selectedItem.perplexity_output && (
                    <div>
                      <h4 className="text-md font-medium text-orange-400 mb-2">Perplexity Output</h4>
                      <div className="bg-gray-700 p-4 rounded-lg prose prose-invert max-w-none max-h-64 overflow-y-auto text-sm">
                        <ReactMarkdown>{selectedItem.perplexity_output}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              </details>
            </div>
          )}

          {!loadingDetail && !selectedItem && (
            <>
              {items.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <History className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No research history yet.</p>
                  <p className="text-sm mt-2">Your completed research will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectItem(item.id)}
                      className="w-full text-left p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{item.query}</p>
                          <div className="flex items-center gap-2 mt-2 text-sm text-gray-400">
                            <Clock className="w-4 h-4" />
                            {formatDate(item.created_at)}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs shrink-0 ${getStatusColor(item.overall_status)}`}>
                          {item.overall_status}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function App() {
  const [user, setUser] = useState<UserData | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [currentView, setCurrentView] = useState<'main' | 'admin-settings'>('main')
  const [showHistory, setShowHistory] = useState(false)
  
  const [query, setQuery] = useState('')
  const [runId, setRunId] = useState<string | null>(null)
  const [status, setStatus] = useState<ResearchStatus | null>(null)
  const [pendingPlan, setPendingPlan] = useState<PlanResponse | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [isCreatingPlan, setIsCreatingPlan] = useState(false)
  const [isStartingImmediate, setIsStartingImmediate] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [liveUpdates, setLiveUpdates] = useState<LiveUpdate[]>([])
  const [showLiveFeed, setShowLiveFeed] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await axios.get('/api/auth/me')
        if (response.data.authenticated) {
          setUser(response.data.user)
        }
      } catch (err) {
        console.error('Auth check failed:', err)
      } finally {
        setAuthLoading(false)
      }
    }
    checkAuth()
  }, [])
  
  useEffect(() => {
    if (!user) return
    
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
  }, [user])
  
  const pollStatus = useCallback(async (id: string) => {
    try {
      const response = await axios.get<ResearchStatus>(`/api/status/${id}`)
      setStatus(response.data)
      setError(null)
      
      if (response.data.overall_status === 'completed' || response.data.overall_status === 'failed' || response.data.overall_status === 'cancelled') {
        setIsPolling(false)
        localStorage.removeItem('meta_research_run_id')
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        localStorage.removeItem('meta_research_run_id')
        setRunId(null)
        setIsPolling(false)
      } else if (axios.isAxiosError(err) && err.response?.status === 401) {
        setUser(null)
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

  useEffect(() => {
    if (!user) return
    const fetchConfig = async () => {
      try {
        const response = await axios.get('/api/admin/config')
        setShowLiveFeed(response.data.show_live_agent_feeds ?? true)
      } catch {
        setShowLiveFeed(true)
      }
    }
    fetchConfig()
  }, [user])

  const lastRunIdRef = useRef<string | null>(null)
  
  useEffect(() => {
    if (!isPolling || !runId || !showLiveFeed) return
    
    if (lastRunIdRef.current !== runId) {
      setLiveUpdates([])
      lastRunIdRef.current = runId
    }
    
    const eventSource = new EventSource(`/api/stream/${runId}`)
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as LiveUpdate
        setLiveUpdates(prev => [...prev, data])
      } catch (err) {
        console.error('Failed to parse SSE data:', err)
      }
    }
    
    eventSource.onerror = () => {
      eventSource.close()
    }
    
    return () => {
      eventSource.close()
    }
  }, [isPolling, runId, showLiveFeed])

  const handleLogout = async () => {
    try {
      await axios.post('/api/auth/logout')
    } catch (err) {
      console.error('Logout failed:', err)
    } finally {
      setUser(null)
      setRunId(null)
      setStatus(null)
      setPendingPlan(null)
      setIsPolling(false)
      localStorage.removeItem('meta_research_run_id')
      localStorage.removeItem('meta_research_pending_plan')
    }
  }
  
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
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setUser(null)
        setError('Session expired. Please sign in again.')
      } else {
        setError('Failed to create research plan. Please try again.')
      }
    } finally {
      setIsCreatingPlan(false)
    }
  }

  const handleStartImmediate = async () => {
    if (!query.trim()) return
    
    setError(null)
    setStatus(null)
    setIsStartingImmediate(true)
    
    try {
      const response = await axios.post<{ run_id: string; status: string; message: string }>('/api/research/immediate', { query })
      setRunId(response.data.run_id)
      localStorage.setItem('meta_research_run_id', response.data.run_id)
      setIsPolling(true)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setUser(null)
        setError('Session expired. Please sign in again.')
      } else {
        setError('Failed to start research. Please try again.')
      }
    } finally {
      setIsStartingImmediate(false)
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
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setUser(null)
        setError('Session expired. Please sign in again.')
      } else {
        setError('Failed to approve research. Please try again.')
      }
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
    setLiveUpdates([])
    localStorage.removeItem('meta_research_run_id')
    localStorage.removeItem('meta_research_pending_plan')
  }

  const handleDownloadMarkdown = () => {
    if (!status?.consensus_report) return
    
    let content = status.consensus_report
    
    if (status.citations && status.citations.length > 0) {
      content += '\n\n---\n\n## Sources\n\n'
      status.citations.forEach((citation, index) => {
        content += `${index + 1}. [${citation.title}](${citation.url}) *(${citation.source_agent})*\n`
      })
    }
    
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `research-report-${new Date().toISOString().split('T')[0]}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDownloadPDF = () => {
    if (!status?.consensus_report) return
    const element = document.getElementById('consensus-report-content')
    if (!element) return
    
    const opt = {
      margin: [10, 10, 10, 10] as [number, number, number, number],
      filename: `research-report-${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
    }
    
    html2pdf().set(opt).from(element).save()
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-purple-500" />
      </div>
    )
  }

  if (currentView === 'admin-settings') {
    return <AdminSettingsPage onBack={() => setCurrentView('main')} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {showHistory && <HistoryPanel onClose={() => setShowHistory(false)} />}
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <header className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Brain className="w-12 h-12 text-purple-500" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">
                Meta-Deep Research
              </h1>
            </div>
            
            {user && (
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowHistory(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <History className="w-4 h-4" />
                  History
                </button>
                {user.role === 'admin' && (
                  <button
                    onClick={() => setCurrentView('admin-settings')}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </button>
                )}
                <span className="text-gray-400">
                  {user.first_name || user.email}
                  {user.role === 'admin' && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-purple-600 rounded-full">Admin</span>
                  )}
                </span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
          <p className="text-gray-400 text-lg text-center">
            Orchestrating AI research across Gemini, OpenAI, and Perplexity
          </p>
        </header>
        
        {!user ? (
          <>
            <div className="text-center py-8 mb-8">
              <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                Get comprehensive research results by querying three leading AI research engines simultaneously, then receive a synthesized consensus report.
              </p>
              <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                <div className="p-6 bg-gray-800/30 rounded-xl border border-gray-700">
                  <Sparkles className="w-10 h-10 text-blue-400 mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">Google Deep Research</h3>
                  <p className="text-gray-400 text-sm">Google's advanced reasoning capabilities</p>
                </div>
                <div className="p-6 bg-gray-800/30 rounded-xl border border-gray-700">
                  <Cpu className="w-10 h-10 text-green-400 mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">OpenAI Deep Research</h3>
                  <p className="text-gray-400 text-sm">OpenAI's comprehensive deep research</p>
                </div>
                <div className="p-6 bg-gray-800/30 rounded-xl border border-gray-700">
                  <Globe className="w-10 h-10 text-orange-400 mx-auto mb-4" />
                  <h3 className="font-semibold mb-2">Perplexity Deep Research</h3>
                  <p className="text-gray-400 text-sm">Real-time web research with citations</p>
                </div>
              </div>
            </div>
            <LoginForm onSuccess={setUser} />
          </>
        ) : (
          <>
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
                <div className="flex justify-end gap-4">
                  <button
                    type="submit"
                    disabled={!query.trim() || isCreatingPlan || isStartingImmediate}
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
                  <button
                    type="button"
                    onClick={handleStartImmediate}
                    disabled={!query.trim() || isCreatingPlan || isStartingImmediate}
                    className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                  >
                    {isStartingImmediate ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <PlayCircle className="w-5 h-5" />
                        Start Research Now
                      </>
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
                  <div className="mb-6 p-4 bg-gray-900/50 rounded-lg prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{pendingPlan.research_plan}</ReactMarkdown>
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
                    <div className="prose prose-invert prose-sm max-w-none text-gray-300">
                      <ReactMarkdown>{status.research_plan}</ReactMarkdown>
                    </div>
                  </div>
                )}
                
                <div className="grid md:grid-cols-3 gap-6 mb-8">
                  <AgentCard 
                    name="Google Deep Research" 
                    icon={Sparkles}
                    data={status.gemini_data} 
                    color="blue"
                    agentType="gemini"
                    liveUpdates={liveUpdates}
                    showLiveFeed={showLiveFeed}
                    isResearchActive={isPolling}
                  />
                  <AgentCard 
                    name="OpenAI Deep Research" 
                    icon={Cpu}
                    data={status.openai_data} 
                    color="green"
                    agentType="openai"
                    liveUpdates={liveUpdates}
                    showLiveFeed={showLiveFeed}
                    isResearchActive={isPolling}
                  />
                  <AgentCard 
                    name="Perplexity Deep Research" 
                    icon={Globe}
                    data={status.perplexity_data} 
                    color="orange"
                    agentType="perplexity"
                    liveUpdates={liveUpdates}
                    showLiveFeed={showLiveFeed}
                    isResearchActive={isPolling}
                  />
                </div>
                
                {status.overall_status === 'researching' && (
                  <div className="text-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-500" />
                    <p className="text-gray-400">Research in progress... Polling for updates every 3 seconds</p>
                  </div>
                )}
                
                {status.consensus_report && (
                  <div className="mt-8">
                    <div className="flex items-center justify-end mb-4 gap-2">
                      <button
                        onClick={handleReset}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                      >
                        New Research
                      </button>
                    </div>
                    <div id="consensus-report-content">
                      <ReportContainer
                        title={status.user_query}
                        content={status.consensus_report}
                        citations={status.citations || []}
                        onDownloadMarkdown={handleDownloadMarkdown}
                        onDownloadPDF={handleDownloadPDF}
                      />
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
                    <h3 className="font-semibold mb-2">Google Deep Research</h3>
                    <p className="text-gray-400 text-sm">Google's advanced reasoning capabilities</p>
                  </div>
                  <div className="p-6 bg-gray-800/30 rounded-xl border border-gray-700">
                    <Cpu className="w-10 h-10 text-green-400 mx-auto mb-4" />
                    <h3 className="font-semibold mb-2">OpenAI Deep Research</h3>
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
          </>
        )}
      </div>
    </div>
  )
}

export default App
