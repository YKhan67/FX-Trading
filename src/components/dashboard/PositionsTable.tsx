import React from 'react';
import { ArrowUpRight, ArrowDownRight, X } from 'lucide-react';
import { Position } from '../../core/state';

interface PositionsTableProps {
  positions: Position[];
}

function PositionsTable({ positions }: PositionsTableProps) {
  const formatPrice = (price: number) => price.toFixed(5);

  if (positions.length === 0) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h2 className="text-xl font-bold text-white mb-4">Open Positions</h2>
        <div className="text-center py-12">
          <p className="text-slate-400">No open positions</p>
          <p className="text-slate-500 text-sm mt-2">New trades will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Open Positions</h2>
        <span className="text-slate-400 text-sm">
          {positions.length} position{positions.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left border-b border-slate-700">
              <th className="pb-3 text-slate-400 font-medium text-sm">Pair</th>
              <th className="pb-3 text-slate-400 font-medium text-sm">Direction</th>
              <th className="pb-3 text-slate-400 font-medium text-sm">Lots</th>
              <th className="pb-3 text-slate-400 font-medium text-sm">Entry</th>
              <th className="pb-3 text-slate-400 font-medium text-sm">Current</th>
              <th className="pb-3 text-slate-400 font-medium text-sm">SL</th>
              <th className="pb-3 text-slate-400 font-medium text-sm">TP</th>
              <th className="pb-3 text-slate-400 font-medium text-sm">P&L</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {positions.map((position) => (
              <tr key={position.tradeId} className="hover:bg-slate-700/30 transition-colors">
                <td className="py-4 text-white font-medium">{position.pair}</td>
                <td className="py-4">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                      position.direction === 'LONG'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {position.direction === 'LONG' ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    {position.direction}
                  </span>
                </td>
                <td className="py-4 text-white font-mono">{position.lotSize.toFixed(2)}</td>
                <td className="py-4 text-slate-300 font-mono">{formatPrice(position.entryPrice)}</td>
                <td className="py-4 text-slate-300 font-mono">{formatPrice(position.currentPrice)}</td>
                <td className="py-4 text-red-400 font-mono">{formatPrice(position.stopLoss)}</td>
                <td className="py-4 text-emerald-400 font-mono">{formatPrice(position.takeProfit)}</td>
                <td className="py-4">
                  <span
                    className={`font-mono font-medium ${
                      position.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PositionsTable;
