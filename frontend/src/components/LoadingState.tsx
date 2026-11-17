import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  submessage?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading data from AssertNow Engine...',
  submessage = 'Connecting to backend API and synchronizing records',
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] p-8 text-center animate-in fade-in duration-200">
      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 shadow-sm">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">{message}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">{submessage}</p>
    </div>
  );
};

