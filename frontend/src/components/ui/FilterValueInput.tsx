import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, Zap, ListFilter, X, Variable } from 'lucide-react';

export interface FilterValueInputProps {
  value: string;
  onChange: (value: string) => void;
  picklistValues?: Array<{ label: string; value: string }>;
  upstreamTokens?: Array<{ token: string; label?: string; sobject?: string }>;
  placeholder?: string;
  isReference?: boolean;
  onOpenLookup?: () => void;
  className?: string;
}

export const FilterValueInput: React.FC<FilterValueInputProps> = ({
  value,
  onChange,
  picklistValues = [],
  upstreamTokens = [],
  placeholder = 'Value or {{variable}}',
  isReference = false,
  onOpenLookup,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasPicklist = picklistValues && picklistValues.length > 0;
  const hasTokens = upstreamTokens && upstreamTokens.length > 0;

  const isVariableValue = useMemo(() => {
    if (!value) return false;
    const str = value.trim();
    return (
      (str.startsWith('{{') && str.endsWith('}}')) ||
      (str.startsWith('{!') && str.endsWith('}')) ||
      str.startsWith(':') ||
      /^[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*$/.test(str)
    );
  }, [value]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Filter picklist values based on current input text
  const filteredPicklist = useMemo(() => {
    if (!hasPicklist) return [];
    if (!value || isVariableValue) return picklistValues;
    const term = value.toLowerCase().trim();
    return picklistValues.filter(pv =>
      pv.label.toLowerCase().includes(term) || pv.value.toLowerCase().includes(term)
    );
  }, [hasPicklist, picklistValues, value, isVariableValue]);

  // Filter upstream tokens based on current input text
  const filteredTokens = useMemo(() => {
    if (!hasTokens) return [];
    if (!value) return upstreamTokens;
    const term = value.toLowerCase().replace(/[{!}:]/g, '').trim();
    return upstreamTokens.filter(t =>
      t.token.toLowerCase().includes(term) ||
      (t.label && t.label.toLowerCase().includes(term)) ||
      (t.sobject && t.sobject.toLowerCase().includes(term))
    );
  }, [hasTokens, upstreamTokens, value]);

  const handleSelectToken = (token: string) => {
    onChange(token);
    setIsOpen(false);
  };

  const handleSelectPicklist = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative flex-1 min-w-0 ${className}`}>
      {/* Input container */}
      <div className="relative flex items-center">
        {/* Token indicator badge if value is a variable */}
        {isVariableValue && (
          <span className="absolute left-2.5 z-10 flex items-center text-sky-500 pointer-events-none" title="Flow Variable Reference">
            <Zap className="w-3.5 h-3.5 fill-sky-500/20" />
          </span>
        )}

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={hasPicklist ? "Select picklist or type {{variable}}..." : placeholder}
          className={`w-full h-8 pr-14 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 shadow-2xs transition-colors ${
            isVariableValue ? 'pl-7 text-sky-600 dark:text-sky-400 font-semibold' : 'pl-2.5'
          }`}
        />

        <div className="absolute right-1 flex items-center gap-0.5">
          {/* Clear button if has value */}
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                inputRef.current?.focus();
              }}
              className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              title="Clear value"
            >
              <X className="w-3 h-3" />
            </button>
          )}

          {/* Trigger button: opens resource & picklist picker */}
          <button
            type="button"
            onClick={() => setIsOpen(prev => !prev)}
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
              isOpen
                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Browse picklist values & flow resources"
          >
            {hasPicklist ? (
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Popover Menu: Always opens on focus or click */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-2 max-h-72 overflow-y-auto">
          {/* Section 1: Picklist Values (if field has picklist) */}
          {hasPicklist && (
            <div className="space-y-1">
              <div className="flex items-center justify-between px-1 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <ListFilter className="w-3 h-3" />
                  Picklist Values ({filteredPicklist.length})
                </span>
                <span className="text-[9px] text-slate-400 font-normal">Click to apply</span>
              </div>

              {filteredPicklist.length === 0 ? (
                <div className="py-1 px-2 text-xs text-slate-400 italic">No matching picklist values</div>
              ) : (
                <div className="space-y-0.5 max-h-36 overflow-y-auto pr-0.5">
                  {filteredPicklist.map((pv) => {
                    const isSelected = value === pv.value;
                    return (
                      <button
                        key={pv.value}
                        type="button"
                        onClick={() => handleSelectPicklist(pv.value)}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-mono flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="truncate">{pv.label || pv.value}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Divider if both sections present */}
          {hasPicklist && <div className="border-t border-slate-100 dark:border-slate-800" />}

          {/* Section 2: Flow Variables & Earlier Step Resources */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-1 text-[10px] font-mono font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Flow Variables / Resources ({filteredTokens.length})
              </span>
              <span className="text-[9px] text-slate-400 font-normal">Dynamic Wire</span>
            </div>

            {filteredTokens.length === 0 ? (
              <div className="py-2 px-2 text-xs text-slate-400 text-center italic">
                {upstreamTokens.length === 0
                  ? "No variables found yet. You can type any literal text or reference."
                  : `No variables matching "${value}"`}
              </div>
            ) : (
              <div className="space-y-0.5 max-h-36 overflow-y-auto pr-0.5">
                {filteredTokens.map((tk) => {
                  const isSelected = value === tk.token;
                  return (
                    <button
                      key={tk.token}
                      type="button"
                      onClick={() => handleSelectToken(tk.token)}
                      className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-mono flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 font-semibold'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className="text-sky-600 dark:text-sky-400 font-semibold truncate">{tk.token}</span>
                      <span className="text-[10px] text-slate-400 font-sans shrink-0 ml-1">
                        {tk.label || (tk.sobject ? `(${tk.sobject})` : '')}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 3: Open Full Lookup Reference Modal for Reference Fields */}
          {isReference && onOpenLookup && (
            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenLookup();
                }}
                className="w-full py-1.5 px-2.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-600 dark:text-sky-400 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search Live Salesforce Records (Lookup)...</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
