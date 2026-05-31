import { supabase } from '../lib/supabase';
import { riskEngine } from './risk-engine';

export interface PerformanceMetrics {
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  avgPnl: number;
  maxDrawdown: number;
}

export interface RiskAdjustment {
  multiplier: number;
  reason: string;
  confidence: number;
}

export class AdaptiveRiskEngine {
  private performanceWindowDays = 30;

  async calculateDynamicRisk(
    accountId: string,
    baseRisk: number
  ): Promise<RiskAdjustment> {
    const metrics = await this.getPerformanceMetrics(accountId);
    const adjustment = this.calculateAdjustment(metrics);

    return {
      multiplier: adjustment.multiplier,
      reason: adjustment.reason,
      confidence: adjustment.confidence,
    };
  }

  private async getPerformanceMetrics(accountId: string): Promise<PerformanceMetrics> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - this.performanceWindowDays);

    const { data: trades } = await supabase
      .from('trades')
      .select('pnl, status')
      .eq('account_id', accountId)
      .eq('status', 'CLOSED')
      .gte('closed_at', startDate.toISOString());

    if (!trades || trades.length === 0) {
      return {
        winRate: 0.5,
        profitFactor: 1,
        sharpeRatio: 0,
        avgPnl: 0,
        maxDrawdown: 0,
      };
    }

    const wins = trades.filter((t) => t.pnl > 0);
    const losses = trades.filter((t) => t.pnl < 0);
    const totalWins = wins.reduce((sum, t) => sum + t.pnl, 0);
    const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));

    const winRate = wins.length / trades.length;
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 1;
    const avgPnl = trades.reduce((sum, t) => sum + t.pnl, 0) / trades.length;

    const sortedPnl = trades.map((t) => t.pnl).sort((a, b) => a - b);
    let maxDrawdown = 0;
    let runningSum = 0;
    let peak = 0;

    for (const pnl of sortedPnl) {
      runningSum += pnl;
      peak = Math.max(peak, runningSum);
      const drawdown = peak - runningSum;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    const sharpeRatio = this.calculateSharpeRatio(trades.map((t) => t.pnl));

    return {
      winRate,
      profitFactor,
      sharpeRatio,
      avgPnl,
      maxDrawdown,
    };
  }

  private calculateAdjustment(metrics: PerformanceMetrics): RiskAdjustment {
    const weights = {
      winRate: 0.25,
      profitFactor: 0.25,
      sharpe: 0.25,
      drawdown: 0.25,
    };

    const score =
      metrics.winRate * weights.winRate * 2 +
      Math.min(metrics.profitFactor, 2) * weights.profitFactor / 2 +
      Math.min(Math.max(metrics.sharpeRatio, -2), 2) / 2 * weights.sharpe +
      (1 - Math.min(metrics.maxDrawdown / 1000, 1)) * weights.drawdown;

    let multiplier = 0.5 + score;
    multiplier = Math.max(0.25, Math.min(1.5, multiplier));

    const reasons: string[] = [];
    if (metrics.winRate > 0.6) reasons.push('high win rate');
    if (metrics.profitFactor > 1.5) reasons.push('strong profit factor');
    if (metrics.sharpeRatio > 1) reasons.push('good risk-adjusted returns');
    if (metrics.maxDrawdown > 500) reasons.push('high drawdown warning');

    return {
      multiplier,
      reason: reasons.length > 0 ? reasons.join(', ') : 'baseline performance',
      confidence: Math.min(score + 0.5, 1),
    };
  }

  private calculateSharpeRatio(returns: number[]): number {
    if (returns.length < 2) return 0;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
      (returns.length - 1);
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    return avgReturn / stdDev;
  }

  async shouldReduceRisk(accountId: string): Promise<boolean> {
    const { data: recentLosses } = await supabase
      .from('trades')
      .select('pnl')
      .eq('account_id', accountId)
      .eq('status', 'CLOSED')
      .order('closed_at', { ascending: false })
      .limit(5);

    if (!recentLosses || recentLosses.length < 3) return false;

    const lastThree = recentLosses.slice(0, 3);
    const allLosses = lastThree.every((t) => t.pnl < 0);

    return allLosses;
  }

  async getVolatilityAdjustedRisk(
    pair: string,
    baseRisk: number
  ): Promise<number> {
    const { data: regime } = await supabase
      .from('market_regimes')
      .select('volatility_rank, atr_pct')
      .eq('pair', pair)
      .order('detected_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!regime) return baseRisk;

    const volatility = regime.volatility_rank || 50;
    const atrPct = regime.atr_pct || 0;

    let adjustment = 1;
    if (volatility > 80) {
      adjustment = 0.5;
    } else if (volatility > 60) {
      adjustment = 0.75;
    } else if (volatility < 20) {
      adjustment = 1.25;
    }

    if (atrPct > 1) {
      adjustment *= 0.8;
    }

    return baseRisk * adjustment;
  }
}

export const adaptiveRiskEngine = new AdaptiveRiskEngine();
