import React, { useState, useEffect } from 'react';
import { Filter, Download, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Trade {
  trade_id: string;
  pair: string;
  direction: string;
  lot_size: number;
  entry_price: number;
  exit_price: number;
  pnl: number;
  pnl_pips: number;
  stop_loss: number;
  take_profit: number;
  executed_at: string;
  closed_at: string;
  status: string;
  strategy_id: string;
  regime_at_entry: string;
  session: string;
}

function Trades() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [dateRange, setDateRange] = useState('7d');

  useEffect(() => {
    fetchTrades();
  }, [filter, dateRange]);

  const fetchTrades = async () => {
    setLoading(true);

    let query = supabase
      .from('trades')
      .select('*')
      .order('executed_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter.toUpperCase());
    }

    if (dateRange === '7d') {
      const date = new Date();
      date.setDate(date.getDate() - 7);
      query = query.gte('executed_at', date.toISOString());
    } else if (dateRange === '30d') {
      const date = new Date();
      date.setDate(date.getDate() - 30);
      query = query.gte('executed_at', date.toISOString());
    }

    const { data, error } = await query;

    if (data) {
      setTrades(data);
    }

    setLoading(false);
  };

  const exportToCSV = () => {
    const csv = [
      ['Trade ID', 'Pair', 'Direction', 'Lots', 'Entry', 'Exit', 'P&L', 'Pips', 'Status', 'Date'].join(','),
      ...trades.map((t) =>
        [
          t.trade_id,
          t.pair,
          t.direction,
          t.lot_size,
          t.entry_price,
          t.exit_price,
          t.pnl,
          t.pnl_pips,
          t.status,
          t.executed_at,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Trade History</h1>
          <p className="text-slate-400 mt-1">View and analyze all your trades</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Trades</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-400">Loading trades...</p>
          </div>
        ) : trades.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400">No trades found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-slate-700">
                  <th className="pb-3 text-slate-400 font-medium text-sm">Date</th>
                  <th className="pb-3 text-slate-400 font-medium text-sm">Pair</th>
                  <th className="pb-3 text-slate-400 font-medium text-sm">Direction</th>
                  <th className="pb-3 text-slate-400 font-medium text-sm">Lots</th>
                  <th className="pb-3 text-slate-400 font-medium text-sm">Entry</th>
                  <th className="pb-3 text-slate-400 font-medium text-sm">Exit</th>
                  <th className="pb-3 text-slate-400 font-medium text-sm">P&L</th>
                  <th className="pb-3 text-slate-400 font-medium text-sm">Status</th>
                  <th className="pb-3 text-slate-400 font-medium text-sm">Strategy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {trades.map((trade) => (
                  <tr key={trade.trade_id} className="hover:bg-slate-700/30">
                    <td className="py-4 text-slate-300 text-sm">
                      {new Date(trade.executed_at).toLocaleDateString()}
                    </td>
                    <td className="py-4 text-white font-medium">{trade.pair}</td>
                    <td className="py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          trade.direction === 'LONG'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {trade.direction}
                      </span>
                    </td>
                    <td className="py-4 text-slate-300 font-mono">{trade.lot_size.toFixed(2)}</td>
                    <td className="py-4 text-slate-300 font-mono">{trade.entry_price?.toFixed(5)}</td>
                    <td className="py-4 text-slate-300 font-mono">{trade.exit_price?.toFixed(5) || '-'}</td>
                    <td className="py-4">
                      <span
                        className={`font-mono font-medium ${
                          trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        ${trade.pnl?.toFixed(2) || '0.00'}
                      </span>
                    </td>
                    <td className="py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          trade.status === 'OPEN'
                            ? 'bg-blue-500/20 text-blue-400'
                            : trade.status === 'CLOSED'
                            ? 'bg-slate-500/20 text-slate-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {trade.status}
                      </span>
                    </td>
                    <td className="py-4 text-slate-400 text-sm">{trade.strategy_id || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Trades;
