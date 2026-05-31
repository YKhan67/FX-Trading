import React from 'react';
import { AlertTriangle, Shield, TrendingDown, Activity } from 'lucide-react';
import { useSystemState } from '../../core/state';

function RiskOverview() {
  const { riskMetrics, circuitBreakerReason } = useSystemState();

  const dailyLossLimit = 5;
  const maxDrawdownLimit = 10;

  const dailyLossUsedPct = Math.abs(Math.min(riskMetrics.dailyPnlPct, 0)) / dailyLossLimit * 100;
  const drawdownUsedPct = riskMetrics.totalDrawdownPct / maxDrawdownLimit * 100;

  const riskItems = [
    {
      label: 'Daily Loss',
      current: Math.abs(riskMetrics.dailyPnlPct).toFixed(2),
      limit: dailyLossLimit.toString(),
      unit: '%',
      usedPct: dailyLossUsedPct,
      color: dailyLossUsedPct > 80 ? 'red' : dailyLossUsedPct > 50 ? 'amber' : 'emerald',
    },
    {
      label: 'Total Drawdown',
      current: riskMetrics.totalDrawdownPct.toFixed(2),
      limit: maxDrawdownLimit.toString(),
      unit: '%',
      usedPct: drawdownUsedPct,
      color: drawdownUsedPct > 80 ? 'red' : drawdownUsedPct > 50 ? 'amber' : 'emerald',
    },
  ];

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-400" />
          <h2 className="text-xl font-bold text-white">Risk Overview</h2>
        </div>
        {riskMetrics.circuitBreakerActive ? (
          <span className="flex items-center gap-2 px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-medium">
            <AlertTriangle className="w-4 h-4" />
            Circuit Breaker Active
          </span>
        ) : (
          <span className="flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm font-medium">
            <Activity className="w-4 h-4" />
            Trading Active
          </span>
        )}
      </div>

      {circuitBreakerReason && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium">Circuit Breaker Triggered</p>
              <p className="text-slate-400 text-sm mt-1">{circuitBreakerReason}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {riskItems.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">{item.label}</span>
              <span className="text-white font-medium">
                {item.current}{item.unit} / {item.limit}{item.unit}
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  item.color === 'red'
                    ? 'bg-red-500'
                    : item.color === 'amber'
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(item.usedPct, 100)}%` }}
              />
            </div>
          </div>
        ))}

        <div className="border-t border-slate-700 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-slate-400 text-sm mb-1">Open Positions</p>
              <p className="text-white font-bold text-2xl font-mono">
                {riskMetrics.openRisk > 0 ? 1 : 0}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-sm mb-1">Exposure</p>
              <p className="text-white font-bold text-2xl font-mono">
                {riskMetrics.exposure.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RiskOverview;
