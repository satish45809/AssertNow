/**
 * ConnectionProvider
 * Global Salesforce connection state powered by GET /api/salesforce/status.
 * Persists across page reloads — the backend PostgreSQL DB is the single source of truth.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ApiClient } from '@/api/ApiClient';
import type { ConnectionStatus, ConnectRequest, TestQueryResponse } from '@/types/api';

// ── Context Shape ────────────────────────────────────────────────────────────

interface ConnectionContextValue {
  /** Current connection status from the backend */
  status: ConnectionStatus;
  /** Whether there is an active, authenticated Salesforce connection */
  isConnected: boolean;
  /** True while the initial GET /status call is in-flight */
  isLoading: boolean;
  /** Re-fetch status from backend */
  refreshStatus: () => Promise<void>;
  /** POST /api/salesforce/connect */
  connect: (req: ConnectRequest) => Promise<ConnectionStatus>;
  /** POST /api/salesforce/disconnect */
  disconnect: () => Promise<void>;
  /** GET /api/salesforce/test-query */
  testQuery: () => Promise<TestQueryResponse>;
}

const defaultStatus: ConnectionStatus = {
  isConnected: false,
  connectionId: null,
  name: null,
  myDomain: null,
  instanceUrl: null,
  tokenExpiresAt: null,
};

const ConnectionContext = createContext<ConnectionContextValue>({
  status: defaultStatus,
  isConnected: false,
  isLoading: true,
  refreshStatus: async () => {},
  connect: async () => defaultStatus,
  disconnect: async () => {},
  testQuery: async () => ({ success: false, records: [] }),
});

// ── Provider ─────────────────────────────────────────────────────────────────

export const ConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<ConnectionStatus>(defaultStatus);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  const refreshStatus = useCallback(async () => {
    try {
      // GET /api/salesforce/status → { success, data: ConnectionStatus }
      // ApiClient strips the wrapper and returns `data` directly
      const data = await ApiClient.get<ConnectionStatus>('/status');
      if (mountedRef.current) {
        setStatus(data || defaultStatus);
      }
    } catch {
      if (mountedRef.current) {
        setStatus(defaultStatus);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    mountedRef.current = true;
    refreshStatus();
    return () => { mountedRef.current = false; };
  }, [refreshStatus]);

  const connect = useCallback(async (req: ConnectRequest): Promise<ConnectionStatus> => {
    // POST /api/salesforce/connect → { success, message, data: ConnectionStatus }
    // ApiClient returns `data` (the ConnectionStatus)
    const data = await ApiClient.post<ConnectionStatus>('/connect', req);
    if (mountedRef.current) {
      setStatus(data || defaultStatus);
    }
    return data;
  }, []);

  const disconnect = useCallback(async () => {
    await ApiClient.post('/disconnect');
    if (mountedRef.current) {
      setStatus(defaultStatus);
    }
  }, []);

  const testQuery = useCallback(async (): Promise<TestQueryResponse> => {
    const res = await ApiClient.get<TestQueryResponse>('/test-query');
    return res;
  }, []);

  const value: ConnectionContextValue = {
    status,
    isConnected: Boolean(status.isConnected),
    isLoading,
    refreshStatus,
    connect,
    disconnect,
    testQuery,
  };

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
};

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useConnection() {
  return useContext(ConnectionContext);
}
