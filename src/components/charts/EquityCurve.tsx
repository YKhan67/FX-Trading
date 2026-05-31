import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { useSystemState } from '../../core/state';

function EquityCurve() {
  const { equityCurve } = useSystemState();

  const data = equityCurve.map((snapshot) => ({
    time: new Date(snapshot.timestamp).toLocaleTimeString(),
    equity: snapshot.equity,
    balance: snapshot.balance,
    drawdown: snapshot.drawdownPct,
  }));

  const currentEquity = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].equity : 0;
  const startEquity = equityCurve.length > 0 ? equityCurve[0].equity : 0;
  const pnl = currentEquity - startEquity;
  const pnlPct = startEquity > 0 ? ((currentEquity - startEquity) / startEquity) * 100 : 0;

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">Equity Curve</h2>
          <p className="text-slate-400 text-sm mt-1">Performance over time</p>
        </div>
        <div className="text-right">
          <p className="text-slate-400 text-sm">Total Return</p>
          <p className={`text-2xl font-bold font-mono ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {pnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
            />
            <YAxis
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#fff',
              }}
              formatter={(value: any) => [`$${value.toFixed(2)}`, '']}
            />
            <Area
              type="monotone"
              dataKey="equity"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#equityGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default EquityCurve;
