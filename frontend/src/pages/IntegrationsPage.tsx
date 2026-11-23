import React, { useState } from 'react';
import {
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Key,
  KeyRound,
  Lock,
  Database,
  ShieldCheck,
  Activity,
  Globe,
  Server,
  Zap,
  Unplug,
  Loader2,
  Copy
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { useConnection } from '@/providers/ConnectionProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export const IntegrationsPage: React.FC = () => {
  const {
    status,
    isConnected,
    isLoading,
    refreshStatus,
    connect,
    disconnect,
    testQuery,
  } = useConnection();

  // Connect modal
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connectName, setConnectName] = useState('');
  const [connectDomain, setConnectDomain] = useState('');
  const [connectClientId, setConnectClientId] = useState('');
  const [connectClientSecret, setConnectClientSecret] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Test query
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; records?: any[]; error?: string } | null>(null);

  // Disconnect
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Toast/banner
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; title: string; description: string } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', title: string, description: string) => {
    setToast({ type, title, description });
    setTimeout(() => setToast(null), 5000);
  };

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectDomain || !connectClientId || !connectClientSecret) return;

    setIsConnecting(true);
    setConnectError(null);
    try {
      await connect({
        name: connectName || connectDomain,
        myDomain: connectDomain.trim(),
        clientId: connectClientId.trim(),
        clientSecret: connectClientSecret.trim(),
      });
      showToast('success', 'Connected!', `Successfully connected to ${connectName || connectDomain}`);
      setIsConnectModalOpen(false);
      resetConnectForm();
    } catch (err: any) {
      const msg = err?.message || 'Failed to connect to Salesforce.';
      setConnectError(msg);
      showToast('error', 'Connection Failed', msg);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await disconnect();
      setTestResult(null);
      showToast('info', 'Disconnected', 'Salesforce connection has been terminated.');
    } catch (err: any) {
      showToast('error', 'Disconnect Failed', err?.message || 'Could not disconnect.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleTestQuery = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testQuery();
      setTestResult({ success: true, records: res.records });
      showToast('success', 'Connection Verified', `Query returned ${res.records?.length || 0} record(s).`);
    } catch (err: any) {
      setTestResult({ success: false, error: err?.message || 'Query failed.' });
      showToast('error', 'Test Query Failed', err?.message || 'Could not execute test query.');
    } finally {
      setIsTesting(false);
    }
  };

  const resetConnectForm = () => {
    setConnectName('');
    setConnectDomain('');
    setConnectClientId('');
    setConnectClientSecret('');
    setConnectError(null);
  };

  // Format expiry time
  const formatExpiry = (expiresAt: string | null): string => {
    if (!expiresAt) return 'N/A';
    const exp = new Date(expiresAt);
    const now = new Date();
    const diffMs = exp.getTime() - now.getTime();
    if (diffMs <= 0) return 'Expired';
    const mins = Math.round(diffMs / 60000);
    if (mins < 60) return `${mins}m remaining`;
    const hrs = Math.round(mins / 60);
    return `${hrs}h remaining`;
  };

  return (
    <div className="flex flex-col min-h-full">
      <Header
        title="Salesforce Integrations"
        subtitle="Connect, monitor, and manage your Salesforce org connection"
        actions={
          <Button
            size="sm"
            onClick={() => setIsConnectModalOpen(true)}
            className="font-mono text-xs h-8 gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            {isConnected ? 'Reconnect' : 'Connect Org'}
          </Button>
        }
      />

      {/* Toast Banner */}
      {toast && (
        <div className={`mx-6 mt-4 p-3 rounded-xl border flex items-start gap-3 animate-in fade-in slide-in-from-top-2 ${
          toast.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800' :
          toast.type === 'error' ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800' :
          'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" /> :
           toast.type === 'error' ? <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 flex-shrink-0" /> :
           <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />}
          <div className="min-w-0">
            <p className={`text-xs font-bold ${
              toast.type === 'success' ? 'text-emerald-800 dark:text-emerald-300' :
              toast.type === 'error' ? 'text-rose-800 dark:text-rose-300' :
              'text-blue-800 dark:text-blue-300'
            }`}>{toast.title}</p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">{toast.description}</p>
          </div>
          <button onClick={() => setToast(null)} className="ml-auto text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer flex-shrink-0">✕</button>
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[300px]">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mb-2" />
            <span className="text-xs text-slate-500 font-mono">Checking backend connection status...</span>
          </div>
        ) : (
          <>
            {/* ── Connection Status Card ─────────────────────────────────── */}
            <Card className="p-0 overflow-hidden border-2 transition-colors
              ${isConnected ? 'border-emerald-200 dark:border-emerald-800/60' : 'border-slate-200 dark:border-slate-800'}
            ">
              {/* Status Header */}
              <div className={`px-6 py-5 flex items-center justify-between ${
                isConnected
                  ? 'bg-gradient-to-r from-emerald-50 to-green-50/50 dark:from-emerald-950/40 dark:to-green-950/20'
                  : 'bg-gradient-to-r from-slate-50 to-slate-50/50 dark:from-slate-900 dark:to-slate-900/50'
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    isConnected
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}>
                    {isConnected ? <ShieldCheck className="w-6 h-6" /> : <Unplug className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        {isConnected ? status.name || 'Salesforce Org' : 'No Active Connection'}
                      </h2>
                      <Badge variant={isConnected ? 'default' : 'secondary'} className={`text-[10px] font-mono ${
                        isConnected ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' : ''
                      }`}>
                        {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                      {isConnected ? (status.instanceUrl || status.myDomain || 'Salesforce Cloud') : 'Connect a Salesforce org to begin.'}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  {isConnected && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTestQuery}
                        disabled={isTesting}
                        className="font-mono text-xs h-8 gap-1.5"
                      >
                        {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                        {isTesting ? 'Testing...' : 'Test Connection'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDisconnect}
                        disabled={isDisconnecting}
                        className="font-mono text-xs h-8 gap-1.5 text-rose-600 hover:text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      >
                        {isDisconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unplug className="w-3.5 h-3.5" />}
                        {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                      </Button>
                    </>
                  )}
                  {!isConnected && (
                    <Button
                      size="sm"
                      onClick={() => setIsConnectModalOpen(true)}
                      className="font-mono text-xs h-8 gap-1.5"
                    >
                      <Key className="w-3.5 h-3.5" />
                      Connect Salesforce Org
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refreshStatus()}
                    className="font-mono text-xs h-8 gap-1.5"
                    title="Refresh connection status from backend"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Connection Details Grid */}
              {isConnected && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-100 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800">
                  {[
                    { label: 'Connection ID', value: `#${status.connectionId}`, icon: Database },
                    { label: 'My Domain', value: status.myDomain || 'N/A', icon: Globe },
                    { label: 'Instance URL', value: status.instanceUrl || 'N/A', icon: Server },
                    { label: 'Token Expires', value: formatExpiry(status.tokenExpiresAt), icon: Lock },
                  ].map((item, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-900/80 px-5 py-4">
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 uppercase font-mono font-semibold mb-1.5">
                        <item.icon className="w-3 h-3" />
                        {item.label}
                      </div>
                      <p className="text-xs font-mono font-medium text-slate-800 dark:text-slate-200 truncate" title={item.value}>
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* ── Disconnection Warning ──────────────────────────────────── */}
            {!isConnected && (
              <Card className="p-5 border-dashed border-2 border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-950/20">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200">No Salesforce Org Connected</h3>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 leading-relaxed">
                      Salesforce metadata discovery, record CRUD operations, and workflow execution are <strong>disabled</strong> until
                      you connect an org. Click <strong>"Connect Salesforce Org"</strong> above to authenticate via OAuth 2.0 Client Credentials.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* ── Test Query Result Card ─────────────────────────────────── */}
            {testResult && (
              <Card className={`p-5 border ${
                testResult.success ? 'border-emerald-200 dark:border-emerald-800/60' : 'border-rose-200 dark:border-rose-800/60'
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  )}
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {testResult.success ? 'Test Query Successful' : 'Test Query Failed'}
                  </h3>
                  <span className="text-[10px] font-mono text-slate-500">SELECT Id, Name, Type FROM Account LIMIT 3</span>
                </div>
                {testResult.success && testResult.records && testResult.records.length > 0 ? (
                  <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-xs font-mono">
                      <thead className="bg-slate-50 dark:bg-slate-900">
                        <tr>
                          {Object.keys(testResult.records[0]).filter(k => k !== 'attributes').map(key => (
                            <th key={key} className="text-left px-3 py-2 text-[10px] font-bold text-slate-500 uppercase">{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {testResult.records.map((rec: any, idx: number) => (
                          <tr key={idx} className="border-t border-slate-100 dark:border-slate-800">
                            {Object.entries(rec).filter(([k]) => k !== 'attributes').map(([k, v]) => (
                              <td key={k} className="px-3 py-2 text-slate-700 dark:text-slate-300">{String(v ?? '')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : testResult.error ? (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-mono p-3 bg-rose-50 dark:bg-rose-950/30 rounded-lg">{testResult.error}</p>
                ) : (
                  <p className="text-xs text-slate-500 font-mono">No records returned.</p>
                )}
              </Card>
            )}

            {/* ── Integration Info ────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  icon: Lock,
                  title: 'OAuth 2.0 Client Credentials',
                  desc: 'Secure server-to-server authentication. No user interaction required after initial setup.',
                  color: 'blue',
                },
                {
                  icon: Database,
                  title: 'PostgreSQL Persistence',
                  desc: 'Connection credentials & tokens stored securely in the Assert_Now database, surviving server restarts.',
                  color: 'emerald',
                },
                {
                  icon: Activity,
                  title: 'Auto Token Refresh',
                  desc: 'Expired tokens are automatically refreshed via the backend before every Salesforce API call.',
                  color: 'purple',
                },
              ].map((info, idx) => (
                <Card key={idx} className="p-4 space-y-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${info.color}-500/10`}>
                    <info.icon className={`w-4 h-4 text-${info.color}-600 dark:text-${info.color}-400`} />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">{info.title}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{info.desc}</p>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Connect Modal ────────────────────────────────────────────────── */}
      <Dialog open={isConnectModalOpen} onOpenChange={(open) => { setIsConnectModalOpen(open); if (!open) resetConnectForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Key className="w-4 h-4 text-blue-500" />
              Connect Salesforce Org
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Enter your Salesforce Connected App credentials (OAuth 2.0 Client Credentials flow).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConnect} className="space-y-4 mt-2">
            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                Connection Name
              </label>
              <Input
                type="text"
                placeholder="e.g., Dev Sandbox Org"
                value={connectName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConnectName(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                My Domain URL <span className="text-rose-500">*</span>
              </label>
              <Input
                type="url"
                placeholder="https://your-domain.my.salesforce.com"
                value={connectDomain}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConnectDomain(e.target.value)}
                required
                className="h-9 text-sm font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                Client ID <span className="text-rose-500">*</span>
              </label>
              <Input
                type="text"
                placeholder="Connected App Consumer Key"
                value={connectClientId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConnectClientId(e.target.value)}
                required
                className="h-9 text-sm font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                Client Secret <span className="text-rose-500">*</span>
              </label>
              <Input
                type="password"
                placeholder="Connected App Consumer Secret"
                value={connectClientSecret}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConnectClientSecret(e.target.value)}
                required
                className="h-9 text-sm font-mono"
              />
            </div>

            {connectError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 flex items-start gap-2">
                <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-rose-700 dark:text-rose-300">{connectError}</p>
              </div>
            )}

            <div className="flex items-center gap-2 justify-end pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setIsConnectModalOpen(false); resetConnectForm(); }}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isConnecting || !connectDomain || !connectClientId || !connectClientSecret}
                className="text-xs gap-1.5"
              >
                {isConnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                {isConnecting ? 'Connecting...' : 'Connect'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
