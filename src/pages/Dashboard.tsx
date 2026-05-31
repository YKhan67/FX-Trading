import React from 'react';
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart3 } from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import EquityCurve from '../components/charts/EquityCurve';
import PositionsTable from '../components/dashboard/PositionsTable';
import RecentSignals from '../components/dashboard/RecentSignals';
import RiskOverview from '../components/dashboard/RiskOverview';
import { useSystemState } from '../core/state';

function Dashboard() {
  const {
    balance,
    equity,
    floatingPnl,
    riskMetrics,
    positions,
    dailyTrades,
    signals,
    currentSession,
  } = useSystemState();

  const dailyPnl = riskMetrics.dailyPnl;
  const dailyPnlPct = riskMetrics.dailyPnlPct;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1">
            Real-time overview of your trading system
          </p>
        </div>
        <div className="text-right">
          <p className="text-slate-400 text-sm">Current Session</p>
          <p className="text-white font-semibold">{currentSession.replace('_', ' ')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={DollarSign}
          label="Account Balance"
          value={balance}
          prefix="$"
          format="currency"
        />
        <StatCard
          icon={Activity}
          label="Equity"
          value={equity}
          prefix="$"
          format="currency"
        />
        <StatCard
          icon={dailyPnl >= 0 ? TrendingUp : TrendingDown}
          label="Daily P&L"
          value={dailyPnl}
          prefix={dailyPnl >= 0 ? '+$' : '-$'}
          format="currency"
          trend={dailyPnl >= 0 ? 'up' : 'down'}
        />
        <StatCard
          icon={BarChart3}
          label="Trades Today"
          value={dailyTrades}
          format="number"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <EquityCurve />
        </div>
        <div>
          <RiskOverview />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PositionsTable positions={positions} />
        <RecentSignals signals={signals} />
      </div>
    </div>
  );
}

export default Dashboard;
