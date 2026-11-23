import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, RefreshCw } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeColor?: 'purple' | 'emerald' | 'sky' | 'amber' | 'slate';
  custom?: boolean;
}

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  accentColor?: 'emerald' | 'sky' | 'blue' | 'purple' | 'rose';
  className?: string;
  id?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = '-- Select an option --',
  searchPlaceholder = 'Search...',
  disabled = false,
  isLoading = false,
  loadingText = 'Loading...',
  accentColor = 'emerald',
  className = '',
  id
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close when clicked outside
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

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  const selectedOption = useMemo(() => {
    return options.find(o => o.value.toLowerCase() === (value || '').toLowerCase());
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase().trim();
    return options.filter(o =>
      o.label.toLowerCase().includes(term) ||
      o.value.toLowerCase().includes(term) ||
      (o.sublabel && o.sublabel.toLowerCase().includes(term))
    );
  }, [options, searchTerm]);

  const accentStyles = {
    emerald: {
      borderFocus: 'focus:border-emerald-500 hover:border-emerald-500',
      activeBg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold',
      checkIcon: 'text-emerald-600 dark:text-emerald-400'
    },
    sky: {
      borderFocus: 'focus:border-sky-500 hover:border-sky-500',
      activeBg: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 font-semibold',
      checkIcon: 'text-sky-600 dark:text-sky-400'
    },
    blue: {
      borderFocus: 'focus:border-blue-500 hover:border-blue-500',
      activeBg: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold',
      checkIcon: 'text-blue-600 dark:text-blue-400'
    },
    purple: {
      borderFocus: 'focus:border-purple-500 hover:border-purple-500',
      activeBg: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 font-semibold',
      checkIcon: 'text-purple-600 dark:text-purple-400'
    },
    rose: {
      borderFocus: 'focus:border-rose-500 hover:border-rose-500',
      activeBg: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 font-semibold',
      checkIcon: 'text-rose-600 dark:text-rose-400'
    }
  }[accentColor];

  return (
    <div ref={containerRef} className={`relative w-full ${className}`} id={id}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-full h-9 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 flex items-center justify-between text-xs cursor-pointer shadow-2xs transition-colors text-left ${
          disabled || isLoading ? 'opacity-60 cursor-not-allowed' : accentStyles.borderFocus
        } ${isOpen ? 'ring-1 ring-emerald-500 border-emerald-500' : ''}`}
      >
        <span className={`truncate mr-2 ${selectedOption ? 'font-medium text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>
          {isLoading ? (
            <span className="flex items-center gap-1.5 text-slate-400">
              <RefreshCw className="w-3 h-3 animate-spin" />
              {loadingText}
            </span>
          ) : selectedOption ? (
            <span>
              {selectedOption.label} {selectedOption.sublabel ? `(${selectedOption.sublabel})` : `(${selectedOption.value})`}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Popup */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full h-8 pl-8 pr-7 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-medium"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400 italic">
                {searchTerm ? `No results matching "${searchTerm}"` : 'No options available'}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedOption?.value.toLowerCase() === opt.value.toLowerCase();
                const isCustom = opt.custom || (opt.badge?.toLowerCase() === 'custom') || opt.value.includes('__c');

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? accentStyles.activeBg
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div className="truncate flex-1 mr-2">
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-[11px] text-slate-400 font-mono ml-1.5">
                        ({opt.sublabel || opt.value})
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isCustom && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 uppercase font-bold">
                          Custom
                        </span>
                      )}
                      {isSelected && (
                        <Check className={`w-3.5 h-3.5 ${accentStyles.checkIcon}`} />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export interface SObjectSelectProps {
  value: string;
  onChange: (sobjectName: string) => void;
  objects: Array<{ name: string; label: string; custom?: boolean }>;
  isLoading?: boolean;
  accentColor?: 'emerald' | 'sky' | 'blue' | 'purple' | 'rose';
  placeholder?: string;
  className?: string;
}

export const SObjectSelect: React.FC<SObjectSelectProps> = ({
  value,
  onChange,
  objects,
  isLoading = false,
  accentColor = 'emerald',
  placeholder = '-- Select Salesforce Object --',
  className = ''
}) => {
  const options: SearchableSelectOption[] = useMemo(() => {
    return objects.map(o => ({
      value: o.name,
      label: o.label || o.name,
      sublabel: o.name,
      custom: o.custom ?? o.name.includes('__c')
    }));
  }, [objects]);

  return (
    <SearchableSelect
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      searchPlaceholder="Search Salesforce objects..."
      isLoading={isLoading}
      loadingText="Loading Salesforce objects..."
      accentColor={accentColor}
      className={className}
    />
  );
};
