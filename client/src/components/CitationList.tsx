import React from 'react';
import { ExternalLink, FileText } from 'lucide-react';

interface Citation {
  id?: string | number;
  title: string;
  url: string;
  source?: string;
  source_agent?: string;
  date?: string;
}

interface CitationListProps {
  citations: Citation[];
}

const getAgentBadgeColors = (agent: string) => {
  switch (agent?.toLowerCase()) {
    case 'gemini':
      return 'bg-blue-500/20 text-blue-300';
    case 'openai':
      return 'bg-green-500/20 text-green-300';
    case 'perplexity':
      return 'bg-orange-500/20 text-orange-300';
    default:
      return 'bg-gray-500/20 text-gray-300';
  }
};

export const CitationList: React.FC<CitationListProps> = ({ citations }) => {
  if (!citations || citations.length === 0) return null;
  
  return (
    <section className="my-12 citation-list">
      <h2 className="text-2xl font-bold text-gray-100 pb-3 border-b-2 border-gray-600 mb-6 flex items-center gap-2">
        <FileText className="w-6 h-6" />
        References
      </h2>
      <ol className="space-y-3">
        {citations.map((citation, index) => (
          <li 
            key={citation.id || index}
            className="flex items-start gap-3 p-3 rounded-lg bg-gray-800 hover:bg-gray-750 transition-colors"
          >
            <span className="flex-shrink-0 w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-sm font-medium text-gray-300">
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <a 
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 hover:underline font-medium inline-flex items-center gap-1"
              >
                {citation.title}
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
              {(citation.source || citation.source_agent || citation.date) && (
                <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-2">
                  {citation.source_agent && (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getAgentBadgeColors(citation.source_agent)}`}>
                      {citation.source_agent}
                    </span>
                  )}
                  {citation.source && <span>{citation.source}</span>}
                  {(citation.source || citation.source_agent) && citation.date && <span>·</span>}
                  {citation.date && <span>{citation.date}</span>}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};

export default CitationList;
