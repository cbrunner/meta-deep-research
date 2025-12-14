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
      <div className={`bg-gradient-to-r ${styles.gradient} px-4 py-3`}>
        <div className="flex items-center gap-2">
          <span className="text-xl">{styles.icon}</span>
          <h4 className="font-semibold text-white">{styles.name}</h4>
        </div>
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
};

export default AgentSourceCard;
