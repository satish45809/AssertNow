import React, { useState, useEffect } from 'react';
import { Sun, Moon, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { SalesforceApi } from '@/api/SalesforceApi';
import { IntegrationEnvironment } from '@/types';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  badge?: string;
  actions?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, badge, actions }) => {
  const { theme, toggleTheme } = useTheme();
  const [activeEnv, setActiveEnv] = useState<IntegrationEnvironment | null>(null);

  useEffect(() => {
    let isMounted = true;
    SalesforceApi.getEnvironments()
      .then(envs => {
        if (!isMounted) return;
        if (Array.isArray(envs) && envs.length > 0) {
          const online = envs.find(e => e.status === 'ONLINE') || envs[0];
          setActiveEnv(online);
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, []);

  const orgName = activeEnv?.name || 'Workspace';
  const orgUsername = activeEnv?.credentials?.username || 'Org Administrator';
  const initials = (activeEnv?.name?.slice(0, 2) || 'AD').toUpperCase();

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
        {activeEnv ? (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="truncate max-w-[120px]">{activeEnv.name}</span>
            <span className="text-[10px] opacity-75 font-bold uppercase">{activeEnv.status || 'ONLINE'}</span>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            <span>Standalone</span>
          </div>
        )}

        {/* Theme Toggle Button */}
        <button 
          onClick={toggleTheme}
          title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className="h-8 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1.5 transition-colors shadow-sm"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
              <span className="hidden md:inline font-medium text-[11px]">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20" />
              <span className="hidden md:inline font-medium text-[11px]">Dark</span>
            </>
          )}
        </button>

        {/* Real User & Org Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-sky-500 border border-blue-400/40 flex items-center justify-center text-[11px] font-bold text-white shadow-sm font-mono">
            {initials}
          </div>
          <div className="hidden lg:block text-left">
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-200 leading-tight truncate max-w-[130px]">
              {orgName}
            </div>
            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 leading-tight truncate max-w-[130px]" title={orgUsername}>
              {orgUsername}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
