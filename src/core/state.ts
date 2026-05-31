import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TradingMode = 'paper' | 'live';
export type SystemStatus = 'initializing' | 'ready' | 'scanning' | 'trading' | 'paused' | 'error' | 'stopped';
export type MarketRegime = 'TREND_UP' | 'TREND_DOWN' | 'RANGE' | 'VOLATILE' | 'BREAKOUT' | 'UNKNOWN';
export type Session = 'ASIAN' | 'LONDON' | 'NEW_YORK' | 'OVERLAP_LONDON_NY' | 'OVERLAP_ASIAN_LONDON' | 'OFF_HOURS';

export interface EquitySnapshot {
  timestamp: Date;
  balance: number;
  equity: number;
  floatingPnl: number;
  drawdown: number;
  drawdownPct: number;
}

export interface Position {
  tradeId: string;
  pair: string;
  direction: 'LONG' | 'SHORT';
  lotSize: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  pnl: number;
  pnlPips: number;
  openTime: Date;
  strategyId: string;
  regime: MarketRegime;
  session: Session;
}

export interface RiskMetrics {
  dailyPnl: number;
  dailyPnlPct: number;
  dailyStartBalance: number;
  totalDrawdown: number;
  totalDrawdownPct: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  riskPerTrade: number;
  openRisk: number;
  exposure: number;
  circuitBreakerActive: boolean;
  tradingAllowed: boolean;
}

export interface Signal {
  signalId: string;
  pair: string;
  direction: 'LONG' | 'SHORT';
  score: number;
  confidence: number;
  strategyId: string;
  regime: MarketRegime;
  session: Session;
  riskReward: number;
  recommendedRisk: number;
  newsBlocked: boolean;
  timestamp: Date;
}

export interface SystemState {
  // Core state
  tradingMode: TradingMode;
  status: SystemStatus;
  isInitialized: boolean;

  // Connection status
  brokerConnected: boolean;
  pythonConnected: boolean;
  lastHeartbeat: Date | null;

  // Account state
  accountId: string | null;
  balance: number;
  equity: number;
  floatingPnl: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;

  // Positions
  positions: Position[];
  openPositions: number;
  totalLots: number;

  // Risk state
  riskMetrics: RiskMetrics;

  // Scanner state
  activePairs: string[];
  signals: Signal[];
  lastScanTime: Date | null;
  scanInProgress: boolean;

  // Market state
  currentSession: Session;
  regimes: Map<string, MarketRegime>;

  // Performance tracking
  equityCurve: EquitySnapshot[];
  dailyTrades: number;
  totalTrades: number;
  winRate: number;

  // Circuit breaker
  circuitBreakerReason: string | null;

  // Error handling
  lastError: string | null;
  errorCount: number;
}

interface SystemActions {
  // Initialization
  initialize: () => Promise<void>;
  shutdown: () => Promise<void>;

  // Connection management
  setBrokerConnected: (connected: boolean) => void;
  setPythonConnected: (connected: boolean) => void;
  updateHeartbeat: () => void;

  // Account updates
  updateAccount: (updates: Partial<SystemState>) => void;
  updateBalance: (balance: number, equity: number, floatingPnl?: number) => void;

  // Position management
  addPosition: (position: Position) => void;
  updatePosition: (tradeId: string, updates: Partial<Position>) => void;
  removePosition: (tradeId: string) => void;
  clearPositions: () => void;

  // Risk management
  updateRiskMetrics: (metrics: Partial<RiskMetrics>) => void;
  triggerCircuitBreaker: (reason: string) => void;
  resetCircuitBreaker: () => void;
  checkRiskLimits: () => { passed: boolean; reason?: string };

  // Signal management
  addSignal: (signal: Signal) => void;
  clearSignals: () => void;
  selectBestSignal: () => Signal | null;

  // Market state
  setCurrentSession: (session: Session) => void;
  setRegime: (pair: string, regime: MarketRegime) => void;

  // Scanner
  startScan: () => void;
  endScan: () => void;
  setActivePairs: (pairs: string[]) => void;

  // Performance tracking
  addEquitySnapshot: (snapshot: EquitySnapshot) => void;
  incrementDailyTrades: () => void;
  resetDailyStats: () => void;

  // Status management
  setStatus: (status: SystemStatus) => void;
  setTradingMode: (mode: TradingMode) => void;
  setError: (error: string | null) => void;

  // State persistence
  persist: () => void;
  hydrate: () => void;
}

const initialState: SystemState = {
  tradingMode: 'paper',
  status: 'initializing',
  isInitialized: false,
  brokerConnected: false,
  pythonConnected: false,
  lastHeartbeat: null,
  accountId: null,
  balance: 100000,
  equity: 100000,
  floatingPnl: 0,
  margin: 0,
  freeMargin: 100000,
  marginLevel: 0,
  positions: [],
  openPositions: 0,
  totalLots: 0,
  riskMetrics: {
    dailyPnl: 0,
    dailyPnlPct: 0,
    dailyStartBalance: 100000,
    totalDrawdown: 0,
    totalDrawdownPct: 0,
    maxDrawdown: 0,
    maxDrawdownPct: 0,
    riskPerTrade: 1000,
    openRisk: 0,
    exposure: 0,
    circuitBreakerActive: false,
    tradingAllowed: true,
  },
  activePairs: [],
  signals: [],
  lastScanTime: null,
  scanInProgress: false,
  currentSession: 'OFF_HOURS',
  regimes: new Map(),
  equityCurve: [],
  dailyTrades: 0,
  totalTrades: 0,
  winRate: 0,
  circuitBreakerReason: null,
  lastError: null,
  errorCount: 0,
};

export const useSystemState = create<SystemState & SystemActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      initialize: async () => {
        set({ status: 'initializing', isInitialized: false });
        try {
          await get().hydrate();
          set({ status: 'ready', isInitialized: true });
        } catch (error) {
          set({ status: 'error', lastError: String(error) });
        }
      },

      shutdown: async () => {
        set({ status: 'stopped', brokerConnected: false, pythonConnected: false });
      },

      setBrokerConnected: (connected) => set({ brokerConnected: connected }),
      setPythonConnected: (connected) => set({ pythonConnected: connected }),
      updateHeartbeat: () => set({ lastHeartbeat: new Date() }),

      updateAccount: (updates) => set(updates),

      updateBalance: (balance, equity, floatingPnl = 0) => {
        const state = get();
        const dailyPnl = equity - state.riskMetrics.dailyStartBalance;
        const dailyPnlPct = (dailyPnl / state.riskMetrics.dailyStartBalance) * 100;
        const totalDrawdownPct = state.balance > 0 ? ((state.balance - equity) / state.balance) * 100 : 0;

        set({
          balance,
          equity,
          floatingPnl,
          riskMetrics: {
            ...state.riskMetrics,
            dailyPnl,
            dailyPnlPct,
            totalDrawdownPct,
          },
        });
      },

      addPosition: (position) => {
        set((state) => ({
          positions: [...state.positions, position],
          openPositions: state.openPositions + 1,
          totalLots: state.totalLots + position.lotSize,
        }));
      },

      updatePosition: (tradeId, updates) => {
        set((state) => ({
          positions: state.positions.map((p) =>
            p.tradeId === tradeId ? { ...p, ...updates } : p
          ),
        }));
      },

      removePosition: (tradeId) => {
        set((state) => {
          const position = state.positions.find((p) => p.tradeId === tradeId);
          if (!position) return state;

          return {
            positions: state.positions.filter((p) => p.tradeId !== tradeId),
            openPositions: state.openPositions - 1,
            totalLots: state.totalLots - position.lotSize,
          };
        });
      },

      clearPositions: () => set({ positions: [], openPositions: 0, totalLots: 0 }),

      updateRiskMetrics: (metrics) => {
        set((state) => ({
          riskMetrics: { ...state.riskMetrics, ...metrics },
        }));
      },

      triggerCircuitBreaker: (reason) => {
        set((state) => ({
          circuitBreakerReason: reason,
          riskMetrics: {
            ...state.riskMetrics,
            circuitBreakerActive: true,
            tradingAllowed: false,
          },
          status: 'paused',
        }));
      },

      resetCircuitBreaker: () => {
        set((state) => ({
          circuitBreakerReason: null,
          riskMetrics: {
            ...state.riskMetrics,
            circuitBreakerActive: false,
            tradingAllowed: true,
          },
          status: 'ready',
        }));
      },

      checkRiskLimits: () => {
        const state = get();
        const { riskMetrics } = state;

        if (riskMetrics.dailyPnlPct <= -5.0) {
          return { passed: false, reason: 'Daily loss limit reached (5%)' };
        }

        if (riskMetrics.totalDrawdownPct >= 10.0) {
          return { passed: false, reason: 'Maximum drawdown reached (10%)' };
        }

        if (riskMetrics.circuitBreakerActive) {
          return { passed: false, reason: state.circuitBreakerReason || 'Circuit breaker active' };
        }

        if (state.openPositions >= 1) {
          return { passed: false, reason: 'Maximum open positions reached' };
        }

        return { passed: true };
      },

      addSignal: (signal) => {
        set((state) => ({
          signals: [...state.signals, signal].sort((a, b) => b.score - a.score),
        }));
      },

      clearSignals: () => set({ signals: [] }),

      selectBestSignal: () => {
        const state = get();
        return state.signals.length > 0 ? state.signals[0] : null;
      },

      setCurrentSession: (session) => set({ currentSession: session }),
      setRegime: (pair, regime) => {
        set((state) => {
          const regimes = new Map(state.regimes);
          regimes.set(pair, regime);
          return { regimes };
        });
      },

      startScan: () => set({ scanInProgress: true }),
      endScan: () => set({ scanInProgress: false, lastScanTime: new Date() }),
      setActivePairs: (pairs) => set({ activePairs: pairs }),

      addEquitySnapshot: (snapshot) => {
        set((state) => ({
          equityCurve: [...state.equityCurve, snapshot].slice(-1000),
        }));
      },

      incrementDailyTrades: () => {
        set((state) => ({
          dailyTrades: state.dailyTrades + 1,
          totalTrades: state.totalTrades + 1,
        }));
      },

      resetDailyStats: () => {
        set((state) => ({
          dailyTrades: 0,
          riskMetrics: {
            ...state.riskMetrics,
            dailyPnl: 0,
            dailyPnlPct: 0,
            dailyStartBalance: state.balance,
          },
        }));
      },

      setStatus: (status) => set({ status }),
      setTradingMode: (mode) => set({ tradingMode: mode }),

      setError: (error) => {
        set((state) => ({
          lastError: error,
          errorCount: error ? state.errorCount + 1 : 0,
        }));
      },

      persist: () => {
        const state = get();
        localStorage.setItem('fx-system-state', JSON.stringify({
          balance: state.balance,
          equity: state.equity,
          riskMetrics: state.riskMetrics,
          dailyTrades: state.dailyTrades,
          totalTrades: state.totalTrades,
        }));
      },

      hydrate: async () => {
        try {
          const stored = localStorage.getItem('fx-system-state');
          if (stored) {
            const parsed = JSON.parse(stored);
            set(parsed);
          }
        } catch (error) {
          console.error('Failed to hydrate state:', error);
        }
      },
    }),
    {
      name: 'fx-system-state',
      partialize: (state) => ({
        tradingMode: state.tradingMode,
        balance: state.balance,
        equity: state.equity,
        riskMetrics: state.riskMetrics,
        dailyTrades: state.dailyTrades,
        totalTrades: state.totalTrades,
      }),
    }
  )
);
