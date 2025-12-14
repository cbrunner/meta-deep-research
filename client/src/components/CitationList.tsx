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

export const CitationList: React.FC<CitationListProps> = ({ citations }) => {
  if (!citations || citations.length === 0) return null;
  
  return (
    <section className="my-12 citation-list">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white pb-3 border-b-2 border-slate-300 dark:border-slate-600 mb-6 flex items-center gap-2">
        <FileText className="w-6 h-6" />
        References
      </h2>
      <ol className="space-y-3">
        {citations.map((citation, index) => (
          <li 
            key={citation.id || index}
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <span className="flex-shrink-0 w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-sm font-medium text-slate-600 dark:text-slate-400">
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <a 
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium inline-flex items-center gap-1"
              >
                {citation.title}
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
              {(citation.source || citation.source_agent || citation.date) && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {citation.source && <span>{citation.source}</span>}
                  {citation.source_agent && <span className="capitalize">{citation.source_agent}</span>}
                  {(citation.source || citation.source_agent) && citation.date && <span> · </span>}
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
