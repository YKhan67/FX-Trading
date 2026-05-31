import React from 'react';
import { ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { Signal } from '../../services/signal-engine';

interface RecentSignalsProps {
  signals: Signal[];
}

function RecentSignals({ signals }: RecentSignalsProps) {
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  if (signals.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h2 className="text-xl font-bold text-white mb-4">Recent Signals</h2>
        <div className="text-center py-12">
          <p className="text-slate-400">No signals generated</p>
          <p className="text-slate-500 text-sm mt-2">
            Scanner will generate signals when opportunities arise
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Recent Signals</h2>
        <span className="text-slate-400 text-sm">
          {signals.length} signal{signals.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {signals.slice(0, 10).map((signal) => (
          <div
            key={signal.signalId}
            className="flex items-center justify-between p-4 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div
                className={`p-2 rounded-lg ${
                  signal.direction === 'LONG'
                    ? 'bg-emerald-500/20'
                    : 'bg-red-500/20'
                }`}
              >
                {signal.direction === 'LONG' ? (
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-red-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{signal.pair}</span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded ${
                      signal.direction === 'LONG'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {signal.direction}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-slate-400 text-xs">
                    Score: <span className="text-white font-medium">{signal.score.toFixed(2)}</span>
                  </span>
                  <span className="text-slate-400 text-xs">•</span>
                  <span className="text-slate-400 text-xs">
                    R:R: <span className="text-white font-medium">{signal.riskReward.toFixed(2)}</span>
                  </span>
                  <span className="text-slate-400 text-xs">•</span>
                  <span className="text-slate-400 text-xs">
                    Regime: <span className="text-white font-medium">{signal.regime}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-white font-medium">{signal.strategyId}</p>
                <p className="text-slate-400 text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTime(signal.timestamp)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-xs">Confidence</p>
                <p className="text-white font-medium">
                  {(signal.confidence * 100).toFixed(0)}%
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RecentSignals;
