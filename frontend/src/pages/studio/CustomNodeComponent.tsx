import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { 
  Play, 
  Flag, 
  Clock, 
  CheckCircle2, 
  Search, 
  AlertCircle, 
  Loader2, 
  Plus, 
  Trash2, 
  RefreshCw, 
  GitBranch, 
  ArrowLeftRight, 
  AlertTriangle, 
  Zap, 
  AlertOctagon, 
  Cloud, 
  Layers, 
  Sparkles,
  Repeat
} from 'lucide-react';

export const CustomNodeComponent = memo(({ id, data, selected }: any) => {
  const { label, nodeType, platform, status, config, hasFaultPath, onDeleteNode } = data;

  const isRunning = status === 'running';
  const isPassed = status === 'passed';
  const isFailed = status === 'failed';
  const isSkipped = status === 'skipped';

  // 1. SLEEK ENTERPRISE SALESFORCE-STYLE START NODE
  if (nodeType === 'START') {
    const isDefaultLabel = !label || label === 'Workflow Trigger' || label === 'START' || label === 'Start';
    const displayTitle = isDefaultLabel ? 'Start' : label;
    
    let triggerSubtitle = 'Record-Triggered Flow · On-Demand';
    if (config?.detail) {
      triggerSubtitle = config.detail;
    } else if (config?.triggerType === 'TRIGGER_RECORD' || config?.triggerType === 'RECORD_CHANGE') {
      triggerSubtitle = `${config?.object || 'Account'} · Created or Updated`;
    } else if (config?.triggerType === 'TRIGGER_SCHEDULE' || config?.triggerType === 'SCHEDULED') {
      triggerSubtitle = 'Schedule-Triggered Flow';
    } else if (config?.triggerType === 'TRIGGER_WEBHOOK' || config?.triggerType === 'WEBHOOK') {
      triggerSubtitle = 'Autolaunched Flow · Webhook';
    }

    const isSkipped = status === 'skipped';

    return (
      <div className={`w-[260px] rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer select-none bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 ${
        isRunning ? '!border-sky-500 ring-4 ring-sky-500/30 shadow-lg shadow-sky-500/20 animate-pulse' :
        isPassed ? '!border-emerald-500 ring-2 ring-emerald-500/25' :
        isFailed ? '!border-rose-500 ring-4 ring-rose-500/30 shadow-md shadow-rose-500/20' :
        isSkipped ? 'opacity-40 grayscale' :
        selected ? 'ring-2 ring-emerald-500/40 border-emerald-500 shadow-emerald-500/10' : ''
      }`}>
        <div className="p-3">
          <div className="flex items-center justify-between gap-1 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Zap className="w-2.5 h-2.5 fill-current text-emerald-500" />
              START
            </span>
            <div className="flex items-center gap-1">
              {isRunning && (
                <span className="flex items-center gap-1 text-[8.5px] font-mono font-bold text-sky-600 dark:text-sky-400">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  ACTIVE
                </span>
              )}
              {isPassed && (
                <span className="flex items-center gap-1 text-[8.5px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  TRIGGERED
                </span>
              )}
              <span className="text-[9px] font-mono font-semibold text-slate-400 dark:text-slate-500">
                TRIGGER
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-sm shadow-emerald-500/30 flex-shrink-0">
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-bold leading-tight truncate text-slate-900 dark:text-white" title={displayTitle}>
                {displayTitle}
              </h3>
              <p className="text-[9.5px] font-mono truncate text-slate-500 dark:text-slate-400 mt-0.5">
                {triggerSubtitle}
              </p>
            </div>
          </div>
        </div>

        <Handle 
          type="source" 
          position={Position.Bottom} 
          id="bottom"
          className="!w-2 !h-2 !rounded-full !bg-emerald-500 !border-0 -bottom-1 left-1/2 -translate-x-1/2 opacity-40 group-hover:opacity-100 hover:scale-150 transition-all z-10 cursor-pointer"
        />
        <Handle 
          type="source" 
          position={Position.Right} 
          id="right"
          className="!w-2 !h-2 !rounded-full !bg-slate-400 !border-0 -right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 hover:scale-150 transition-all z-10 cursor-pointer"
        />
      </div>
    );
  }

  // 2. SLEEK ENTERPRISE SALESFORCE-STYLE END NODE
  if (nodeType === 'END') {
    const isFault = config?.isFault || label?.toLowerCase().includes('fault') || label?.toLowerCase().includes('fail');
    const isDefaultLabel = !label || label.includes('Regression Complete') || label === 'END' || label === 'End';
    const displayTitle = isFault ? 'Fault End' : (isDefaultLabel ? 'End' : label);
    const subtitle = isFault ? 'Flow Execution Aborted' : 'Flow Ends';

    const isSkipped = status === 'skipped';

    return (
      <div className={`w-[260px] rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer select-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 ${
        isFailed || (isFault && isPassed)
          ? '!border-rose-500 !border-t-rose-600 ring-4 ring-rose-500/25 shadow-md shadow-rose-500/10' 
          : isRunning
          ? '!border-sky-500 ring-4 ring-sky-500/30 shadow-lg shadow-sky-500/20 animate-pulse'
          : isPassed
          ? '!border-emerald-500 ring-2 ring-emerald-500/25'
          : isSkipped
          ? 'opacity-40 grayscale border-slate-200 dark:border-slate-800'
          : isFault 
          ? 'border-rose-500/60 ring-2 ring-rose-500/20' 
          : 'border-slate-300 dark:border-slate-700'
      } ${
        selected ? 'ring-2 ring-blue-500/30 border-blue-500' : ''
      }`}>
        <Handle 
          type="target" 
          position={Position.Top} 
          id="top"
          className={`!w-2 !h-2 !rounded-full !border-0 ${
            isFault ? '!bg-rose-500' : '!bg-slate-400 dark:!bg-slate-500'
          } -top-1 left-1/2 -translate-x-1/2 opacity-40 group-hover:opacity-100 hover:scale-150 transition-all z-10 cursor-pointer`}
        />
        <Handle 
          type="target" 
          position={Position.Left} 
          id="left"
          className={`!w-2 !h-2 !rounded-full !border-0 ${
            isFault ? '!bg-rose-500' : '!bg-slate-400 dark:!bg-slate-500'
          } -left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 hover:scale-150 transition-all z-10 cursor-pointer`}
        />

        <div className="p-3">
          <div className="flex items-center justify-between gap-1 mb-2">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase ${
              isFault 
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}>
              {isFault ? <AlertOctagon className="w-2.5 h-2.5" /> : <CheckCircle2 className="w-2.5 h-2.5 text-slate-500 dark:text-slate-400" />}
              {isFault ? 'FAULT' : 'END'}
            </span>
            <div className="flex items-center gap-1">
              {isRunning && (
                <span className="flex items-center gap-1 text-[8.5px] font-mono font-bold text-sky-600 dark:text-sky-400">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  ACTIVE
                </span>
              )}
              {isPassed && (
                <span className="flex items-center gap-1 text-[8.5px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  REACHED
                </span>
              )}
              <span className="text-[9px] font-mono font-semibold text-slate-400 dark:text-slate-500">
                {isFault ? 'TERMINAL' : 'COMPLETE'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
              isFault 
                ? 'bg-rose-500 text-white shadow-rose-500/25' 
                : 'bg-slate-800 text-white dark:bg-slate-700'
            }`}>
              {isFault ? <AlertOctagon className="w-4 h-4" /> : <Flag className="w-3.5 h-3.5 fill-current text-white dark:text-slate-200" />}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-bold leading-tight truncate text-slate-900 dark:text-white" title={displayTitle}>
                {displayTitle}
              </h3>
              <p className="text-[9.5px] font-mono truncate text-slate-500 dark:text-slate-400 mt-0.5">
                {subtitle}
              </p>
            </div>
            {isFault && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (data?.onDeleteNode) data.onDeleteNode(id);
                }}
                className="w-5 h-5 rounded hover:bg-rose-100 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 transition-colors flex items-center justify-center cursor-pointer ml-0.5"
                title="Delete Fault Terminal"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 3. RESPONSIVE, LUMINOUS EXECUTIVE ENTERPRISE CARDS (NEVER PITCH BLACK)
  let visualDef = {
    category: 'CREATE RECORDS',
    accentBorder: 'border-t-sky-500',
    dotColor: 'bg-sky-500',
    iconColor: 'text-sky-600 dark:text-sky-400',
    iconBg: 'bg-sky-50 dark:bg-sky-950/70 border-sky-200 dark:border-sky-800',
    subSnippet: '✦ DML Insert: Account (Standard Object)',
    detailTag: 'Account · 3 fields mapped',
    Icon: Plus
  };

  switch (nodeType) {
    case 'CREATE':
    case 'SF_CREATE':
    case 'NS_CREATE': {
      const objName = config?.customObject || config?.object || 'Account';
      const fields = config?.fields || {};
      const fieldCount = config?.fieldList ? config.fieldList.length : Object.keys(fields).length;
      visualDef = {
        category: 'CREATE RECORDS',
        accentBorder: 'border-t-sky-500',
        dotColor: 'bg-sky-500',
        iconColor: 'text-sky-600 dark:text-sky-400',
        iconBg: 'bg-sky-50 dark:bg-sky-950/70 border-sky-200 dark:border-sky-800',
        subSnippet: `✦ Insert into ${objName} (DML)`,
        detailTag: `${objName} · ${fieldCount} field${fieldCount === 1 ? '' : 's'}${config?.autoTeardown !== false ? ' · Rollback' : ''}`,
        Icon: Plus
      };
      break;
    }

    case 'GET':
    case 'GET_RECORDS':
    case 'NS_SEARCH':
    case 'SF_QUERY': {
      const rec = config?.object || config?.recordType || 'Opportunity';
      const rawFilters = Array.isArray(config?.filters) ? config.filters : (Array.isArray(config?.conditions) ? config.conditions : []);
      const filterCount = rawFilters.length;
      const isFirst = Boolean(config?.onlyFirstRecord || config?.storeCount === 'FIRST');
      const storageType = isFirst ? 'Single' : 'Collecti...';
      const detail = `${rec} · ${filterCount} filter${filterCount === 1 ? '' : 's'} · ${storageType}`;
      visualDef = {
        category: 'GET RECORDS',
        accentBorder: 'border-t-emerald-500',
        dotColor: 'bg-emerald-500',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        iconBg: 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800',
        subSnippet: `🔍 Query ${rec} (SOQL)`,
        detailTag: detail,
        Icon: Search
      };
      break;
    }

    case 'UPDATE':
    case 'UPDATE_RECORDS': {
      const objName = config?.object || 'Account';
      visualDef = {
        category: 'UPDATE RECORDS',
        accentBorder: 'border-t-blue-500',
        dotColor: 'bg-blue-500',
        iconColor: 'text-blue-600 dark:text-blue-400',
        iconBg: 'bg-blue-50 dark:bg-blue-950/70 border-blue-200 dark:border-blue-800',
        subSnippet: `↻ Sync_Status__c ➔ 'Synchronized'`,
        detailTag: `${objName} · DML Update`,
        Icon: RefreshCw
      };
      break;
    }

    case 'DELETE':
    case 'DELETE_RECORDS': {
      const objName = config?.object || 'Account';
      visualDef = {
        category: 'DELETE RECORDS',
        accentBorder: 'border-t-rose-500',
        dotColor: 'bg-rose-500',
        iconColor: 'text-rose-600 dark:text-rose-400',
        iconBg: 'bg-rose-50 dark:bg-rose-950/70 border-rose-200 dark:border-rose-800',
        subSnippet: `🗑️ Teardown test record from ${objName}`,
        detailTag: 'Rollback Cleanup',
        Icon: Trash2
      };
      break;
    }

    case 'DECISION':
    case 'ASSERTION': {
      visualDef = {
        category: 'DECISION / ASSERTION',
        accentBorder: 'border-t-purple-500',
        dotColor: 'bg-purple-500',
        iconColor: 'text-purple-600 dark:text-purple-400',
        iconBg: 'bg-purple-50 dark:bg-purple-950/70 border-purple-200 dark:border-purple-800',
        subSnippet: `🔀 Rules: companyName == Name [AND] exists`,
        detailTag: 'Parity vs Fault Split',
        Icon: GitBranch
      };
      break;
    }

    case 'ASSIGNMENT': {
      const varExp = config?.variable || 'varErrorSummary = "ERP Disparity"';
      visualDef = {
        category: 'ASSIGNMENT',
        accentBorder: 'border-t-amber-500',
        dotColor: 'bg-amber-500',
        iconColor: 'text-amber-600 dark:text-amber-400',
        iconBg: 'bg-amber-50 dark:bg-amber-950/70 border-amber-200 dark:border-amber-800',
        subSnippet: `📝 ${varExp.length > 34 ? varExp.slice(0, 34) + '...' : varExp}`,
        detailTag: 'Set Diagnostic Variables',
        Icon: ArrowLeftRight
      };
      break;
    }

    case 'LOOP': {
      const col = config?.collection || '{{records}}';
      visualDef = {
        category: 'LOOP',
        accentBorder: 'border-t-orange-500',
        dotColor: 'bg-orange-500',
        iconColor: 'text-orange-600 dark:text-orange-400',
        iconBg: 'bg-orange-50 dark:bg-orange-950/70 border-orange-200 dark:border-orange-800',
        subSnippet: `🔁 For Each in ${col}`,
        detailTag: 'Iterate Records Collection',
        Icon: Repeat
      };
      break;
    }

    case 'WAIT':
    case 'PAUSE': {
      const dur = config?.durationSeconds || 15;
      visualDef = {
        category: 'PAUSE / WAIT',
        accentBorder: 'border-t-slate-400 dark:border-t-slate-400',
        dotColor: 'bg-slate-400',
        iconColor: 'text-slate-600 dark:text-slate-300',
        iconBg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
        subSnippet: `⏳ ${dur}s buffer for async middleware queue`,
        detailTag: 'Middleware Sync Delay',
        Icon: Clock
      };
      break;
    }

    case 'ACTION': {
      visualDef = {
        category: 'EXTERNAL ACTION',
        accentBorder: 'border-t-cyan-500',
        dotColor: 'bg-cyan-500',
        iconColor: 'text-cyan-600 dark:text-cyan-400',
        iconBg: 'bg-cyan-50 dark:bg-cyan-950/70 border-cyan-200 dark:border-cyan-800',
        subSnippet: `⚡ Invocable: invokeSyncEngine()`,
        detailTag: 'Apex / SuiteTalk Action',
        Icon: Zap
      };
      break;
    }
  }

  const { category, accentBorder, dotColor, iconColor, iconBg, subSnippet, detailTag, Icon } = visualDef;

  return (
    <div className={`w-[260px] rounded-2xl border border-t-[3px] ${
      isFailed 
        ? '!border-rose-500 !border-t-rose-600 ring-4 ring-rose-500/25 shadow-md shadow-rose-500/10' 
        : isRunning
        ? '!border-sky-500 !border-t-sky-500 ring-4 ring-sky-500/30 shadow-lg shadow-sky-500/20 animate-pulse'
        : isPassed
        ? '!border-emerald-500/80 !border-t-emerald-500 ring-2 ring-emerald-500/20'
        : isSkipped
        ? 'opacity-40 grayscale border-slate-200 dark:border-slate-800'
        : accentBorder
    } transition-all duration-200 relative shadow-sm hover:shadow-lg cursor-pointer select-none group bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 ${
      selected 
        ? 'border-blue-500 ring-2 ring-blue-500/25 shadow-md shadow-blue-500/10' 
        : ''
    }`}>
      {/* Target Input Handle (Top Center - Standard Spine Entry) */}
      <Handle 
        type="target" 
        position={Position.Top} 
        id="top"
        className="!w-2 !h-2 !rounded-full !bg-slate-400 dark:!bg-slate-500 !border-0 -top-1 left-1/2 -translate-x-1/2 opacity-40 group-hover:opacity-100 hover:scale-150 transition-all z-10 cursor-pointer"
      />

      {/* Freeform Cross-Connect Handle (Left) */}
      <Handle 
        type="target" 
        position={Position.Left} 
        id="left"
        className="!w-2 !h-2 !rounded-full !bg-slate-400 dark:!bg-slate-500 !border-0 -left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 hover:scale-150 transition-all z-10 cursor-pointer"
      />

      <div className="p-3">
        {/* Top Header Row: Category Badge + Platform Pill + Live State */}
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
            <span className="text-[9px] font-mono font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
              {category}
            </span>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Live State Badges */}
            {isRunning && (
              <span className="flex items-center gap-1 text-[8.5px] font-mono font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/70 px-1.5 py-0.5 rounded border border-sky-200 dark:border-sky-800 animate-pulse">
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                RUNNING
              </span>
            )}
            {isPassed && (
              <span className="flex items-center gap-1 text-[8.5px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/70 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-2.5 h-2.5" />
                PASSED
              </span>
            )}
            {isFailed && (
              <span className="flex items-center gap-1 text-[8.5px] font-mono font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/70 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                <AlertOctagon className="w-2.5 h-2.5" />
                FAILED
              </span>
            )}
            {isSkipped && (
              <span className="flex items-center gap-1 text-[8.5px] font-mono font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                SKIPPED
              </span>
            )}
            {nodeType === 'LOOP' && data?.loopIteration && (
              <span className="flex items-center gap-1 text-[8.5px] font-mono font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/70 px-1.5 py-0.5 rounded border border-orange-200 dark:border-orange-800">
                <Repeat className="w-2.5 h-2.5 animate-spin" />
                {data.loopIteration}
              </span>
            )}

            {/* Platform Tag */}
            <span className="flex items-center gap-1 text-[8.5px] font-mono font-medium px-1.5 py-0.5 rounded border bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
              <Cloud className="w-2.5 h-2.5 text-sky-500" />
              Salesforce
            </span>

            {/* Visual Delete / Remove Step Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (data?.onDeleteNode) {
                  data.onDeleteNode(id);
                }
              }}
              className="w-4 h-4 rounded hover:bg-rose-100 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 transition-colors flex items-center justify-center cursor-pointer ml-0.5"
              title="Delete this step from workflow (✕)"
            >
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>

        {/* Card Main Title & Tactile Icon */}
        <div className="flex items-start gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center flex-shrink-0 shadow-xs mt-0.5">
            <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-semibold leading-snug truncate text-slate-900 dark:text-white" title={label}>
              {label}
            </h3>
            <div className="text-[9.5px] font-mono truncate text-slate-500 dark:text-slate-400 mt-0.5">
              {detailTag}
            </div>
          </div>
        </div>

        {/* High-Contrast SPEC Snippet Box */}
        <div className="mt-2 px-2 py-1 rounded-md border text-[9px] font-mono flex items-center justify-between gap-1 bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
          <span className="truncate">{subSnippet}</span>
          <span className="text-[7.5px] font-bold text-slate-400 uppercase flex-shrink-0">
            {nodeType === 'GET' || nodeType === 'GET_RECORDS' || nodeType === 'SF_QUERY' ? 'SOQL' : 'SPEC'}
          </span>
        </div>

        {/* Live Queried Record ID & Record Count Badge (e.g. ID: 006g... | 18) */}
        {(nodeType === 'GET' || nodeType === 'GET_RECORDS' || nodeType === 'SF_QUERY') && (data?.outputData?.record || (data?.outputData?.records && data.outputData.records.length > 0)) && (
          <div className="mt-1.5 px-2 py-1 rounded-md bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between text-[8.5px] font-mono text-emerald-800 dark:text-emerald-300">
            <span className="truncate">
              ID: {data.outputData.record?.Id || data.outputData.records[0]?.Id}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-200/80 dark:bg-emerald-900/80 text-emerald-900 dark:text-emerald-200 font-bold ml-1 shrink-0 text-[8px]">
              {data.outputData.totalSize !== undefined ? data.outputData.totalSize : data.outputData.records.length}
            </span>
          </div>
        )}

        {/* Error Alert Banner if failed */}
        {isFailed && data?.errorMessage && (
          <div className="mt-2 p-1.5 rounded-md bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-[8.5px] font-mono flex items-start gap-1">
            <AlertOctagon className="w-3 h-3 text-rose-500 flex-shrink-0 mt-0.5" />
            <span className="truncate">{data.errorMessage}</span>
          </div>
        )}

        {/* Decision Dual Outcome Ports (Salesforce Flow Builder Standard) */}
        {(nodeType === 'DECISION' || nodeType === 'ASSERTION') && (
          <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[9px] font-mono px-0.5">
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-xs" />
              <span>True ↓</span>
            </div>
            <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-semibold">
              <span>Default Outcome ➔</span>
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-xs" />
            </div>
          </div>
        )}

        {/* Loop Dual Outcome Ports (Salesforce Flow Builder Standard) */}
        {nodeType === 'LOOP' && (
          <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[9px] font-mono px-0.5">
            <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-xs" />
              <span>For Each ➔</span>
            </div>
            <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold">
              <span>After Last Item ↓</span>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-xs" />
            </div>
          </div>
        )}

        {/* Fault Path Badge if enabled */}
        {hasFaultPath && (
          <div className="mt-1.5 flex items-center justify-between text-[8.5px] font-mono text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900">
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5" />
              Fault Branch Attached
            </span>
            <span className="text-[7.5px] font-bold uppercase">Route ➔</span>
          </div>
        )}
      </div>

      {/* Decision-Specific Handles (Spine Alignment: True goes straight down center; Default goes right) */}
      {(nodeType === 'DECISION' || nodeType === 'ASSERTION') && (
        <>
          <Handle 
            type="source" 
            position={Position.Bottom} 
            id="outcome-true"
            title="True Branch (Continues Down Spine ↓)"
            className="!w-2.5 !h-2.5 !rounded-full !bg-emerald-500 !border-0 -bottom-1 left-1/2 -translate-x-1/2 opacity-80 group-hover:opacity-100 hover:scale-150 transition-all z-10 cursor-pointer"
          />
          <Handle 
            type="source" 
            position={Position.Right} 
            id="outcome-default"
            title="Default Outcome Branch (Branches Right ➔)"
            className="!w-2.5 !h-2.5 !rounded-full !bg-purple-500 !border-0 -right-1 top-1/2 -translate-y-1/2 opacity-80 group-hover:opacity-100 hover:scale-150 transition-all z-10 cursor-pointer"
          />
        </>
      )}

      {/* Loop-Specific Handles (Spine Alignment: Exit goes down center; Loop goes right; Return comes from right) */}
      {nodeType === 'LOOP' && (
        <>
          <Handle 
            type="source" 
            position={Position.Bottom} 
            id="loop-after"
            title="After Last Item (Continues Down Spine ↓)"
            className="!w-2.5 !h-2.5 !rounded-full !bg-blue-500 !border-0 -bottom-1 left-1/2 -translate-x-1/2 opacity-80 group-hover:opacity-100 hover:scale-150 transition-all z-10 cursor-pointer"
          />
          <Handle 
            type="source" 
            position={Position.Right} 
            id="loop-each"
            title="For Each Item (Branches into Loop Body ➔)"
            className="!w-2.5 !h-2.5 !rounded-full !bg-orange-500 !border-0 -right-1 top-[35%] -translate-y-1/2 opacity-80 group-hover:opacity-100 hover:scale-150 transition-all z-10 cursor-pointer"
          />
          <Handle 
            type="target" 
            position={Position.Right} 
            id="loop-return-target"
            title="Iteration Return Loop (Receives Repeat Wire ⟲)"
            className="!w-2.5 !h-2.5 !rounded-full !bg-orange-500 !border-0 -right-1 top-[75%] -translate-y-1/2 opacity-80 group-hover:opacity-100 hover:scale-150 transition-all z-10 cursor-pointer"
          />
        </>
      )}

      {/* Source Output Handle (Bottom Center - Standard Sequential Spine) */}
      {nodeType !== 'DECISION' && nodeType !== 'ASSERTION' && nodeType !== 'LOOP' && (
        <Handle 
          type="source" 
          position={Position.Bottom} 
          id="bottom"
          className="!w-2 !h-2 !rounded-full !bg-slate-400 dark:!bg-slate-500 !border-0 -bottom-1 left-1/2 -translate-x-1/2 opacity-40 group-hover:opacity-100 hover:scale-150 transition-all z-10 cursor-pointer"
        />
      )}

      {/* Loop Return Cycle Source Handle (Left - Routes Iteration Back to Loop) */}
      {nodeType !== 'DECISION' && nodeType !== 'ASSERTION' && nodeType !== 'LOOP' && (
        <Handle 
          type="source" 
          position={Position.Left} 
          id="left"
          title="Return Loop Cycle (⟲)"
          className="!w-2.5 !h-2.5 !rounded-full !bg-orange-500 !border-0 -left-1 top-1/2 -translate-y-1/2 opacity-60 group-hover:opacity-100 hover:scale-150 transition-all z-10 cursor-pointer"
        />
      )}

      {/* Freeform Cross-Connect Handle (Right) */}
      {nodeType !== 'DECISION' && nodeType !== 'ASSERTION' && nodeType !== 'LOOP' && (
        <Handle 
          type="source" 
          position={Position.Right} 
          id="right"
          title="Connect Right / Fault"
          className="!w-2 !h-2 !rounded-full !bg-slate-400 dark:!bg-slate-500 !border-0 -right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 hover:scale-150 transition-all z-10 cursor-pointer"
        />
      )}
    </div>
  );
});
