import { supabase } from '../lib/supabase';
import { eventBus } from '../events/EventBus';
import { EventType } from '../events/EventTypes';
import { useSystemState } from '../core/state';
import { configManager } from '../core/config';

export interface RiskLimits {
  maxDailyLossPct: number;
  maxTotalDrawdownPct: number;
  maxRiskPerTradePct: number;
  maxOpenTrades: number;
  maxCorrelatedRiskPct: number;
}

export interface RiskAssessment {
  allowed: boolean;
  reason?: string;
  adjustedLotSize?: number;
  riskAmount?: number;
  riskPct?: number;
}

export class RiskEngine {
  private limits: RiskLimits;

  constructor() {
    const config = configManager.get();
    this.limits = {
      maxDailyLossPct: config.trading.maxDailyLossPct,
      maxTotalDrawdownPct: config.trading.maxTotalDrawdownPct,
      maxRiskPerTradePct: config.trading.maxRiskPerTradePct,
      maxOpenTrades: config.trading.maxOpenTrades,
      maxCorrelatedRiskPct: config.risk.maxCorrelatedRiskPct,
    };
  }

  async checkAllLimits(
    accountId: string,
    proposedRisk: number,
    pair: string
  ): Promise<RiskAssessment> {
    const checks = await Promise.all([
      this.checkDailyLoss(accountId),
      this.checkTotalDrawdown(accountId),
      this.checkPositionCount(accountId),
      this.checkRiskPerTrade(proposedRisk),
      this.checkNewsFilter(pair),
    ]);

    const failed = checks.find((c) => !c.allowed);
    if (failed) {
      return failed;
    }

    return {
      allowed: true,
      riskAmount: proposedRisk,
    };
  }

  async checkDailyLoss(accountId: string): Promise<RiskAssessment> {
    const { data: account } = await supabase
      .from('accounts')
      .select('daily_start_balance, daily_pnl')
      .eq('id', accountId)
      .maybeSingle();

    if (!account) {
      return { allowed: false, reason: 'Account not found' };
    }

    const dailyLossPct = (account.daily_pnl / account.daily_start_balance) * 100;
    const maxAllowed = -(this.limits.maxDailyLossPct);

    if (dailyLossPct <= maxAllowed) {
      await this.logRiskEvent(accountId, 'DAILY_LOSS_LIMIT', {
        currentValue: dailyLossPct,
        thresholdValue: maxAllowed,
        breachPct: Math.abs(dailyLossPct - maxAllowed),
      });

      return { allowed: false, reason: `Daily loss limit reached: ${dailyLossPct.toFixed(2)}%` };
    }

    return { allowed: true };
  }

  async checkTotalDrawdown(accountId: string): Promise<RiskAssessment> {
    const { data: account } = await supabase
      .from('accounts')
      .select('initial_balance, equity')
      .eq('id', accountId)
      .maybeSingle();

    if (!account) {
      return { allowed: false, reason: 'Account not found' };
    }

    const drawdownPct = ((account.initial_balance - account.equity) / account.initial_balance) * 100;

    if (drawdownPct >= this.limits.maxTotalDrawdownPct) {
      await this.logRiskEvent(accountId, 'MAX_DRAWDOWN', {
        currentValue: drawdownPct,
        thresholdValue: this.limits.maxTotalDrawdownPct,
        breachPct: drawdownPct - this.limits.maxTotalDrawdownPct,
      });

      return { allowed: false, reason: `Max drawdown reached: ${drawdownPct.toFixed(2)}%` };
    }

    return { allowed: true };
  }

  async checkPositionCount(accountId: string): Promise<RiskAssessment> {
    const { count } = await supabase
      .from('trades')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .eq('status', 'OPEN');

    if (count !== null && count >= this.limits.maxOpenTrades) {
      return { allowed: false, reason: `Max open positions reached: ${count}/${this.limits.maxOpenTrades}` };
    }

    return { allowed: true };
  }

  async checkRiskPerTrade(riskAmount: number): Promise<RiskAssessment> {
    const state = useSystemState.getState();
    const balance = state.balance || 100000;
    const riskPct = (riskAmount / balance) * 100;

    if (riskPct > this.limits.maxRiskPerTradePct) {
      const maxRisk = (balance * this.limits.maxRiskPerTradePct) / 100;
      return {
        allowed: true,
        adjustedLotSize: riskAmount, // Will need to adjust outside
        riskAmount: maxRisk,
        riskPct: this.limits.maxRiskPerTradePct,
        reason: `Risk adjusted from ${riskPct.toFixed(2)}% to ${this.limits.maxRiskPerTradePct}%`,
      };
    }

    return { allowed: true, riskAmount, riskPct };
  }

  async checkNewsFilter(pair: string): Promise<RiskAssessment> {
    const currency = pair.substring(0, 3);
    const counterCurrency = pair.substring(3, 6);
    const now = new Date();
    const blackoutWindow = new Date(now.getTime() + 30 * 60 * 1000); // 30 min ahead

    const { data: newsEvents } = await supabase
      .from('news_events')
      .select('*')
      .in('currency', [currency, counterCurrency])
      .eq('impact', 'HIGH')
      .gte('event_time', now.toISOString())
      .lte('event_time', blackoutWindow.toISOString());

    if (newsEvents && newsEvents.length > 0) {
      return {
        allowed: false,
        reason: `High-impact news event for ${pair} within 30 minutes`,
      };
    }

    return { allowed: true };
  }

  calculatePositionSize(
    accountBalance: number,
    riskPct: number,
    entryPrice: number,
    stopLoss: number,
    pipValue: number = 10
  ): number {
    const riskAmount = (accountBalance * riskPct) / 100;
    const pipDistance = Math.abs(entryPrice - stopLoss) * 10000; // Convert to pips
    const lotSize = riskAmount / (pipDistance * pipValue);

    return Math.max(0.01, Math.floor(lotSize * 100) / 100); // Round to 0.01
  }

  calculateRisk(
    accountBalance: number,
    lotSize: number,
    stopLossPips: number,
    pipValue: number = 10
  ): { riskAmount: number; riskPct: number } {
    const riskAmount = lotSize * stopLossPips * pipValue;
    const riskPct = (riskAmount / accountBalance) * 100;

    return { riskAmount, riskPct };
  }

  async triggerCircuitBreaker(accountId: string, reason: string): Promise<void> {
    await supabase
      .from('accounts')
      .update({
        circuit_breaker_active: true,
        circuit_breaker_reason: reason,
        is_trading_enabled: false,
      })
      .eq('id', accountId);

    useSystemState.getState().triggerCircuitBreaker(reason);

    await eventBus.emit({
      type: EventType.CIRCUIT_BREAKER_TRIGGERED,
      timestamp: new Date(),
      source: 'risk-engine',
      data: {
        riskType: 'CIRCUIT_BREAKER',
        currentValue: 0,
        thresholdValue: 0,
        breachPct: 0,
        action: reason,
      },
    });
  }

  async resetCircuitBreaker(accountId: string): Promise<void> {
    await supabase
      .from('accounts')
      .update({
        circuit_breaker_active: false,
        circuit_breaker_reason: null,
        is_trading_enabled: true,
      })
      .eq('id', accountId);

    useSystemState.getState().resetCircuitBreaker();

    await eventBus.emit({
      type: EventType.CIRCUIT_BREAKER_RESET,
      timestamp: new Date(),
      source: 'risk-engine',
      data: {
        riskType: 'CIRCUIT_BREAKER_RESET',
        currentValue: 0,
        thresholdValue: 0,
        breachPct: 0,
        action: 'Circuit breaker reset',
      },
    });
  }

  private async logRiskEvent(
    accountId: string,
    eventType: string,
    data: {
      currentValue: number;
      thresholdValue: number;
      breachPct: number;
    }
  ): Promise<void> {
    await supabase.from('risk_events').insert({
      account_id: accountId,
      event_type: eventType,
      severity: 'HIGH',
      triggered_value: data.currentValue,
      threshold_value: data.thresholdValue,
      breach_pct: data.breachPct,
      trading_blocked: true,
      description: `${eventType}: ${data.currentValue.toFixed(2)}% vs limit ${data.thresholdValue.toFixed(2)}%`,
    });
  }
}

export const riskEngine = new RiskEngine();
