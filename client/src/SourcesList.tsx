import { ExternalLink, BookOpen } from 'lucide-react'

interface Citation {
  title: string
  url: string
  source_agent: string
}

interface SourcesListProps {
  citations: Citation[]
}

export default function SourcesList({ citations }: SourcesListProps) {
  if (!citations || citations.length === 0) {
    return null
  }

  const getAgentColor = (agent: string) => {
    if (agent.includes('Gemini')) return 'text-blue-400'
    if (agent.includes('OpenAI')) return 'text-green-400'
    if (agent.includes('Perplexity')) return 'text-orange-400'
    return 'text-gray-400'
  }

  return (
    <div className="mt-8 p-6 bg-gray-800/50 border border-gray-700 rounded-xl">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-semibold">Sources ({citations.length})</h3>
      </div>
      
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {citations.map((citation, index) => (
          <div 
            key={`${citation.url}-${index}`}
            className="flex items-start gap-3 p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <span className="text-gray-500 font-mono text-sm min-w-[2rem]">
              [{index + 1}]
            </span>
            <div className="flex-1 min-w-0">
              <a 
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 break-all"
              >
                <span className="line-clamp-2">{citation.title}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
              <p className="text-xs text-gray-500 mt-1 truncate">
                {citation.url}
              </p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full bg-gray-800 shrink-0 ${getAgentColor(citation.source_agent)}`}>
              {citation.source_agent}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
