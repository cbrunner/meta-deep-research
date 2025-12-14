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
