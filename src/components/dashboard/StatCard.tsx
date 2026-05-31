import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  format: 'currency' | 'number' | 'percentage';
  trend?: 'up' | 'down' | 'neutral';
}

function StatCard({
  icon: Icon,
  label,
  value,
  prefix = '',
  suffix = '',
  format,
  trend = 'neutral',
}: StatCardProps) {
  const formatValue = (val: number): string => {
    if (format === 'currency') {
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Math.abs(val));
    }
    if (format === 'percentage') {
      return `${val.toFixed(2)}%`;
    }
    return val.toLocaleString();
  };

  const trendColors = {
    up: 'text-emerald-400',
    down: 'text-red-400',
    neutral: 'text-white',
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 hover:border-slate-600 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
          <Icon className="w-6 h-6 text-blue-400" />
        </div>
        {trend !== 'neutral' && (
          <div
            className={`text-xs font-medium px-2 py-1 rounded ${
              trend === 'up'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-red-500/20 text-red-400'
            }`}
          >
            {trend === 'up' ? '↑' : '↓'}
          </div>
        )}
      </div>
      <p className="text-slate-400 text-sm mb-1">{label}</p>
      <p className={`text-2xl font-bold font-mono ${trendColors[trend]}`}>
        {prefix}
        {formatValue(value)}
        {suffix}
      </p>
    </div>
  );
}

export default StatCard;
