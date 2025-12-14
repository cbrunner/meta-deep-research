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
