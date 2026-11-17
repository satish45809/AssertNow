import React from 'react';
import { 
  CreditCard, 
  CheckCircle2, 
  Zap, 
  Clock, 
  ShieldCheck, 
  Layers, 
  Users, 
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { mockSubscriptionQuota } from '@/lib/mockData';

export const SubscriptionPage: React.FC = () => {
  const q = mockSubscriptionQuota;

  const executionPct = Math.round((q.monthlyExecutionsUsed / q.monthlyExecutionsMax) * 100);
  const userPct = Math.round((q.usersUsed / q.usersMax) * 100);
  const envPct = Math.round((q.environmentsUsed / q.environmentsMax) * 100);

  return (
    <div className="flex flex-col min-h-full">
      <Header 
        title="Subscription & Capacity Entitlements" 
        subtitle="Manage platform quotas, monthly test run allocation, and enterprise licensing"
      />

      <div className="p-6 space-y-6">
        {/* Current Plan Overview Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-900/90 dark:to-blue-950/40 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase font-bold">
                  ACTIVE SUBSCRIPTION
                </span>
                <span className="text-xs text-slate-500 font-mono">Billed Annually</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {q.planName}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Full-featured access to Salesforce CRM integration adapters, visual workflow studio, and Deno worker mesh.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button className="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm shadow-blue-500/20">
                <Sparkles className="w-3.5 h-3.5" />
                Upgrade Capacity
              </button>
            </div>
          </div>

          {/* Quota Progress Meters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
            {/* Monthly Executions */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                  <Zap className="w-4 h-4 text-blue-500 dark:text-sky-400" />
                  Monthly Executions
                </span>
                <span className="text-slate-900 dark:text-white font-mono font-bold">
                  {q.monthlyExecutionsUsed} / {q.monthlyExecutionsMax}
                </span>
              </div>

              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-blue-600 dark:bg-sky-500 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${executionPct}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>{executionPct}% consumed</span>
                <span>Resets Nov 30</span>
              </div>
            </div>

            {/* Connected Environments */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                  <Layers className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  Fleet Environments
                </span>
                <span className="text-slate-900 dark:text-white font-mono font-bold">
                  {q.environmentsUsed} / {q.environmentsMax}
                </span>
              </div>

              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${envPct}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>{envPct}% used</span>
                <span>6 slots available</span>
              </div>
            </div>

            {/* Team Members */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                  <Users className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                  Seats / Users
                </span>
                <span className="text-slate-900 dark:text-white font-mono font-bold">
                  {q.usersUsed} / {q.usersMax}
                </span>
              </div>

              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-purple-500 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${userPct}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>{userPct}% used</span>
                <span>12 seats available</span>
              </div>
            </div>
          </div>
        </div>

        {/* Plan Feature Entitlements */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Included Enterprise Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {[
              'Salesforce REST & JSforce Metadata Discovery',
              'Live SOQL Query & DML Execution Engine',
              'Regression Assertion & Observability Engine',
              'AES-256-GCM Credential Encryption & Rotation',
              'Audit Logs Immutability with Database Triggers',
              'Persistent Deno Background Worker Job Queue',
              'Unlimited Visual Workflow Studio Canvas Drafts',
              'Exportable Compliance Reports & SLA Trends',
              'Role-Based Access Control (RBAC) & Org Isolation'
            ].map((feat, i) => (
              <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="font-medium">{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
