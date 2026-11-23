import React, { useState } from 'react';
import { Download, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { ExcelExportService, ExportLogsOptions } from '@/services/ExcelExportService';

export interface ExportLogsButtonProps extends ExportLogsOptions {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  label?: string;
  showIcon?: boolean;
  onSuccess?: (info: { filename: string; totalLogs: number }) => void;
  onError?: (err: Error) => void;
}

export const ExportLogsButton: React.FC<ExportLogsButtonProps> = ({
  workflowId,
  workflowName,
  logId,
  variant = 'outline',
  size = 'sm',
  className = '',
  label = 'Export Logs',
  showIcon = true,
  onSuccess,
  onError,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleExport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isExporting) return;

    setIsExporting(true);
    setFeedback(null);

    try {
      const res = await ExcelExportService.exportExecutionLogs({
        workflowId,
        workflowName,
        logId,
      });

      setFeedback({
        type: 'success',
        message: `Exported ${res.totalLogs} log(s) to ${res.filename}`,
      });
      setTimeout(() => setFeedback(null), 4000);

      if (onSuccess) onSuccess(res);
    } catch (err: any) {
      const msg = err.message || 'Failed to export execution logs.';
      setFeedback({
        type: 'error',
        message: msg,
      });
      setTimeout(() => setFeedback(null), 5000);

      if (onError) onError(err);
      else console.error('Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Base styling matching AssertNow enterprise theme
  const sizeClasses = {
    sm: 'h-8 px-3 text-xs',
    default: 'h-9 px-4 text-xs',
    lg: 'h-10 px-5 text-sm',
  }[size];

  const variantClasses = {
    default: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm border border-emerald-600',
    outline: 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-sm',
    secondary: 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200',
    ghost: 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300',
  }[variant];

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleExport}
        disabled={isExporting}
        title="Download execution logs & metadata as Excel (.xlsx)"
        className={`inline-flex items-center gap-1.5 font-medium rounded-md transition-all select-none disabled:opacity-60 disabled:cursor-not-allowed ${sizeClasses} ${variantClasses} ${className}`}
      >
        {isExporting ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
            <span>Exporting...</span>
          </>
        ) : (
          <>
            {showIcon && <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
            <span>{label}</span>
            <Download className="w-3 h-3 text-slate-400 dark:text-slate-500" />
          </>
        )}
      </button>

      {/* Floating Toast Notification */}
      {feedback && (
        <div
          className={`absolute top-full right-0 mt-2 z-50 min-w-[260px] p-2.5 rounded-lg border shadow-lg text-xs flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
          )}
          <span className="flex-1 font-medium">{feedback.message}</span>
        </div>
      )}
    </div>
  );
};
