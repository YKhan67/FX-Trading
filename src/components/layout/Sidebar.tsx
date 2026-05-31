import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Signal,
  Shield,
  Settings,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { useSystemState } from '../../core/state';

function Sidebar() {
  const { brokerConnected, pythonConnected, riskMetrics } = useSystemState();

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/trades', icon: TrendingUp, label: 'Trades' },
    { to: '/signals', icon: Signal, label: 'Signals' },
    { to: '/risk', icon: Shield, label: 'Risk Management' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <aside className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg">FX Prop AI</h1>
            <p className="text-slate-400 text-xs">Trading System</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25'
                      : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Broker</span>
            <span
              className={`flex items-center gap-1.5 ${
                brokerConnected ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  brokerConnected ? 'bg-emerald-400' : 'bg-red-400'
                }`}
              />
              {brokerConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Python Backend</span>
            <span
              className={`flex items-center gap-1.5 ${
                pythonConnected ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  pythonConnected ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              {pythonConnected ? 'Connected' : 'Mock Mode'}
            </span>
          </div>

          {riskMetrics.circuitBreakerActive && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mt-3">
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium">Circuit Breaker Active</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
