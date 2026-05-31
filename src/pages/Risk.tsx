import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Activity, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';
import { useSystemState } from '../core/state';
import { riskEngine } from '../services/risk-engine';
import { supabase } from '../lib/supabase';

interface RiskEvent {
  id: string;
  event_type: string;
  severity: string;
  description: string;
  triggered_value: number;
  threshold_value: number;
  trading_blocked: boolean;
  created_at: string;
}

function Risk() {
  const { riskMetrics, circuitBreakerReason } = useSystemState();
  const [riskEvents, setRiskEvents] = useState<RiskEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRiskEvents();
  }, []);

  const fetchRiskEvents = async () => {
    const { data } = await supabase
      .from('risk_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      setRiskEvents(data);
    }
    setLoading(false);
  };

  const dailyLossPct = Math.abs(riskMetrics.dailyPnlPct);
  const dailyLossLimit = 5;
  const dailyLossRemaining = dailyLossLimit - dailyLossPct;

  const drawdownPct = riskMetrics.totalDrawdownPct;
  const drawdownLimit = 10;
  const drawdownRemaining = drawdownLimit - drawdownPct;

  const riskChecks = [
    {
      name: 'Daily Loss Limit',
      current: dailyLossPct,
      limit: dailyLossLimit,
      remaining: dailyLossRemaining,
      unit: '%',
      status: dailyLossPct >= dailyLossLimit ? 'critical' : dailyLossPct >= dailyLossLimit * 0.8 ? 'warning' : 'safe',
    },
    {
      name: 'Max Drawdown',
      current: drawdownPct,
      limit: drawdownLimit,
      remaining: drawdownRemaining,
      unit: '%',
      status: drawdownPct >= drawdownLimit ? 'critical' : drawdownPct >= drawdownLimit * 0.8 ? 'warning' : 'safe',
    },
    {
      name: 'Open Positions',
      current: riskMetrics.openRisk > 0 ? 1 : 0,
      limit: 1,
      remaining: riskMetrics.openRisk > 0 ? 0 : 1,
      unit: '',
      status: riskMetrics.openRisk > 0 ? 'active' : 'safe',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Risk Management</h1>
          <p className="text-slate-400 mt-1">
            Monitor and manage risk exposure in real-time
          </p>
        </div>
        {!riskMetrics.circuitBreakerActive ? (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">All Systems Nominal</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Circuit Breaker Active</span>
          </div>
        )}
      </div>

      {circuitBreakerReason && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-red-400 mt-1" />
            <div>
              <h3 className="text-red-400 font-bold text-lg mb-2">
                Circuit Breaker Triggered
              </h3>
              <p className="text-slate-400">{circuitBreakerReason}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {riskChecks.map((check) => (
          <div
            key={check.name}
            className="bg-slate-800 rounded-xl border border-slate-700 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-400 font-medium">{check.name}</h3>
              {check.status === 'critical' && (
                <AlertCircle className="w-5 h-5 text-red-400" />
              )}
              {check.status === 'warning' && (
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              )}
              {check.status === 'safe' && (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              )}
            </div>

            <div className="mb-4">
              <div className="flex items-end justify-between mb-2">
                <div>
                  <p className="text-3xl font-bold text-white">
                    {check.current.toFixed(2)}
                    {check.unit}
                  </p>
                  <p className="text-slate-400 text-sm mt-1">
                    Limit: {check.limit}
                    {check.unit}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 text-sm">Remaining</p>
                  <p className="text-white font-medium">
                    {check.remaining.toFixed(2)}
                    {check.unit}
                  </p>
                </div>
              </div>

              <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    check.status === 'critical'
                      ? 'bg-red-500'
                      : check.status === 'warning'
                      ? 'bg-amber-500'
                      : check.status === 'active'
                      ? 'bg-blue-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{
                    width: `${Math.min((check.current / check.limit) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-xl font-bold text-white mb-4">Risk Configuration</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-slate-700">
              <span className="text-slate-400">Max Daily Loss</span>
              <span className="text-white font-medium">5%</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-slate-700">
              <span className="text-slate-400">Max Total Drawdown</span>
              <span className="text-white font-medium">10%</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-slate-700">
              <span className="text-slate-400">Max Risk Per Trade</span>
              <span className="text-white font-medium">1%</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-slate-700">
              <span className="text-slate-400">Max Open Positions</span>
              <span className="text-white font-medium">1</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-slate-700">
              <span className="text-slate-400">News Filter Blackout</span>
              <span className="text-white font-medium">30 min before</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-slate-400">Circuit Breaker Threshold</span>
              <span className="text-white font-medium">5% drawdown</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-xl font-bold text-white mb-4">Risk Events Log</h2>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-slate-400">Loading...</p>
            </div>
          ) : riskEvents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400">No risk events</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {riskEvents.map((event) => (
                <div
                  key={event.id}
                  className="bg-slate-700/30 rounded-lg p-4 hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        event.severity === 'CRITICAL'
                          ? 'bg-red-500/20 text-red-400'
                          : event.severity === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      {event.severity}
                    </span>
                    <span className="text-slate-500 text-xs">
                      {new Date(event.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-white font-medium">{event.event_type}</p>
                  <p className="text-slate-400 text-sm mt-1">{event.description}</p>
                  {event.trading_blocked && (
                    <div className="mt-2 flex items-center gap-1 text-red-400 text-xs">
                      <AlertTriangle className="w-3 h-3" />
                      Trading was blocked
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Risk;
