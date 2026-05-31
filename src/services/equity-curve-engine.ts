import { supabase } from '../lib/supabase';
import { eventBus } from '../events/EventBus';
import { useSystemState } from '../core/state';

export interface EquitySnapshot {
  timestamp: Date;
  balance: number;
  equity: number;
  floatingPnl: number;
  drawdown: number;
  drawdownPct: number;
  peakEquity: number;
}

export class EquityCurveEngine {
  private peakEquity: number = 0;
  private snapshots: EquitySnapshot[] = [];
  private recordingInterval: NodeJS.Timeout | null = null;

  async initialize(accountId: string): Promise<void> {
    const { data: curve } = await supabase
      .from('equity_curve')
      .select('*')
      .eq('account_id', accountId)
      .order('timestamp', { ascending: false })
      .limit(100);

    if (curve && curve.length > 0) {
      this.peakEquity = Math.max(...curve.map((c) => c.equity));
      this.snapshots = curve.map(this.mapToSnapshot).reverse();
    }

    this.startRecording(accountId);
  }

  async recordSnapshot(accountId: string): Promise<void> {
    const state = useSystemState.getState();
    const timestamp = new Date();
    const balance = state.balance;
    const equity = state.equity;
    const floatingPnl = state.floatingPnl || 0;

    if (equity > this.peakEquity) {
      this.peakEquity = equity;
    }

    const drawdown = this.peakEquity - equity;
    const drawdownPct = this.peakEquity > 0 ? (drawdown / this.peakEquity) * 100 : 0;

    const snapshot: EquitySnapshot = {
      timestamp,
      balance,
      equity,
      floatingPnl,
      drawdown,
      drawdownPct,
      peakEquity: this.peakEquity,
    };

    this.snapshots.push(snapshot);

    if (this.snapshots.length > 1000) {
      this.snapshots.shift();
    }

    await supabase.from('equity_curve').insert({
      account_id: accountId,
      timestamp: timestamp.toISOString(),
      balance,
      equity,
      floating_pnl: floatingPnl,
      margin: state.margin,
      free_margin: state.freeMargin,
      margin_level: state.marginLevel,
      peak_equity: this.peakEquity,
      current_drawdown_pct: drawdownPct,
      daily_drawdown_pct: state.riskMetrics.dailyPnlPct,
      open_positions: state.openPositions,
      total_lots: state.totalLots,
    });

    useSystemState.getState().addEquitySnapshot(snapshot);
  }

  private startRecording(accountId: string): void {
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
    }

    this.recordingInterval = setInterval(() => {
      this.recordSnapshot(accountId);
    }, 60000); // Record every minute
  }

  stopRecording(): void {
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }
  }

  getDrawdown(): { current: number; currentPct: number; max: number; maxPct: number } {
    if (this.snapshots.length === 0) {
      return { current: 0, currentPct: 0, max: 0, maxPct: 0 };
    }

    const current = this.snapshots[this.snapshots.length - 1].drawdown;
    const currentPct = this.snapshots[this.snapshots.length - 1].drawdownPct;
    const max = Math.max(...this.snapshots.map((s) => s.drawdown));
    const maxPct = Math.max(...this.snapshots.map((s) => s.drawdownPct));

    return { current, currentPct, max, maxPct };
  }

  getEquityCurve(): EquitySnapshot[] {
    return this.snapshots;
  }

  getPerformanceMetrics(days: number = 30): {
    totalReturn: number;
    totalReturnPct: number;
    avgDailyReturn: number;
    volatility: number;
    sharpeRatio: number;
    maxDrawdown: number;
    maxDrawdownPct: number;
    winDays: number;
    lossDays: number;
  } {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const recentSnapshots = this.snapshots.filter(
      (s) => s.timestamp >= cutoff
    );

    if (recentSnapshots.length < 2) {
      return {
        totalReturn: 0,
        totalReturnPct: 0,
        avgDailyReturn: 0,
        volatility: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        maxDrawdownPct: 0,
        winDays: 0,
        lossDays: 0,
      };
    }

    const startEquity = recentSnapshots[0].equity;
    const endEquity = recentSnapshots[recentSnapshots.length - 1].equity;
    const totalReturn = endEquity - startEquity;
    const totalReturnPct = (totalReturn / startEquity) * 100;

    const dailyReturns: number[] = [];
    let prevEquity = startEquity;

    for (let i = 1; i < recentSnapshots.length; i++) {
      const dailyReturn =
        ((recentSnapshots[i].equity - prevEquity) / prevEquity) * 100;
      dailyReturns.push(dailyReturn);
      prevEquity = recentSnapshots[i].equity;
    }

    const avgDailyReturn =
      dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;

    const variance =
      dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgDailyReturn, 2), 0) /
      dailyReturns.length;
    const volatility = Math.sqrt(variance);

    const sharpeRatio = volatility > 0 ? (avgDailyReturn / volatility) * Math.sqrt(252) : 0;

    const maxDrawdown = Math.max(...recentSnapshots.map((s) => s.drawdown));
    const maxDrawdownPct = Math.max(...recentSnapshots.map((s) => s.drawdownPct));

    const winDays = recentSnapshots.filter((s, i) =>
      i > 0 ? s.equity > recentSnapshots[i - 1].equity : false
    ).length;
    const lossDays = recentSnapshots.length - 1 - winDays;

    return {
      totalReturn,
      totalReturnPct,
      avgDailyReturn,
      volatility,
      sharpeRatio,
      maxDrawdown,
      maxDrawdownPct,
      winDays,
      lossDays,
    };
  }

  private mapToSnapshot(row: any): EquitySnapshot {
    return {
      timestamp: new Date(row.timestamp),
      balance: row.balance,
      equity: row.equity,
      floatingPnl: row.floating_pnl || 0,
      drawdown: row.peak_equity - row.equity,
      drawdownPct: row.current_drawdown_pct || 0,
      peakEquity: row.peak_equity || row.equity,
    };
  }
}

export const equityCurveEngine = new EquityCurveEngine();
