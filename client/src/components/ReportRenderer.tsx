import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const customSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code || []), 'className'],
    pre: [...(defaultSchema.attributes?.pre || []), 'className'],
    span: [...(defaultSchema.attributes?.span || []), 'className', 'style'],
  },
};

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
        rehypePlugins={[[rehypeSanitize, customSanitizeSchema]]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
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
          a: ({ href, children }: any) => (
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
          table: ({ children }: any) => (
            <div className="overflow-x-auto my-8 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }: any) => (
            <thead className="bg-slate-50 dark:bg-slate-800">
              {children}
            </thead>
          ),
          th: ({ children }: any) => (
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900 dark:text-slate-100">
              {children}
            </th>
          ),
          td: ({ children }: any) => (
            <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
              {children}
            </td>
          ),
          blockquote: ({ children }: any) => (
            <blockquote className="border-l-4 border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 rounded-r-lg p-4 my-6 not-italic">
              <div className="text-indigo-900 dark:text-indigo-200">
                {children}
              </div>
            </blockquote>
          ),
          hr: () => (
            <hr className="my-12 border-t-2 border-slate-200 dark:border-slate-700" />
          ),
          ul: ({ children }: any) => (
            <ul className="my-4 space-y-2 list-disc list-outside pl-6">
              {children}
            </ul>
          ),
          ol: ({ children }: any) => (
            <ol className="my-4 space-y-2 list-decimal list-outside pl-6">
              {children}
            </ol>
          ),
          li: ({ children }: any) => (
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
