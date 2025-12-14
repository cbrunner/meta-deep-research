# Replit Agent Prompt: Improve Visual Quality of Research Reports

## Project Context

This is a Meta Deep Research application that orchestrates parallel deep research across Gemini, OpenAI, and Perplexity APIs, then synthesizes results into a consensus report. The frontend is React + TypeScript + Vite + Tailwind CSS, and reports are rendered using react-markdown. I need to significantly improve the visual quality of the generated reports to match consulting-firm standards.

## Overview of Changes

Implement the following improvements in order:

1. Add and configure @tailwindcss/typography plugin
2. Upgrade react-markdown with proper plugins and custom components
3. Create reusable callout and card components for reports
4. Add syntax highlighting for code blocks
5. Implement professional typography and spacing
6. Update the report container styling
7. Improve PDF generation (if applicable)

---

## Phase 1: Install Dependencies

Install these packages in the client directory:

```bash
cd client
npm install @tailwindcss/typography remark-gfm rehype-sanitize react-syntax-highlighter
npm install -D @types/react-syntax-highlighter
```

---

## Phase 2: Configure Tailwind Typography Plugin

### Update `client/tailwind.config.js` (or `tailwind.config.ts`):

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            maxWidth: '65ch',
            '--tw-prose-body': theme('colors.slate.700'),
            '--tw-prose-headings': theme('colors.slate.900'),
            '--tw-prose-links': theme('colors.blue.600'),
            '--tw-prose-bold': theme('colors.slate.900'),
            '--tw-prose-quotes': theme('colors.slate.700'),
            '--tw-prose-quote-borders': theme('colors.indigo.500'),
            '--tw-prose-code': theme('colors.slate.800'),
            '--tw-prose-pre-bg': theme('colors.slate.900'),
            // Dark mode
            '--tw-prose-invert-body': theme('colors.slate.300'),
            '--tw-prose-invert-headings': theme('colors.white'),
            '--tw-prose-invert-links': theme('colors.blue.400'),
            a: {
              color: theme('colors.blue.600'),
              textDecoration: 'none',
              fontWeight: '500',
              '&:hover': {
                textDecoration: 'underline',
                color: theme('colors.blue.800'),
              },
            },
            blockquote: {
              borderLeftColor: theme('colors.indigo.500'),
              backgroundColor: theme('colors.indigo.50'),
              padding: '1rem 1.5rem',
              borderRadius: '0 0.5rem 0.5rem 0',
              fontStyle: 'normal',
            },
            'code::before': { content: 'none' },
            'code::after': { content: 'none' },
            code: {
              backgroundColor: theme('colors.slate.100'),
              padding: '0.25rem 0.375rem',
              borderRadius: '0.25rem',
              fontWeight: '500',
            },
            table: {
              width: '100%',
              borderCollapse: 'collapse',
            },
            'thead th': {
              backgroundColor: theme('colors.slate.100'),
              fontWeight: '600',
              padding: '0.75rem 1rem',
              borderBottom: `2px solid ${theme('colors.slate.300')}`,
            },
            'tbody td': {
              padding: '0.75rem 1rem',
              borderBottom: `1px solid ${theme('colors.slate.200')}`,
            },
            'tbody tr:hover': {
              backgroundColor: theme('colors.slate.50'),
            },
          },
        },
        // Dark mode variant
        invert: {
          css: {
            blockquote: {
              backgroundColor: theme('colors.slate.800'),
              borderLeftColor: theme('colors.indigo.400'),
            },
            code: {
              backgroundColor: theme('colors.slate.800'),
            },
            'thead th': {
              backgroundColor: theme('colors.slate.800'),
              borderBottom: `2px solid ${theme('colors.slate.600')}`,
            },
            'tbody td': {
              borderBottom: `1px solid ${theme('colors.slate.700')}`,
            },
            'tbody tr:hover': {
              backgroundColor: theme('colors.slate.800'),
            },
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
```

### If using Tailwind v4 with CSS config, add to `client/src/index.css`:

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

---

## Phase 3: Create Report Components

### Create `client/src/components/ReportRenderer.tsx`:

```tsx
import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ReportRendererProps {
  content: string;
  className?: string;
}

export const ReportRenderer: React.FC<ReportRendererProps> = ({ content, className = '' }) => {
  return (
    <article 
      className={`
        prose prose-slate lg:prose-lg dark:prose-invert 
        max-w-none
        prose-headings:font-semibold 
        prose-headings:tracking-tight
        prose-h1:text-3xl prose-h1:border-b prose-h1:border-slate-200 prose-h1:pb-4 prose-h1:mb-8
        prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6
        prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-4
        prose-p:leading-relaxed
        prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
        prose-blockquote:not-italic prose-blockquote:font-normal
        prose-img:rounded-xl prose-img:shadow-lg
        prose-hr:border-slate-300
        ${className}
      `}
    >
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          // Code block with syntax highlighting
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                className="rounded-lg shadow-md !mt-4 !mb-6"
                showLineNumbers={true}
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code 
                className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-sm font-mono" 
                {...props}
              >
                {children}
              </code>
            );
          },
          // Links open in new tab with indicator
          a: ({ href, children }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium inline-flex items-center gap-1"
            >
              {children}
              <svg className="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ),
          // Enhanced tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-8 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-50 dark:bg-slate-800">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900 dark:text-slate-100">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
              {children}
            </td>
          ),
          // Styled blockquotes for key findings
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 rounded-r-lg p-4 my-6 not-italic">
              <div className="text-indigo-900 dark:text-indigo-200">
                {children}
              </div>
            </blockquote>
          ),
          // Horizontal rules as section dividers
          hr: () => (
            <hr className="my-12 border-t-2 border-slate-200 dark:border-slate-700" />
          ),
          // Lists with better spacing
          ul: ({ children }) => (
            <ul className="my-4 space-y-2 list-disc list-outside pl-6">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-4 space-y-2 list-decimal list-outside pl-6">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="pl-2">
              {children}
            </li>
          ),
        }}
      >
        {content}
      </Markdown>
    </article>
  );
};

export default ReportRenderer;
```

### Create `client/src/components/Callout.tsx`:

```tsx
import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, Lightbulb, Sparkles } from 'lucide-react';

type CalloutType = 'info' | 'warning' | 'success' | 'error' | 'tip' | 'keyFinding';

interface CalloutProps {
  type: CalloutType;
  title?: string;
  children: React.ReactNode;
}

const calloutStyles: Record<CalloutType, { 
  container: string; 
  icon: React.ReactNode; 
  titleColor: string;
  textColor: string;
}> = {
  info: {
    container: 'bg-blue-50 border-l-4 border-blue-500 dark:bg-blue-950/30 dark:border-blue-400',
    icon: <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
    titleColor: 'text-blue-800 dark:text-blue-300',
    textColor: 'text-blue-700 dark:text-blue-200',
  },
  warning: {
    container: 'bg-amber-50 border-l-4 border-amber-500 dark:bg-amber-950/30 dark:border-amber-400',
    icon: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
    titleColor: 'text-amber-800 dark:text-amber-300',
    textColor: 'text-amber-700 dark:text-amber-200',
  },
  success: {
    container: 'bg-green-50 border-l-4 border-green-500 dark:bg-green-950/30 dark:border-green-400',
    icon: <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />,
    titleColor: 'text-green-800 dark:text-green-300',
    textColor: 'text-green-700 dark:text-green-200',
  },
  error: {
    container: 'bg-red-50 border-l-4 border-red-500 dark:bg-red-950/30 dark:border-red-400',
    icon: <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />,
    titleColor: 'text-red-800 dark:text-red-300',
    textColor: 'text-red-700 dark:text-red-200',
  },
  tip: {
    container: 'bg-purple-50 border-l-4 border-purple-500 dark:bg-purple-950/30 dark:border-purple-400',
    icon: <Lightbulb className="w-5 h-5 text-purple-600 dark:text-purple-400" />,
    titleColor: 'text-purple-800 dark:text-purple-300',
    textColor: 'text-purple-700 dark:text-purple-200',
  },
  keyFinding: {
    container: 'bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700 rounded-xl shadow-lg',
    icon: <Sparkles className="w-5 h-5 text-white" />,
    titleColor: 'text-white/90',
    textColor: 'text-white',
  },
};

export const Callout: React.FC<CalloutProps> = ({ type, title, children }) => {
  const styles = calloutStyles[type];
  
  return (
    <div className={`${styles.container} p-4 rounded-r-lg my-6`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {styles.icon}
        </div>
        <div className="flex-1 min-w-0">
          {title && (
            <p className={`font-semibold ${styles.titleColor} mb-1`}>
              {title}
            </p>
          )}
          <div className={styles.textColor}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Callout;
```

### Create `client/src/components/AgentSourceCard.tsx`:

```tsx
import React from 'react';

interface AgentSourceCardProps {
  agent: 'gemini' | 'openai' | 'perplexity';
  children: React.ReactNode;
}

const agentStyles = {
  gemini: {
    name: 'Gemini Deep Research',
    gradient: 'from-blue-500 to-cyan-500',
    bgLight: 'bg-blue-50 dark:bg-blue-950/20',
    border: 'border-blue-200 dark:border-blue-800',
    icon: '🔮',
  },
  openai: {
    name: 'OpenAI o3 Deep Research',
    gradient: 'from-emerald-500 to-teal-500',
    bgLight: 'bg-emerald-50 dark:bg-emerald-950/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    icon: '🧠',
  },
  perplexity: {
    name: 'Perplexity Deep Research',
    gradient: 'from-violet-500 to-purple-500',
    bgLight: 'bg-violet-50 dark:bg-violet-950/20',
    border: 'border-violet-200 dark:border-violet-800',
    icon: '🔍',
  },
};

export const AgentSourceCard: React.FC<AgentSourceCardProps> = ({ agent, children }) => {
  const styles = agentStyles[agent];
  
  return (
    <div className={`${styles.bgLight} ${styles.border} border rounded-xl overflow-hidden my-8`}>
      {/* Header */}
      <div className={`bg-gradient-to-r ${styles.gradient} px-4 py-3`}>
        <div className="flex items-center gap-2">
          <span className="text-xl">{styles.icon}</span>
          <h4 className="font-semibold text-white">{styles.name}</h4>
        </div>
      </div>
      {/* Content */}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
};

export default AgentSourceCard;
```

### Create `client/src/components/ReportSection.tsx`:

```tsx
import React from 'react';

interface ReportSectionProps {
  number?: number;
  title: string;
  children: React.ReactNode;
  variant?: 'default' | 'card' | 'numbered';
}

export const ReportSection: React.FC<ReportSectionProps> = ({ 
  number, 
  title, 
  children, 
  variant = 'default' 
}) => {
  if (variant === 'numbered' && number) {
    return (
      <section className="my-12">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{number}</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h2>
        </div>
        <div className="pl-16">
          {children}
        </div>
      </section>
    );
  }
  
  if (variant === 'card') {
    return (
      <section className="my-8">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md border-t-4 border-indigo-500 overflow-hidden">
          <div className="p-6">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{title}</h3>
            {children}
          </div>
        </div>
      </section>
    );
  }
  
  // Default variant with underline
  return (
    <section className="my-12">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white pb-3 border-b-2 border-indigo-500 mb-6">
        {title}
      </h2>
      {children}
    </section>
  );
};

export default ReportSection;
```

### Create `client/src/components/CitationList.tsx`:

```tsx
import React from 'react';
import { ExternalLink, FileText } from 'lucide-react';

interface Citation {
  id: string | number;
  title: string;
  url: string;
  source?: string;
  date?: string;
}

interface CitationListProps {
  citations: Citation[];
}

export const CitationList: React.FC<CitationListProps> = ({ citations }) => {
  if (!citations || citations.length === 0) return null;
  
  return (
    <section className="my-12">
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
              {(citation.source || citation.date) && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {citation.source && <span>{citation.source}</span>}
                  {citation.source && citation.date && <span> · </span>}
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
```

### Create `client/src/components/KeyFindingCard.tsx`:

```tsx
import React from 'react';
import { Sparkles } from 'lucide-react';

interface KeyFindingCardProps {
  children: React.ReactNode;
  label?: string;
}

export const KeyFindingCard: React.FC<KeyFindingCardProps> = ({ 
  children, 
  label = 'Key Finding' 
}) => {
  return (
    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white shadow-lg my-8">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5" />
        <span className="text-sm font-semibold uppercase tracking-wider opacity-90">{label}</span>
      </div>
      <div className="text-xl font-medium leading-relaxed">
        {children}
      </div>
    </div>
  );
};

export default KeyFindingCard;
```

---

## Phase 4: Create Report Container Component

### Create `client/src/components/ReportContainer.tsx`:

```tsx
import React from 'react';
import { ReportRenderer } from './ReportRenderer';
import { CitationList } from './CitationList';
import { Download, FileText, Calendar, Clock } from 'lucide-react';

interface Citation {
  id: string | number;
  title: string;
  url: string;
  source?: string;
  date?: string;
}

interface ReportContainerProps {
  title?: string;
  content: string;
  citations?: Citation[];
  createdAt?: Date;
  onDownloadMarkdown?: () => void;
  onDownloadPDF?: () => void;
  isLoading?: boolean;
}

export const ReportContainer: React.FC<ReportContainerProps> = ({
  title,
  content,
  citations = [],
  createdAt,
  onDownloadMarkdown,
  onDownloadPDF,
  isLoading = false,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 min-h-screen">
      {/* Report Header */}
      <header className="bg-gradient-to-r from-slate-900 to-slate-800 text-white py-12 px-6">
        <div className="max-w-4xl mx-auto">
          {title && (
            <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
              {title}
            </h1>
          )}
          <div className="flex flex-wrap items-center gap-4 text-slate-300 text-sm">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span>Meta Deep Research Report</span>
            </div>
            {createdAt && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{createdAt.toLocaleDateString()}</span>
              </div>
            )}
            {citations.length > 0 && (
              <div className="flex items-center gap-2">
                <span>{citations.length} sources cited</span>
              </div>
            )}
          </div>
          
          {/* Download buttons */}
          {(onDownloadMarkdown || onDownloadPDF) && (
            <div className="flex gap-3 mt-6">
              {onDownloadMarkdown && (
                <button
                  onClick={onDownloadMarkdown}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Markdown
                </button>
              )}
              {onDownloadPDF && (
                <button
                  onClick={onDownloadPDF}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Report Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-slate-500">
              <Clock className="w-5 h-5 animate-spin" />
              <span>Generating report...</span>
            </div>
          </div>
        ) : (
          <>
            <ReportRenderer content={content} />
            <CitationList citations={citations} />
          </>
        )}
      </main>

      {/* Report Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-8 px-6">
        <div className="max-w-4xl mx-auto text-center text-sm text-slate-500 dark:text-slate-400">
          <p>Generated by Meta Deep Research</p>
          <p className="mt-1">Synthesized from Gemini, OpenAI, and Perplexity deep research agents</p>
        </div>
      </footer>
    </div>
  );
};

export default ReportContainer;
```

---

## Phase 5: Create Index Export File

### Create `client/src/components/report/index.ts`:

```typescript
export { ReportRenderer } from '../ReportRenderer';
export { ReportContainer } from '../ReportContainer';
export { ReportSection } from '../ReportSection';
export { Callout } from '../Callout';
export { KeyFindingCard } from '../KeyFindingCard';
export { AgentSourceCard } from '../AgentSourceCard';
export { CitationList } from '../CitationList';
```

---

## Phase 6: Update App.tsx to Use New Components

Find where the report/consensus report is currently rendered in `App.tsx` and replace the markdown rendering with the new `ReportContainer` component. Look for where `react-markdown` is currently used and replace it.

Example integration:

```tsx
import { ReportContainer } from './components/ReportContainer';

// In your render function, replace the current report rendering with:
{status === 'completed' && consensusReport && (
  <ReportContainer
    title={originalQuery}
    content={consensusReport}
    citations={citations}
    createdAt={new Date()}
    onDownloadMarkdown={() => handleDownloadMarkdown()}
    onDownloadPDF={() => handleDownloadPDF()}
  />
)}
```

---

## Phase 7: Add Print/PDF Styles

### Add to `client/src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Print styles for PDF generation */
@media print {
  .no-print {
    display: none !important;
  }
  
  .page-break {
    break-before: page;
  }
  
  .avoid-break {
    break-inside: avoid;
  }
  
  body {
    font-size: 12pt;
    line-height: 1.5;
  }
  
  h1 {
    font-size: 24pt;
  }
  
  h2 {
    font-size: 18pt;
    break-after: avoid;
  }
  
  h3 {
    font-size: 14pt;
    break-after: avoid;
  }
  
  a {
    text-decoration: none;
    color: inherit;
  }
  
  /* Show URLs after links in print */
  a[href^="http"]::after {
    content: " (" attr(href) ")";
    font-size: 9pt;
    color: #666;
  }
  
  pre, code {
    white-space: pre-wrap;
    word-break: break-word;
  }
  
  table {
    border-collapse: collapse;
    width: 100%;
  }
  
  th, td {
    border: 1px solid #ddd;
    padding: 8px;
  }
}

@page {
  margin: 2cm;
  size: A4 portrait;
}

/* Custom scrollbar for code blocks */
.prose pre::-webkit-scrollbar {
  height: 8px;
}

.prose pre::-webkit-scrollbar-track {
  background: #1e293b;
  border-radius: 4px;
}

.prose pre::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 4px;
}

.prose pre::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}
```

---

## Phase 8: Update Synthesizer Prompt (Backend)

Update the synthesizer prompt in the admin configuration or `main.py` to output better-structured markdown. The synthesizer should output markdown that takes advantage of the new styling:

```
You are synthesizing research from multiple AI research agents into a cohesive, well-structured report.

Format your output as clean markdown following these guidelines:

1. Start with a brief executive summary using a blockquote:
   > **Key Finding**: [Main insight from the research]

2. Use clear heading hierarchy:
   - ## for main sections
   - ### for subsections
   
3. Use blockquotes (>) for important callouts and key findings

4. Use tables when comparing information across sources

5. Use bullet points sparingly and only for true lists

6. Include horizontal rules (---) between major sections

7. When citing sources, use inline links: [Source Name](URL)

8. Structure the report as:
   ## Executive Summary
   > **Key Finding**: [insight]
   
   ## Analysis
   [Main content organized by topic, not by source]
   
   ## Methodology Note
   [Brief note on sources used]
   
   ---
   
   ## Detailed Findings
   [Deeper analysis]

Original Query: {query}

Research Reports to Synthesize:
{combined_reports}

Generate a comprehensive, well-structured consensus report:
```

---

## Phase 9: Rebuild Frontend

After making all changes, rebuild the frontend:

```bash
cd client
npm run build
```

---

## Summary of Files to Create/Modify

**New files to create:**
- `client/src/components/ReportRenderer.tsx`
- `client/src/components/ReportContainer.tsx`
- `client/src/components/ReportSection.tsx`
- `client/src/components/Callout.tsx`
- `client/src/components/KeyFindingCard.tsx`
- `client/src/components/AgentSourceCard.tsx`
- `client/src/components/CitationList.tsx`
- `client/src/components/report/index.ts`

**Files to modify:**
- `client/tailwind.config.js` - Add typography plugin and custom config
- `client/src/index.css` - Add print styles
- `client/src/App.tsx` - Integrate new ReportContainer component
- `main.py` or admin config - Update synthesizer prompt

**Dependencies to install:**
- `@tailwindcss/typography`
- `remark-gfm`
- `rehype-sanitize`
- `react-syntax-highlighter`
- `@types/react-syntax-highlighter` (dev)

---

## Expected Result

After implementing these changes, the research reports will have:
- Professional typography with optimal line lengths and spacing
- Syntax-highlighted code blocks
- Beautiful callout boxes for key findings
- Properly styled tables with hover effects
- Clear visual hierarchy with section headers
- Dark mode support
- Print-optimized styles for PDF generation
- Consistent visual language throughout
