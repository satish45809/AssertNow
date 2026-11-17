import React, { useState } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Mail, 
  MoreVertical, 
  CheckCircle2, 
  Clock, 
  ShieldAlert 
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { mockUsers } from '@/lib/mockData';
import { User, UserRole } from '@/types';

export const TeamPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('END_USER');
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    const newUser: User = {
      id: `usr-${Date.now()}`,
      email: inviteEmail,
      firstName: inviteEmail.split('@')[0],
      lastName: '',
      role: inviteRole,
      status: 'PENDING_ACTIVATION',
      createdAt: new Date().toISOString().split('T')[0]
    };

    setUsers([...users, newUser]);
    setIsInviteOpen(false);
    setInviteEmail('');
    setInviteSuccess(`Invitation dispatched to ${inviteEmail} with 48h activation token.`);
    setTimeout(() => setInviteSuccess(null), 4000);
  };

  return (
    <div className="flex flex-col min-h-full">
      <Header 
        title="Team & Organization Access" 
        subtitle="Manage organization users, role-based permissions (RBAC), and platform entitlements"
        actions={
          <button 
            onClick={() => setIsInviteOpen(true)}
            className="h-8 px-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm shadow-blue-500/30"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Invite Teammate
          </button>
        }
      />

      <div className="p-6 space-y-6">
        {inviteSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{inviteSuccess}</span>
          </div>
        )}

        {/* Roles Breakdown Explainer */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="font-bold text-slate-900 dark:text-white mb-1.5 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              INTERNAL_ADMIN
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              AssertNow operational staff. Manages cross-tenant platform health, plan configurations, and system diagnostics.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="font-bold text-slate-900 dark:text-white mb-1.5 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              ORG_ADMIN
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Customer administrator. Manages enterprise connections, invites team members, updates subscription, and audits security.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="font-bold text-slate-900 dark:text-white mb-1.5 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
              END_USER
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              QA automation engineers & developers. Designs test workflows, executes regression suites, and investigates failure logs.
            </p>
          </div>
        </div>

        {/* Users Table */}
        <div className="rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-700 dark:text-slate-400 font-mono text-[11px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 font-semibold">User Profile</th>
                <th className="py-3 px-4 font-semibold">Assigned Role</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Last Login</th>
                <th className="py-3 px-4 font-semibold">Joined Date</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/30">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-slate-800 dark:text-white text-xs">
                        {u.firstName ? u.firstName[0].toUpperCase() : u.email[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{u.firstName} {u.lastName}</div>
                        <div className="text-[11px] font-mono text-slate-500">{u.email}</div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-mono text-xs">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      u.role === 'ORG_ADMIN' 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                        : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                    }`}>
                      {u.role}
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                      u.status === 'ACTIVE'
                        ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                        : 'text-amber-600 dark:text-amber-400 bg-amber-500/10'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                      {u.status}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                    {u.lastLoginAt || 'Pending First Login'}
                  </td>

                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                    {u.createdAt}
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <button className="text-slate-400 hover:text-slate-800 dark:hover:text-white p-1">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Modal */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Invite Team Member</h3>
              <button onClick={() => setIsInviteOpen(false)} className="text-slate-400 hover:text-slate-800 dark:hover:text-white text-xs">✕</button>
            </div>

            <form onSubmit={handleInvite} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Corporate Email Address</label>
                <input 
                  type="email"
                  required
                  placeholder="engineer@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full h-8 px-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Assigned Role</label>
                <select 
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  className="w-full h-8 px-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="END_USER">END_USER (QA Engineer / Developer)</option>
                  <option value="ORG_ADMIN">ORG_ADMIN (Organization Administrator)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="h-8 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm shadow-blue-500/30"
                >
                  Issue Invitation Token
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
