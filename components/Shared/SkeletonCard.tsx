
import React from 'react';

const SkeletonCard: React.FC = () => (
  <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 flex items-center justify-between animate-pulse">
    <div className="flex items-center gap-4 flex-1">
      <div className="w-12 h-12 bg-slate-100 rounded-2xl"></div>
      <div className="space-y-2 flex-1">
        <div className="h-4 bg-slate-100 rounded w-1/2"></div>
        <div className="h-2 bg-slate-50 rounded w-1/4"></div>
      </div>
    </div>
    <div className="w-24 h-10 bg-slate-50 rounded-xl"></div>
  </div>
);

export default SkeletonCard;
