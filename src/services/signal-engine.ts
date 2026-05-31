import { supabase } from '../lib/supabase';
import { eventBus } from '../events/EventBus';
import { EventType } from '../events/EventTypes';
import { MarketRegime, Session, useSystemState } from '../core/state';
import { configManager } from '../core/config';
import { strategyRegistry, Signal, SignalFactors, MarketContext, BaseStrategy } from './strategy-engine';
import { riskEngine } from './risk-engine';
import { adaptiveRiskEngine } from './adaptive-risk-engine';

export class SignalEngine {
  private signalThreshold: number;
  private lastSignalTime: Date | null = null;
  private minSignalIntervalMs = 60000;

  constructor() {
    const config = configManager.get();
    this.signalThreshold = config.scanner.signalThreshold;
  }

  async generateSignals(accountId: string, pairs: string[]): Promise<Signal[]> {
    const signals: Signal[] = [];
    const currentSession = useSystemState.getState().currentSession;

    for (const pair of pairs) {
      const marketContext = await this.buildMarketContext(pair, currentSession);

      if (!marketContext) continue;

      const newsBlocked = await this.checkNewsBlock(pair);
      if (newsBlocked) continue;

      const pairSignals = await this.generatePairSignals(accountId, marketContext);
      signals.push(...pairSignals);
    }

    signals.sort((a, b) => b.score - a.score);

    for (const signal of signals.slice(0, 5)) {
      await this.saveSignal(accountId, signal);
    }

    return signals;
  }

  private async generatePairSignals(
    accountId: string,
    context: MarketContext
  ): Promise<Signal[]> {
    const signals: Signal[] = [];
    const strategies = strategyRegistry.getApplicableStrategies(context.regime);

    for (const strategy of strategies) {
      const factors = await strategy.analyze(context);

      if (!factors) continue;

      const direction = this.determineDirection(context, factors);
      if (!direction) continue;

      const score = this.calculateWeightedScore(factors);
      if (score < this.signalThreshold) continue;

      const confidence = this.calculateConfidence(factors, score);
      const stopLoss = strategy.calculateStopLoss(context, direction);
      const takeProfit = strategy.calculateTakeProfit(context, direction);

      const baseRisk = await this.calculateRisk(accountId, context, stopLoss);
      const adaptiveRisk = await adaptiveRiskEngine.calculateDynamicRisk(accountId, baseRisk);

      const adjustedRisk = Math.min(
        baseRisk * adaptiveRisk.multiplier,
        context.currentPrice * 0.01
      );

      const signal: Signal = {
        signalId: this.generateSignalId(),
        pair: context.pair,
        direction,
        score,
        confidence,
        strategyId: strategy.id,
        regime: context.regime,
        session: context.session,
        riskReward: this.calculateRiskReward(context.currentPrice, stopLoss, takeProfit),
        recommendedRisk: adjustedRisk,
        recommendedEntry: context.currentPrice,
        recommendedStopLoss: stopLoss,
        recommendedTakeProfit: takeProfit,
        newsBlocked: false,
        timestamp: new Date(),
        factors,
      };

      signals.push(signal);

      await eventBus.emit({
        type: EventType.SIGNAL_GENERATED,
        timestamp: new Date(),
        source: 'signal-engine',
        data: {
          signalId: signal.signalId,
          pair: signal.pair,
          direction: signal.direction,
          score: signal.score,
          confidence: signal.confidence,
          strategyId: signal.strategyId,
        },
      });
    }

    return signals;
  }

  private async buildMarketContext(pair: string, session: Session): Promise<MarketContext | null> {
    const { data: regime } = await supabase
      .from('market_regimes')
      .select('*')
      .eq('pair', pair)
      .order('detected_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!regime) {
      return this.getDefaultContext(pair, session);
    }

    return {
      pair,
      regime: regime.regime_type as MarketRegime,
      session,
      trend: {
        direction: (regime.trend_direction || 'NEUTRAL') as 'BULLISH' | 'BEARISH' | 'NEUTRAL',
        strength: regime.trend_strength || 50,
      },
      volatility: regime.atr_pct || 0.5,
      liquidity: regime.liquidity_level === 'HIGH' ? 80 : regime.liquidity_level === 'MEDIUM' ? 60 : 40,
      supportLevels: regime.support_levels || [],
      resistanceLevels: regime.resistance_levels || [],
      currentPrice: regime.current_price || 1.0,
      volume: 50,
    };
  }

  private getDefaultContext(pair: string, session: Session): MarketContext {
    return {
      pair,
      regime: 'UNKNOWN',
      session,
      trend: {
        direction: 'NEUTRAL',
        strength: 50,
      },
      volatility: 0.5,
      liquidity: 60,
      supportLevels: [],
      resistanceLevels: [],
      currentPrice: 1.0,
      volume: 50,
    };
  }

  private determineDirection(
    context: MarketContext,
    factors: SignalFactors
  ): 'LONG' | 'SHORT' | null {
    const trendScore = factors.technical + factors.momentum;
    const threshold = 110;

    if (trendScore > threshold) {
      if (context.trend.direction === 'BULLISH') return 'LONG';
      if (context.trend.direction === 'BEARISH') return 'SHORT';
    }

    if (factors.momentum > 70) {
      return context.regime === 'TREND_UP' ? 'LONG' : 'SHORT';
    }

    return null;
  }

  private calculateWeightedScore(factors: SignalFactors): number {
    const weights = {
      technical: 0.25,
      fundamental: 0.10,
      sentiment: 0.10,
      volume: 0.15,
      momentum: 0.25,
      liquidity: 0.15,
    };

    return (
      factors.technical * weights.technical +
      factors.fundamental * weights.fundamental +
      factors.sentiment * weights.sentiment +
      factors.volume * weights.volume +
      factors.momentum * weights.momentum +
      factors.liquidity * weights.liquidity
    );
  }

  private calculateConfidence(factors: SignalFactors, score: number): number {
    const factorValues = Object.values(factors);
    const mean = factorValues.reduce((sum, v) => sum + v, 0) / factorValues.length;
    const variance = factorValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / factorValues.length;
    const stdDev = Math.sqrt(variance);

    const consistencyBonus = Math.max(0, 1 - stdDev / 30);
    const scoreBonus = Math.min(score / 100, 1);

    return Math.min((consistencyBonus + scoreBonus) / 2, 1);
  }

  private calculateRiskReward(
    entry: number,
    stopLoss: number,
    takeProfit: number
  ): number {
    const risk = Math.abs(entry - stopLoss);
    const reward = Math.abs(takeProfit - entry);
    return risk > 0 ? reward / risk : 0;
  }

  private async calculateRisk(
    accountId: string,
    context: MarketContext,
    stopLoss: number
  ): Promise<number> {
    const state = useSystemState.getState();
    const balance = state.balance;
    const riskPct = configManager.get().trading.maxRiskPerTradePct;

    return (balance * riskPct) / 100;
  }

  private async checkNewsBlock(pair: string): Promise<boolean> {
    const result = await riskEngine.checkNewsFilter(pair);
    return !result.allowed;
  }

  private async saveSignal(accountId: string, signal: Signal): Promise<void> {
    await supabase.from('signals').insert({
      account_id: accountId,
      signal_id: signal.signalId,
      pair: signal.pair,
      direction: signal.direction,
      score: signal.score,
      confidence: signal.confidence,
      strategy_id: signal.strategyId,
      detected_regime: signal.regime,
      session: signal.session,
      recommended_risk_pct: (signal.recommendedRisk / useSystemState.getState().balance) * 100,
      recommended_stop_loss: signal.recommendedStopLoss,
      recommended_take_profit: signal.recommendedTakeProfit,
      risk_reward_ratio: signal.riskReward,
      technical_score: signal.factors.technical,
      fundamental_score: signal.factors.fundamental,
      sentiment_score: signal.factors.sentiment,
      volume_score: signal.factors.volume,
      momentum_score: signal.factors.momentum,
      liquidity_score: signal.factors.liquidity,
      news_blocked: signal.newsBlocked,
      generated_at: signal.timestamp.toISOString(),
    });
  }

  private generateSignalId(): string {
    return `SIG-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
}

export const signalEngine = new SignalEngine();
