import React from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { ApiError } from '@/api/ApiClient';

interface ErrorStateProps {
  title?: string;
  error: Error | ApiError | string | null;
  onRetry?: () => void;
  onBack?: () => void;
  backLabel?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'An Error Occurred',
  error,
  onRetry,
  onBack,
  backLabel = 'Go Back',
}) => {
  const errorMessage = typeof error === 'string' ? error : error?.message || 'Unexpected failure encountered.';
  const errorCode = error instanceof ApiError ? error.code : undefined;
  const errorDetails = error instanceof ApiError && error.details ? JSON.stringify(error.details, null, 2) : undefined;

  return (
    <div className="flex flex-col items-center justify-center min-h-[45vh] p-8 text-center animate-in fade-in duration-200">
      <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4 border border-rose-500/20 shadow-xs">
        <AlertTriangle className="w-6 h-6" />
      </div>

      <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
        {title}
      </h3>

      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 max-w-md leading-relaxed">
        {errorMessage}
      </p>

      {errorCode && (
        <span className="mt-2.5 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
          CODE: {errorCode}
        </span>
      )}

      {errorDetails && (
        <pre className="mt-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] text-slate-600 dark:text-slate-400 font-mono text-left max-w-md w-full overflow-x-auto">
          {errorDetails}
        </pre>
      )}

      <div className="mt-5 flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="h-8 px-3.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {backLabel}
          </button>
        )}
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-xs transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
};

