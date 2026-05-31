import React from 'react';
import { Bell, RefreshCw, Power } from 'lucide-react';
import { useSystemState } from '../../core/state';

function Header() {
  const {
    status,
    tradingMode,
    balance,
    equity,
    currentSession,
    lastScanTime,
  } = useSystemState();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatTime = (date: Date | null) => {
    if (!date) return 'N/A';
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  return (
    <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">
              Trading Mode
            </p>
            <span
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                tradingMode === 'live'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  tradingMode === 'live' ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              {tradingMode.toUpperCase()}
            </span>
          </div>

          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">
              Status
            </p>
            <span
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                status === 'ready'
                  ? 'bg-blue-500/20 text-blue-400'
                  : status === 'scanning'
                  ? 'bg-purple-500/20 text-purple-400'
                  : status === 'trading'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-slate-500/20 text-slate-400'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          </div>

          <div>
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">
              Session
            </p>
            <span className="text-white font-medium">
              {currentSession.replace('_', ' ')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">
              Balance
            </p>
            <p className="text-white font-mono text-lg">{formatCurrency(balance)}</p>
          </div>

          <div className="text-right">
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">
              Equity
            </p>
            <p className="text-white font-mono text-lg">{formatCurrency(equity)}</p>
          </div>

          <div className="h-8 w-px bg-slate-700" />

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">Last Scan:</span>
            <span className="text-white font-mono">{formatTime(lastScanTime)}</span>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-slate-700 transition-colors text-slate-400 hover:text-white">
              <RefreshCw className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-lg hover:bg-slate-700 transition-colors text-slate-400 hover:text-white relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <button className="p-2 rounded-lg hover:bg-slate-700 transition-colors text-slate-400 hover:text-white">
              <Power className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
