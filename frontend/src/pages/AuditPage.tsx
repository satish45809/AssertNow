import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  Lock, 
  FileText, 
  Clock, 
  User, 
  Database,
  CheckCircle2
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { mockAuditLogs } from '@/lib/mockData';

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState(mockAuditLogs);
  const [search, setSearch] = useState('');

  const filtered = logs.filter(l => 
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.userEmail.toLowerCase().includes(search.toLowerCase()) ||
    l.details.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-full">
      <Header 
        title="Audit Logs & Compliance Ledger" 
        subtitle="Cryptographically immutable record of configuration, execution, and security events"
      />

      <div className="p-6 space-y-6">
        {/* Compliance Guarantee Banner */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-start justify-between shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Database-Enforced Immutability Active</h3>
              <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                All records in this ledger are append-only. UPDATE, DELETE, and TRUNCATE statements are blocked by database BEFORE triggers and Row-Level Security (RLS) policies.
              </p>
            </div>
          </div>

          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
            SOC2 / ISO27001 READY
          </span>
        </div>

        {/* Filter bar */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs text-slate-600 dark:text-slate-400 font-mono">
            Displaying <span className="font-bold text-slate-900 dark:text-white">{filtered.length}</span> audit records
          </div>

          <div className="relative w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search actions, users, IPs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-700 dark:text-slate-400 font-mono text-[11px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold">Action</th>
                <th className="py-3 px-4 font-semibold">Principal</th>
                <th className="py-3 px-4 font-semibold">Resource</th>
                <th className="py-3 px-4 font-semibold">IP Address</th>
                <th className="py-3 px-4 font-semibold">Event Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/30">
              {filtered.map(entry => (
                <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                    {new Date(entry.createdAt).toLocaleString()}
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-semibold">
                      {entry.action}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white text-xs">
                    {entry.userEmail}
                  </td>

                  <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                    {entry.resourceType}
                  </td>

                  <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                    {entry.ipAddress}
                  </td>

                  <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 text-xs">
                    {entry.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
