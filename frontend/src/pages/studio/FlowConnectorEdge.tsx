import React, { useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getSmoothStepPath,
  getBezierPath,
  Position
} from '@xyflow/react';
import { 
  Plus, 
  Search, 
  RefreshCw, 
  Trash2, 
  GitBranch, 
  ArrowLeftRight, 
  Clock, 
  Zap, 
  X
} from 'lucide-react';

export const FlowConnectorEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition = Position.Bottom,
  targetPosition = Position.Top,
  style = {},
  data
}) => {
  const isRunning = (data as any)?.isRunning;
  const isPassed = (data as any)?.isPassed;
  const isFailed = (data as any)?.isFailed;
  const isFaultEdge = id.includes('fault') || (data as any)?.label === 'Fault Path';

  // Laser-straight line when vertically aligned down the main execution spine
  const isVerticallyAligned = Math.abs(sourceX - targetX) < 10 && sourceY < targetY;

  let edgePath: string;
  let labelX: number;
  let labelY: number;

  if (isVerticallyAligned) {
    // 100% straight vertical connector wire with zero bends or kinks
    edgePath = `M ${sourceX} ${sourceY} L ${sourceX} ${targetY}`;
    labelX = sourceX;
    labelY = (sourceY + targetY) / 2;
  } else {
    // Orthogonal step routing with clean rounded elbows for decision/fault/loop branches
    const [stepPath, lx, ly] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 12
    });
    edgePath = stepPath;
    labelX = lx;
    labelY = ly;
  }

  const [menuOpen, setMenuOpen] = useState(false);

  const onAddElement = (type: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (data && typeof (data as any).onInsertNode === 'function') {
      (data as any).onInsertNode(id, type);
    }
    setMenuOpen(false);
  };

  const onDeleteThisEdge = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data && typeof (data as any).onDeleteEdge === 'function') {
      (data as any).onDeleteEdge(id);
    }
  };

  const edgeLabel = data && (data as any).label;

  const isTrueBranch = edgeLabel === 'True' || edgeLabel === 'Condition Met' || (data as any)?.outcomeType === 'true';
  const isDefaultBranch = edgeLabel === 'Default Outcome' || edgeLabel === 'False' || (data as any)?.outcomeType === 'default';
  const isLoopEach = edgeLabel === 'For Each Item' || (data as any)?.loopPath === 'each';
  const isLoopAfter = edgeLabel === 'After Last Item' || (data as any)?.loopPath === 'after';
  const isLoopReturn = edgeLabel === 'Repeat' || edgeLabel === 'Return' || (data as any)?.loopPath === 'return';

  // Branch-specific color identity (Preserved in both Light & Dark modes)
  const branchColor = isFaultEdge
    ? '#f43f5e'
    : isTrueBranch
    ? '#10b981'
    : isDefaultBranch
    ? '#a855f7'
    : (isLoopEach || isLoopReturn)
    ? '#f97316'
    : isLoopAfter
    ? '#3b82f6'
    : null;

  // Determine wire stroke color (high contrast against both light #f8fafc and dark #0b1120)
  const strokeColor = isFailed 
    ? '#f43f5e' 
    : isRunning 
    ? (branchColor || '#0ea5e9') 
    : isPassed 
    ? (branchColor || '#10b981') 
    : (branchColor || '#94a3b8');

  const markerId = `marker-${id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  return (
    <>
      {/* SVG Defs for crisp Salesforce-style downward arrowhead */}
      <svg className="absolute w-0 h-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M 0 1.5 L 7 5 L 0 8.5 z" fill={strokeColor} />
          </marker>
        </defs>
      </svg>

      {/* 1. Subtle Glow Halo behind actively running connection */}
      {isRunning && (
        <path
          d={edgePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={7}
          strokeOpacity={0.25}
          strokeLinecap="round"
          className="animate-pulse pointer-events-none"
        />
      )}

      {/* 2. Base Connection Edge */}
      <BaseEdge 
        id={id} 
        path={edgePath} 
        className={isFailed ? 'flow-edge-failed' : isRunning ? 'flow-edge-running' : isPassed ? 'flow-edge-passed' : undefined}
        style={{
          stroke: strokeColor,
          strokeWidth: isRunning ? 2.8 : isPassed ? 2.2 : 1.8,
          strokeDasharray: isRunning ? '8 6' : (isFailed || isFaultEdge) ? '4 4' : undefined,
          opacity: !isRunning && !isPassed && !isFailed && !branchColor ? 0.65 : 1,
          transition: 'stroke 0.25s ease, stroke-width 0.25s ease',
          ...style
        }} 
        markerEnd={`url(#${markerId})`}
      />

      {/* 3. Flowing Colored Pulse Particle along actual geometry */}
      {isRunning && (
        <g className="pointer-events-none">
          <circle r="4" fill={strokeColor} filter={`drop-shadow(0 0 5px ${strokeColor})`}>
            <animateMotion
              path={edgePath}
              dur="0.85s"
              repeatCount="indefinite"
              rotate="auto"
            />
          </circle>
        </g>
      )}

      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan z-30 flex items-center justify-center relative"
        >
          {/* Distinct Salesforce-Style Theme-Aware Branch Label */}
          {edgeLabel && (
            <span className={`absolute -top-6 text-[9.5px] font-mono font-semibold px-2 py-0.5 rounded-full border shadow-xs whitespace-nowrap flex items-center gap-1.5 ${
              isTrueBranch 
                ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-700/80 text-emerald-800 dark:text-emerald-300'
                : isDefaultBranch
                ? 'bg-purple-50 dark:bg-purple-950/80 border-purple-300 dark:border-purple-700/80 text-purple-800 dark:text-purple-300'
                : (isLoopEach || isLoopReturn)
                ? 'bg-orange-50 dark:bg-orange-950/80 border-orange-300 dark:border-orange-700/80 text-orange-800 dark:text-orange-300'
                : isLoopAfter
                ? 'bg-blue-50 dark:bg-blue-950/80 border-blue-300 dark:border-blue-700/80 text-blue-800 dark:text-blue-300'
                : isFaultEdge
                ? 'bg-rose-50 dark:bg-rose-950/80 border-rose-300 dark:border-rose-700/80 text-rose-800 dark:text-rose-300'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
            }`}>
              {isTrueBranch && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
              {isDefaultBranch && <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />}
              {isLoopEach && <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
              {isLoopReturn && <RefreshCw className="w-2.5 h-2.5 text-orange-500 animate-spin" />}
              {isLoopAfter && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
              {isFaultEdge && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
              {edgeLabel}
            </span>
          )}

          {/* Minimalist Salesforce-Style Circular Plus Button (Hidden on return loop) */}
          {!isLoopReturn && (
            <div className="relative group/edge-btn flex items-center">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                title="Add Step (+)"
                className={`w-6 h-6 rounded-full border transition-all flex items-center justify-center shadow-sm cursor-pointer backdrop-blur-sm ${
                  menuOpen
                    ? 'bg-blue-600 border-blue-600 text-white rotate-45 scale-110 shadow-blue-500/25'
                    : isRunning
                    ? 'bg-sky-50 dark:bg-sky-950 border-sky-400 text-sky-600 scale-105 shadow-md shadow-sky-500/20'
                    : 'bg-white/95 dark:bg-slate-900/95 border-slate-300/90 dark:border-slate-700 hover:border-blue-500 text-slate-500 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 hover:scale-110 hover:shadow-md'
                }`}
              >
                <Plus className="w-3 h-3 stroke-[2.5]" />
              </button>

            {/* Quick delete line action on hover (subtle small x to right) */}
            {!menuOpen && (
              <button
                onClick={onDeleteThisEdge}
                title="Remove Line"
                className="opacity-0 group-hover/edge-btn:opacity-100 transition-opacity ml-1 w-4 h-4 rounded-full bg-rose-50 hover:bg-rose-500 text-rose-400 hover:text-white flex items-center justify-center cursor-pointer shadow-2xs"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}

            {/* Sleek Popover Anchored to the Right (Never cuts across the connection line) */}
            {menuOpen && (
              <>
                {/* Backdrop to close on click outside */}
                <div 
                  className="fixed inset-0 z-40 bg-transparent cursor-default" 
                  onClick={() => setMenuOpen(false)} 
                />

                <div className="absolute left-7 top-1/2 -translate-y-1/2 w-48 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-1.5 space-y-0.5 text-left z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="flex items-center justify-between px-2 py-1 border-b border-slate-100 dark:border-slate-800 text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                    <span>Insert Element</span>
                    <button 
                      onClick={() => setMenuOpen(false)}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    onClick={(e) => onAddElement('CREATE', e)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-950/60 hover:text-sky-600 transition-colors cursor-pointer"
                  >
                    <div className="w-5 h-5 rounded bg-sky-50 dark:bg-sky-950 border border-sky-200 dark:border-sky-800 text-sky-600 flex items-center justify-center flex-shrink-0">
                      <Plus className="w-3 h-3" />
                    </div>
                    <span>Create Records</span>
                  </button>

                  <button
                    onClick={(e) => onAddElement('GET', e)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-600 transition-colors cursor-pointer"
                  >
                    <div className="w-5 h-5 rounded bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-600 flex items-center justify-center flex-shrink-0">
                      <Search className="w-3 h-3" />
                    </div>
                    <span>Get Records</span>
                  </button>

                  <button
                    onClick={(e) => onAddElement('UPDATE', e)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-600 transition-colors cursor-pointer"
                  >
                    <div className="w-5 h-5 rounded bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <RefreshCw className="w-3 h-3" />
                    </div>
                    <span>Update Records</span>
                  </button>

                  <button
                    onClick={(e) => onAddElement('DECISION', e)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-950/60 hover:text-purple-600 transition-colors cursor-pointer"
                  >
                    <div className="w-5 h-5 rounded bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 text-purple-600 flex items-center justify-center flex-shrink-0">
                      <GitBranch className="w-3 h-3" />
                    </div>
                    <span>Decision / Assert</span>
                  </button>

                  <button
                    onClick={(e) => onAddElement('DELETE', e)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    <div className="w-5 h-5 rounded bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 text-rose-600 flex items-center justify-center flex-shrink-0">
                      <Trash2 className="w-3 h-3" />
                    </div>
                    <span>Delete Records</span>
                  </button>

                  <button
                    onClick={(e) => onAddElement('PAUSE', e)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    <div className="w-5 h-5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-3 h-3" />
                    </div>
                    <span>Pause / Delay</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </EdgeLabelRenderer>
    </>
  );
};
