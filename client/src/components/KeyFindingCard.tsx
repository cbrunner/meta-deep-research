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
