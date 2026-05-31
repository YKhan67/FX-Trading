import React, { useState } from 'react';
import { Settings as SettingsIcon, Save, RotateCcw, AlertTriangle } from 'lucide-react';
import { configManager, SystemConfig } from '../core/config';
import { useSystemState } from '../core/state';

function Settings() {
  const { tradingMode, setTradingMode } = useSystemState();
  const [config, setConfig] = useState<SystemConfig>(configManager.get());
  const [hasChanges, setHasChanges] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const validation = configManager.validate(config);
    if (!validation.valid) {
      alert(validation.errors.join('\n'));
      return;
    }

    configManager.update(config);
    setHasChanges(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    if (confirm('Reset all settings to defaults?')) {
      configManager.reset();
      setConfig(configManager.get());
      setHasChanges(false);
    }
  };

  const updateConfig = <K extends keyof SystemConfig>(
    section: K,
    updates: Partial<SystemConfig[K]>
  ) => {
    setConfig((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...updates },
    }));
    setHasChanges(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-slate-400 mt-1">Configure your trading system</p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-amber-400 text-sm flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              Unsaved changes
            </span>
          )}
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              hasChanges
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Save className="w-4 h-4" />
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-xl font-bold text-white mb-6">Trading Configuration</h2>

          <div className="space-y-6">
            <div>
              <label className="text-slate-400 text-sm mb-2 block">Trading Mode</label>
              <select
                value={tradingMode}
                onChange={(e) => setTradingMode(e.target.value as 'paper' | 'live')}
                className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="paper">Paper Trading</option>
                <option value="live">Live Trading</option>
              </select>
              <p className="text-slate-500 text-xs mt-2">
                Paper mode uses mock broker. Live mode requires Python backend connection.
              </p>
            </div>

            <div>
              <label className="text-slate-400 text-sm mb-2 block">Max Open Trades</label>
              <input
                type="number"
                min="1"
                max="10"
                value={config.trading.maxOpenTrades}
                onChange={(e) =>
                  updateConfig('trading', { maxOpenTrades: parseInt(e.target.value) })
                }
                className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-slate-400 text-sm mb-2 block">Max Daily Loss (%)</label>
              <input
                type="number"
                min="1"
                max="20"
                step="0.5"
                value={config.trading.maxDailyLossPct}
                onChange={(e) =>
                  updateConfig('trading', { maxDailyLossPct: parseFloat(e.target.value) })
                }
                className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-slate-400 text-sm mb-2 block">Max Total Drawdown (%)</label>
              <input
                type="number"
                min="1"
                max="30"
                step="0.5"
                value={config.trading.maxTotalDrawdownPct}
                onChange={(e) =>
                  updateConfig('trading', { maxTotalDrawdownPct: parseFloat(e.target.value) })
                }
                className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-slate-400 text-sm mb-2 block">Max Risk Per Trade (%)</label>
              <input
                type="number"
                min="0.1"
                max="5"
                step="0.1"
                value={config.trading.maxRiskPerTradePct}
                onChange={(e) =>
                  updateConfig('trading', { maxRiskPerTradePct: parseFloat(e.target.value) })
                }
                className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h2 className="text-xl font-bold text-white mb-6">Scanner Configuration</h2>

            <div className="space-y-4">
              <div>
                <label className="text-slate-400 text-sm mb-2 block">
                  Scan Interval (seconds)
                </label>
                <input
                  type="number"
                  min="60"
                  max="600"
                  step="30"
                  value={config.scanner.intervalSeconds}
                  onChange={(e) =>
                    updateConfig('scanner', { intervalSeconds: parseInt(e.target.value) })
                  }
                  className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-400 text-sm mb-2 block">
                  Signal Threshold Score
                </label>
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={config.scanner.signalThreshold}
                  onChange={(e) =>
                    updateConfig('scanner', { signalThreshold: parseInt(e.target.value) })
                  }
                  className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-400 text-sm mb-2 block">Active Pairs</label>
                <div className="bg-slate-700 border border-slate-600 rounded-lg p-3 max-h-40 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-2">
                    {config.trading.allowedPairs.map((pair) => (
                      <div
                        key={pair}
                        className="flex items-center gap-2 text-sm text-slate-300"
                      >
                        <input
                          type="checkbox"
                          defaultChecked
                          className="rounded border-slate-500"
                        />
                        {pair}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h2 className="text-xl font-bold text-white mb-6">Python Backend</h2>

            <div className="space-y-4">
              <div>
                <label className="text-slate-400 text-sm mb-2 block">Backend URL</label>
                <input
                  type="text"
                  value={config.python.backendUrl}
                  onChange={(e) =>
                    updateConfig('python', { backendUrl: e.target.value })
                  }
                  className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-slate-400 text-sm mb-2 block">WebSocket URL</label>
                <input
                  type="text"
                  value={config.python.wsUrl}
                  onChange={(e) => updateConfig('python', { wsUrl: e.target.value })}
                  className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>

              <div className="flex items-center justify-between py-3 border-t border-slate-700">
                <span className="text-slate-400">Connection Timeout</span>
                <span className="text-white font-medium">{config.python.timeout}ms</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-slate-400">Reconnect Interval</span>
                <span className="text-white font-medium">
                  {config.python.reconnectInterval}ms
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
