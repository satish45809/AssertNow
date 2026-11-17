import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Activity, 
  Layers, 
  Database, 
  Workflow, 
  PlayCircle, 
  BarChart3, 
  Users, 
  CreditCard, 
  ShieldCheck, 
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { SalesforceApi } from '@/api/SalesforceApi';

interface SidebarProps {
  currentOrgName?: string;
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ currentOrgName }) => {
  const [orgDisplayName, setOrgDisplayName] = useState(currentOrgName || 'AssertNow Org');

  useEffect(() => {
    if (currentOrgName) {
      setOrgDisplayName(currentOrgName);
      return;
    }
    SalesforceApi.getEnvironments()
      .then(envs => {
        if (Array.isArray(envs) && envs.length > 0) {
          const active = envs.find(e => e.status === 'ONLINE') || envs[0];
          setOrgDisplayName(active.name);
        }
      })
      .catch(() => {});
  }, [currentOrgName]);
  const navSections: NavSection[] = [
    {
      label: 'COMMAND',
      items: [
        { to: '/overview', label: 'Overview', icon: Activity },
      ]
    },
    {
      label: 'INTEGRATIONS',
      items: [
        { to: '/integrations', label: 'Environments', icon: Layers },
        { to: '/metadata', label: 'Metadata Registry', icon: Database },
      ]
    },
    {
      label: 'AUTOMATION',
      items: [
        { to: '/workflows', label: 'Test Workflows', icon: Workflow },
        { to: '/executions', label: 'Test Runs & Logs', icon: PlayCircle },
        { to: '/reports', label: 'Analytics & Trends', icon: BarChart3 },
      ]
    },
    {
      label: 'ADMINISTRATION',
      items: [
        { to: '/team', label: 'Team & Access', icon: Users },
        { to: '/subscription', label: 'Subscription & Quotas', icon: CreditCard },
        { to: '/audit', label: 'Audit History', icon: ShieldCheck },
      ]
    }
  ];

  return (
    <aside className="w-64 bg-white dark:bg-[#080d1a] border-r border-slate-200 dark:border-slate-800/80 flex flex-col h-full z-20 flex-shrink-0 transition-colors">
      {/* Brand & Organization */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 via-sky-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
              AssertNow
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                PRO
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate max-w-[140px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
              {orgDisplayName}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navSections.map((section, idx) => (
          <div key={idx}>
            <div className="text-[10px] font-mono tracking-wider font-semibold text-slate-400 dark:text-slate-500 px-3 mb-2">
              {section.label}
            </div>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-all group ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40 border border-transparent'
                      }`
                    }
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 transition-colors group-hover:text-blue-500 dark:group-hover:text-blue-400" />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 border border-blue-400/30">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer System Status */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/40">
        <div className="rounded-lg bg-white dark:bg-slate-900/60 p-2.5 border border-slate-200 dark:border-slate-800/80 text-[11px]">
          <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-medium mb-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Engine Mesh Active
            </span>
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">v2.1</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Salesforce Adapter OK</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-medium">100%</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
