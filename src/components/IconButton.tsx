'use client';

import React from 'react';

interface IconButtonProps {
  icon: React.ReactNode;
  label?: string;
  badge?: number;
  active?: boolean;
  onClick?: () => void;
}

const IconButton: React.FC<IconButtonProps> = ({ 
  icon, 
  label, 
  badge, 
  active = false,
  onClick 
}) => {
  return (
    <button
      onClick={onClick}
      className={`
        relative flex items-center justify-center p-2 rounded-xl transition-all duration-200
        ${active 
          ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-100' 
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
        }
      `}
      title={label}
      aria-label={label}
    >
      {icon}
      {badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );
};

export default IconButton;
