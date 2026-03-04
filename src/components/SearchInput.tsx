'use client';

import React from 'react';
import { Search } from 'lucide-react';

const SearchInput: React.FC = () => {
  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search 
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" 
          size={18} 
        />
        <input
          type="text"
          placeholder="Пошук..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
        />
      </div>
    </div>
  );
};

export default SearchInput;
