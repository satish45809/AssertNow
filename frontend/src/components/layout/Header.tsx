import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useConnection } from '@/providers/ConnectionProvider';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  badge?: string;
  actions?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, badge, actions }) => {
  const { theme, toggleTheme } = useTheme();
  const { status, isConnected, isLoading } = useConnection();

  const orgName = status.name || 'AssertNow';
  const initials = (status.name?.slice(0, 2) || 'AN').toUpperCase();

  return (
    <header className="h-14 min-h-[56px] border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/80 backdrop-blur-md px-6 flex items-center justify-between z-10 transition-colors gap-4">
      {/* Title & Subtitle */}
      <div className="flex items-center gap-3 min-w-0">
        {title && (
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate">
                {title}
              </h1>
              {badge && (
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 whitespace-nowrap">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-normal truncate max-w-xl">
                {subtitle}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Page Actions */}
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}

        {/* Live Salesforce Connection Status Pill */}
        {isLoading ? (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            <span>Checking...</span>
          </div>
        ) : isConnected ? (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="truncate max-w-[120px]">{orgName}</span>
            <span className="text-[10px] opacity-75 font-bold uppercase">CONNECTED</span>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            <span>Disconnected</span>
          </div>
        )}

        {/* Theme Toggle Button */}
        <button 
          onClick={toggleTheme}
          title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className="h-8 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1.5 transition-colors shadow-sm"
        >
          {theme === 'dark' ? (
            <><Sun className="w-3.5 h-3.5" /><span>Light</span></>
          ) : (
            <><Moon className="w-3.5 h-3.5" /><span>Dark</span></>
          )}
        </button>

        {/* User Avatar */}
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center text-[10px] font-black text-white shadow-sm shadow-blue-500/30 flex-shrink-0">
          {initials}
        </div>
      </div>
    </header>
  );
};
