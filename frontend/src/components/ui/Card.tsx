import React from 'react';

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, className = '', titleClassName = '' }: { title: string; subtitle?: string; className?: string; titleClassName?: string }) {
  return (
    <div className={`px-6 py-5 border-b border-slate-100 ${className}`}>
      <h3 className={`text-lg font-bold text-black ${titleClassName}`}>{title}</h3>
      {subtitle && <p className="mt-1 text-sm font-medium text-black">{subtitle}</p>}
    </div>
  );
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}
