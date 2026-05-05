import React, { useState, useEffect, useRef } from 'react';
import { mutualFundService, MfSearchResult } from '../services/mutualFundService';
import { MagnifyingGlassIcon, ArrowPathIcon } from './icons';

interface MutualFundSearchProps {
  onSelect: (schemeCode: number, schemeName: string) => void;
  initialValue?: string;
}

const MutualFundSearch: React.FC<MutualFundSearchProps> = ({ onSelect, initialValue = '' }) => {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<MfSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.trim().length >= 3) {
        setIsLoading(true);
        const searchResults = await mutualFundService.searchSchemes(query);
        setResults(searchResults);
        setIsLoading(false);
        setShowDropdown(true);
      } else {
        setResults([]);
        setShowDropdown(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-text-secondary mb-1.5 px-1 uppercase tracking-wider text-[10px]">
        Search Mutual Fund (India)
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {isLoading ? (
            <ArrowPathIcon className="h-4 w-4 text-primary animate-spin" />
          ) : (
            <MagnifyingGlassIcon className="h-4 w-4 text-text-secondary" />
          )}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 3 && setShowDropdown(true)}
          className="block w-full pl-10 pr-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-text-primary placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all shadow-inner"
          placeholder="e.g. HDFC Balanced Advantage"
        />
      </div>

      {showDropdown && results.length > 0 && (
        <div className="absolute z-[100] mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-h-60 overflow-y-auto overflow-x-hidden animate-in fade-in slide-in-from-top-1 duration-200">
          <ul className="py-1">
            {results.map((result) => (
              <li key={result.schemeCode}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(result.schemeCode, result.schemeName);
                    setQuery(result.schemeName);
                    setShowDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-slate-700 transition-colors"
                >
                  <div className="font-medium truncate">{result.schemeName}</div>
                  <div className="text-[10px] text-text-secondary/60">Code: {result.schemeCode}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {showDropdown && results.length === 0 && query.length >= 3 && !isLoading && (
        <div className="absolute z-[100] mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-center text-xs text-text-secondary shadow-xl">
          No matching funds found.
        </div>
      )}
    </div>
  );
};

export default MutualFundSearch;
