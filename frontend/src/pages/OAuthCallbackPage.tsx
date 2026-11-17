import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

export const OAuthCallbackPage: React.FC = () => {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Completing OAuth authorization with Salesforce...');

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('code');
    const error = searchParams.get('error') || searchParams.get('error_description');

    if (error) {
      setStatus('error');
      setMessage(`Authorization failed: ${error}`);
      if (window.opener) {
        window.opener.postMessage(
          { type: 'SALESFORCE_AUTH_CODE', error },
          window.location.origin
        );
        setTimeout(() => window.close(), 2500);
      }
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('No authorization code was returned by Salesforce.');
      return;
    }

    setStatus('success');
    setMessage('Authorization code received! Finalizing session and returning to AssertNow...');

    if (window.opener) {
      window.opener.postMessage(
        { type: 'SALESFORCE_AUTH_CODE', code },
        window.location.origin
      );
      setTimeout(() => {
        window.close();
      }, 800);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
      <div className="w-full max-w-sm p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col items-center space-y-4">
        {status === 'processing' && (
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {status === 'success' && (
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
        )}

        {status === 'error' && (
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-rose-400" />
          </div>
        )}

        <h2 className="text-sm font-bold text-white tracking-tight">
          Salesforce Authorization
        </h2>

        <p className="text-xs text-slate-400 leading-relaxed">
          {message}
        </p>

        {status === 'success' && (
          <span className="text-[10px] font-mono text-slate-500">
            This popup window will close automatically...
          </span>
        )}
      </div>
    </div>
  );
};

