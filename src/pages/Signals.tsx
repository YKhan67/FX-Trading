import React from 'react';
import { Signal as SignalIcon, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { useSystemState } from '../core/state';

function Signals() {
  const { signals, lastScanTime, scanInProgress, currentSession } = useSystemState();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Signal Feed</h1>
          <p className="text-slate-400 mt-1">Real-time trading signals from the scanner</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-slate-400 text-sm">Last Scan</p>
            <p className="text-white font-medium">
              {lastScanTime ? new Date(lastScanTime).toLocaleTimeString() : 'N/A'}
            </p>
          </div>
          <div
            className={`px-4 py-2 rounded-lg ${
              scanInProgress
                ? 'bg-purple-500/20 text-purple-400'
                : 'bg-slate-700 text-slate-400'
            }`}
          >
            {scanInProgress ? 'Scanning...' : 'Idle'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {signals.length === 0 ? (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
              <SignalIcon className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">No signals available</p>
              <p className="text-slate-500 text-sm mt-2">
                The scanner will generate signals when market conditions align
              </p>
            </div>
          ) : (
            signals.map((signal, index) => (
              <div
                key={signal.signalId}
                className="bg-slate-800 rounded-xl border border-slate-700 p-6 hover:border-slate-600 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-3 rounded-lg ${
                        signal.direction === 'LONG'
                          ? 'bg-emerald-500/20'
                          : 'bg-red-500/20'
                      }`}
                    >
                      {signal.direction === 'LONG' ? (
                        <TrendingUp className="w-6 h-6 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-6 h-6 text-red-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold text-white">{signal.pair}</h3>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            signal.direction === 'LONG'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {signal.direction}
                        </span>
                        <span className="bg-slate-700 text-slate-300 px-2 py-1 rounded text-xs">
                          #{index + 1}
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm mt-1">
                        {signal.strategyId} • {signal.regime} • {signal.session}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400 text-sm">Score</p>
                    <p className="text-3xl font-bold text-white">{signal.score.toFixed(1)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-slate-700/30 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Confidence</p>
                    <p className="text-white font-semibold">
                      {(signal.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Risk:Reward</p>
                    <p className="text-white font-semibold">{signal.riskReward.toFixed(2)}</p>
                  </div>
                  <div className="bg-slate-700/30 rounded-lg p-3">
                    <p className="text-slate-400 text-xs mb-1">Risk %</p>
                    <p className="text-white font-semibold">
                      {((signal.recommendedRisk / 100000) * 100).toFixed(2)}%
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-slate-400">Entry</p>
                    <p className="text-white font-mono">
                      {signal.recommendedEntry.toFixed(5)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Stop Loss</p>
                    <p className="text-red-400 font-mono">
                      {signal.recommendedStopLoss.toFixed(5)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Take Profit</p>
                    <p className="text-emerald-400 font-mono">
                      {signal.recommendedTakeProfit.toFixed(5)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-700">
                  <div className="grid grid-cols-6 gap-2 text-xs">
                    <div>
                      <p className="text-slate-500">Technical</p>
                      <p className="text-white">{signal.factors.technical.toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Fundamental</p>
                      <p className="text-white">{signal.factors.fundamental.toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Sentiment</p>
                      <p className="text-white">{signal.factors.sentiment.toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Volume</p>
                      <p className="text-white">{signal.factors.volume.toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Momentum</p>
                      <p className="text-white">{signal.factors.momentum.toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Liquidity</p>
                      <p className="text-white">{signal.factors.liquidity.toFixed(0)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h3 className="text-lg font-bold text-white mb-4">Scanner Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Session</span>
                <span className="text-white font-medium">{currentSession.replace('_', ' ')}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Signals Generated</span>
                <span className="text-white font-medium">{signals.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Scan Status</span>
                <span
                  className={`font-medium ${
                    scanInProgress ? 'text-purple-400' : 'text-slate-400'
                  }`}
                >
                  {scanInProgress ? 'Active' : 'Idle'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h3 className="text-lg font-bold text-white mb-4">Filter Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="text-slate-400 text-sm mb-2 block">
                  Score Threshold
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  defaultValue="70"
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm mb-2 block">
                  Min Confidence
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  defaultValue="0.7"
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signals;
