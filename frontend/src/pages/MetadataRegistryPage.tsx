import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Database, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  Layers, 
  Table, 
  ArrowRight, 
  Key, 
  Sparkles,
  Link2,
  Box,
  SlidersHorizontal
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { SalesforceApi } from '@/api/SalesforceApi';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { IntegrationEnvironment } from '@/types';

interface SObjectDescriptor {
  name: string;
  label: string;
  custom: boolean;
  queryable: boolean;
  createable: boolean;
  fieldsCount: number;
  fields: Array<{
    name: string;
    label: string;
    type: string;
    required: boolean;
    length?: number;
    picklistValues?: string[];
    referenceTo?: string[];
    custom?: boolean;
  }>;
}

interface DiscoveredSObject {
  name: string;
  label: string;
  custom: boolean;
  keyPrefix?: string;
  queryable?: boolean;
  createable?: boolean;
  updateable?: boolean;
  deletable?: boolean;
}

export const MetadataRegistryPage: React.FC = () => {
  const [environments, setEnvironments] = useState<IntegrationEnvironment[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState<string>('');
  
  // Dynamic SObjects loaded live from Salesforce Org
  const [availableObjects, setAvailableObjects] = useState<DiscoveredSObject[]>([]);
  const [selectedObjectName, setSelectedObjectName] = useState<string>('Account');
  const [schema, setSchema] = useState<SObjectDescriptor | null>(null);
  
  const [isLoadingEnvs, setIsLoadingEnvs] = useState(true);
  const [isLoadingObjects, setIsLoadingObjects] = useState(false);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'STANDARD' | 'CUSTOM'>('ALL');
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);

  // Load environments on mount
  useEffect(() => {
    setIsLoadingEnvs(true);
    SalesforceApi.getEnvironments()
      .then(envs => {
        setEnvironments(envs);
        if (envs.length > 0) {
          setSelectedEnvId(envs[0].id);
        }
      })
      .catch(err => setError(err))
      .finally(() => setIsLoadingEnvs(false));
  }, []);

  // Fetch all live SObjects directly from Salesforce describeGlobal API
  const fetchLiveSObjects = useCallback(async (envId: string) => {
    if (!envId) return;
    setIsLoadingObjects(true);
    try {
      const result = await SalesforceApi.listSObjects(envId);
      const sobjects = result?.sobjects || [];
      setAvailableObjects(sobjects);

      // If currently selected object doesn't exist, default to 'Account' or first object
      if (sobjects.length > 0) {
        const hasCurrent = sobjects.some(s => s.name === selectedObjectName);
        if (!hasCurrent) {
          const hasAccount = sobjects.find(s => s.name === 'Account');
          setSelectedObjectName(hasAccount ? hasAccount.name : sobjects[0].name);
        }
      }
    } catch (err: any) {
      console.error('Failed to query live SObjects:', err);
      // We do not fallback to hardcoded mock arrays!
    } finally {
      setIsLoadingObjects(false);
    }
  }, [selectedObjectName]);

  // When selected environment changes, fetch its live SObjects
  useEffect(() => {
    if (selectedEnvId) {
      fetchLiveSObjects(selectedEnvId);
    }
  }, [selectedEnvId, fetchLiveSObjects]);

  // Fetch SObject schema whenever selectedEnvId or selectedObjectName changes
  const fetchSchema = useCallback(async (isRefresh = false) => {
    if (!selectedEnvId || !selectedObjectName) return;
    if (isRefresh) {
      setIsSyncing(true);
    } else {
      setIsLoadingSchema(true);
    }
    setError(null);
    setSyncSuccessMessage(null);

    try {
      const data = await SalesforceApi.describeSObject(selectedEnvId, selectedObjectName);
      setSchema(data);
      if (isRefresh) {
        setSyncSuccessMessage(`Synchronized ${data.fields?.length || 0} fields from Salesforce live metadata successfully.`);
        setTimeout(() => setSyncSuccessMessage(null), 4000);
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoadingSchema(false);
      setIsSyncing(false);
    }
  }, [selectedEnvId, selectedObjectName]);

  useEffect(() => {
    if (selectedEnvId && selectedObjectName) {
      fetchSchema(false);
    }
  }, [selectedEnvId, selectedObjectName, fetchSchema]);

  // Filter objects dynamically based on category and search query
  const filteredObjects = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return availableObjects.filter(obj => {
      // Category filter
      if (categoryFilter === 'STANDARD' && obj.custom) return false;
      if (categoryFilter === 'CUSTOM' && !obj.custom) return false;

      // Search filter
      if (!q) return true;
      return (
        obj.label?.toLowerCase().includes(q) ||
        obj.name?.toLowerCase().includes(q)
      );
    });
  }, [availableObjects, categoryFilter, searchQuery]);

  // Filter fields based on search query
  const filteredFields = useMemo(() => {
    if (!schema?.fields) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return schema.fields;
    return schema.fields.filter(f => 
      f.name?.toLowerCase().includes(q) ||
      f.label?.toLowerCase().includes(q)
    );
  }, [schema, searchQuery]);

  // Counts for category badges
  const counts = useMemo(() => {
    const total = availableObjects.length;
    const custom = availableObjects.filter(s => s.custom).length;
    const standard = total - custom;
    return { total, standard, custom };
  }, [availableObjects]);

  return (
    <div className="flex flex-col min-h-full">
      <Header 
        title="Metadata Registry" 
        subtitle="Explore live Salesforce SObject schemas, data dictionaries, and field definitions"
        badge={availableObjects.length > 0 ? `${availableObjects.length} Live SObjects` : undefined}
      />

      <div className="p-6 space-y-5">
        {syncSuccessMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{syncSuccessMessage}</span>
          </div>
        )}

        {/* Environment & Object Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-slate-700 dark:text-slate-400 font-semibold pl-1 whitespace-nowrap">Target Org:</span>
            <select 
              value={selectedEnvId} 
              onChange={(e) => setSelectedEnvId(e.target.value)}
              disabled={isLoadingEnvs || environments.length === 0}
              className="h-9 px-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:border-blue-500"
            >
              {environments.map(env => (
                <option key={env.id} value={env.id}>
                  {env.name} ({env.platform.toUpperCase()})
                </option>
              ))}
              {environments.length === 0 && (
                <option value="">No connected environments</option>
              )}
            </select>
          </div>

          <button 
            disabled={isSyncing || isLoadingSchema || !selectedEnvId}
            onClick={() => {
              if (selectedEnvId) {
                fetchLiveSObjects(selectedEnvId);
                fetchSchema(true);
              }
            }}
            title="Refresh schemas directly from Salesforce live metadata"
            className="h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm shadow-blue-500/20 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync SObject Schema'}
          </button>

          <span className="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>

          <div className="relative flex-1 w-full sm:w-auto">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder={`Search across ${availableObjects.length > 0 ? availableObjects.length : ''} live Salesforce SObjects or fields...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>
        </div>

        {error ? (
          <ErrorState 
            error={error} 
            onRetry={() => fetchSchema(false)} 
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Live Objects Sidebar List */}
            <div className="lg:col-span-1 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 p-3 space-y-3 shadow-sm flex flex-col h-[750px]">
              <div className="text-[10px] font-mono font-bold text-slate-500 uppercase px-1 flex items-center justify-between">
                <span>Discovered SObjects</span>
                <span>({filteredObjects.length}{availableObjects.length > 0 ? ` / ${availableObjects.length}` : ''})</span>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg text-[10px] font-mono">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('ALL')}
                  className={`flex-1 py-1 rounded-md text-center transition-all ${
                    categoryFilter === 'ALL'
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-bold shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                  }`}
                >
                  All ({counts.total})
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('STANDARD')}
                  className={`flex-1 py-1 rounded-md text-center transition-all ${
                    categoryFilter === 'STANDARD'
                      ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-bold shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                  }`}
                >
                  Std ({counts.standard})
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('CUSTOM')}
                  className={`flex-1 py-1 rounded-md text-center transition-all ${
                    categoryFilter === 'CUSTOM'
                      ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 font-bold shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                  }`}
                >
                  Custom ({counts.custom})
                </button>
              </div>

              {/* Scrollable SObjects List */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-1 scrollbar-thin">
                {isLoadingObjects ? (
                  <div className="text-center py-10 text-xs text-slate-500 space-y-2">
                    <RefreshCw className="w-4 h-4 mx-auto animate-spin text-blue-500" />
                    <div>Querying live Salesforce Org metadata...</div>
                  </div>
                ) : filteredObjects.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-400 font-mono">
                    {availableObjects.length === 0 
                      ? 'No SObjects returned from Salesforce Org.' 
                      : 'No objects match your filter.'}
                  </div>
                ) : (
                  filteredObjects.map(obj => (
                    <button
                      key={obj.name}
                      onClick={() => setSelectedObjectName(obj.name)}
                      className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex items-center justify-between ${
                        selectedObjectName === obj.name
                          ? 'bg-blue-600/10 dark:bg-blue-600/15 border border-blue-500/30 text-blue-600 dark:text-white font-semibold'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-400 border border-transparent'
                      }`}
                    >
                      <div className="truncate pr-2">
                        <div className="font-semibold text-slate-900 dark:text-white truncate">{obj.label || obj.name}</div>
                        <div className="text-[10px] font-mono text-slate-500 truncate">{obj.name}</div>
                      </div>
                      {obj.custom && (
                        <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex-shrink-0">
                          CUSTOM
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Object Detail & Fields Table */}
            <div className="lg:col-span-3 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 p-6 space-y-6 shadow-sm min-h-[750px] flex flex-col">
              {isLoadingSchema ? (
                <div className="my-auto">
                  <LoadingState 
                    message={`Describing SObject "${selectedObjectName}"...`} 
                    submessage="Invoking Salesforce Metadata API via JSforce adapter" 
                  />
                </div>
              ) : schema ? (
                <>
                  {/* Object Header Info */}
                  <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">{schema.label || selectedObjectName}</h2>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-semibold">
                          {schema.name || selectedObjectName}
                        </span>
                        {schema.custom && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-semibold">
                            Custom Object
                          </span>
                        )}
                        {schema.queryable && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                            Queryable
                          </span>
                        )}
                        {schema.createable && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-semibold">
                            Createable
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        Direct JSforce live introspection from connected environment: {selectedEnvId}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold whitespace-nowrap">
                        {schema.fields?.length || 0} Fields Discovered
                      </span>
                    </div>
                  </div>

                  {/* Fields Table */}
                  <div className="flex-1 flex flex-col">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-2.5 flex items-center gap-1.5">
                      <Table className="w-3.5 h-3.5 text-blue-500" />
                      Field Definitions & Attributes ({filteredFields.length})
                    </h3>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm flex-1">
                      <div className="max-h-[560px] overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-700 dark:text-slate-400 font-mono text-[11px] border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                            <tr>
                              <th className="py-2.5 px-3 font-semibold">Field Label</th>
                              <th className="py-2.5 px-3 font-semibold">API Name</th>
                              <th className="py-2.5 px-3 font-semibold">Data Type</th>
                              <th className="py-2.5 px-3 font-semibold text-center">Required</th>
                              <th className="py-2.5 px-3 font-semibold">Picklist / Reference</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900/30">
                            {filteredFields.map((field, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                                  {field.label}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-blue-600 dark:text-blue-400 text-[11px] font-medium">
                                  {field.name}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px]">
                                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                    {field.type}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {field.required ? (
                                    <span className="text-[10px] font-mono text-rose-600 dark:text-rose-400 font-bold px-1.5 py-0.5 rounded bg-rose-500/10">YES</span>
                                  ) : (
                                    <span className="text-[10px] font-mono text-slate-400">NO</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 text-[11px]">
                                  {field.picklistValues && field.picklistValues.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 max-w-[280px]">
                                      {field.picklistValues.slice(0, 3).map((val, i) => (
                                        <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                          {val}
                                        </span>
                                      ))}
                                      {field.picklistValues.length > 3 && (
                                        <span className="text-[9px] text-slate-400 font-mono">
                                          +{field.picklistValues.length - 3} more
                                        </span>
                                      )}
                                    </div>
                                  ) : field.referenceTo && field.referenceTo.length > 0 ? (
                                    <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400 text-[11px] font-mono font-medium">
                                      <Link2 className="w-3 h-3" />
                                      {field.referenceTo.join(', ')}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 dark:text-slate-600">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center my-auto py-12 text-slate-500 text-xs font-mono">
                  Select an SObject from the sidebar to inspect its field metadata.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
