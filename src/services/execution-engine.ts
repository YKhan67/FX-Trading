import { BaseBroker, Order, OrderAction, OrderType, OrderResult, OrderStatus } from '../broker/BaseBroker';
import { MockBroker } from '../broker/MockBroker';
import { supabase } from '../lib/supabase';
import { eventBus } from '../events/EventBus';
import { EventType } from '../events/EventTypes';
import { useSystemState } from '../core/state';
import { configManager } from '../core/config';
import { riskEngine } from './risk-engine';
import { Signal } from './signal-engine';

interface QueuedOrder {
  id: string;
  order: Order;
  signal: Signal;
  priority: number;
  retries: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
}

export class ExecutionEngine {
  private broker: BaseBroker;
  private orderQueue: QueuedOrder[] = [];
  private processing: boolean = false;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor() {
    const config = configManager.get();
    this.broker = new MockBroker({ name: 'MockBroker' });
    this.maxRetries = config.broker.retryAttempts;
    this.retryDelayMs = 1000;
  }

  async initialize(): Promise<void> {
    const connected = await this.broker.connect();
    if (!connected) {
      throw new Error('Failed to connect to broker');
    }

    useSystemState.getState().setBrokerConnected(connected);
  }

  async submitOrder(signal: Signal, accountId: string): Promise<OrderResult> {
    if (!useSystemState.getState().riskMetrics.tradingAllowed) {
      return {
        orderId: this.generateOrderId(),
        status: OrderStatus.REJECTED,
        rejectReason: 'Trading blocked by risk engine',
        timestamp: new Date(),
      };
    }

    const riskCheck = await riskEngine.checkAllLimits(
      accountId,
      signal.recommendedRisk,
      signal.pair
    );

    if (!riskCheck.allowed) {
      return {
        orderId: this.generateOrderId(),
        status: OrderStatus.REJECTED,
        rejectReason: riskCheck.reason,
        timestamp: new Date(),
      };
    }

    const state = useSystemState.getState();
    const lotSize = this.calculateLotSize(
      signal.recommendedRisk,
      signal.recommendedEntry,
      signal.recommendedStopLoss
    );

    const order: Order = {
      orderId: this.generateOrderId(),
      pair: signal.pair,
      action: signal.direction === 'LONG' ? OrderAction.BUY : OrderAction.SELL,
      type: OrderType.MARKET,
      volume: lotSize,
      stopLoss: signal.recommendedStopLoss,
      takeProfit: signal.recommendedTakeProfit,
      comment: `Strategy: ${signal.strategyId}`,
    };

    const queuedOrder: QueuedOrder = {
      id: order.orderId,
      order,
      signal,
      priority: signal.score,
      retries: 0,
      maxRetries: this.maxRetries,
      status: 'pending',
      createdAt: new Date(),
    };

    this.orderQueue.push(queuedOrder);
    this.processQueue();

    const result = await this.executeOrder(queuedOrder, accountId);

    await eventBus.emit({
      type: EventType.ORDER_SUBMITTED,
      timestamp: new Date(),
      source: 'execution-engine',
      data: {
        orderId: order.orderId,
        pair: order.pair,
        requestedPrice: signal.recommendedEntry,
        executedPrice: result.executedPrice,
        slippagePips: result.slippagePips,
        latencyMs: result.latencyMs,
      },
    });

    return result;
  }

  private async executeOrder(queuedOrder: QueuedOrder, accountId: string): Promise<OrderResult> {
    const startTime = Date.now();

    try {
      const result = await this.broker.placeOrder(queuedOrder.order);
      const latencyMs = Date.now() - startTime;

      if (result.status === OrderStatus.FILLED) {
        await this.saveTrade(queuedOrder, result, accountId, latencyMs);

        useSystemState.getState().addPosition({
          tradeId: result.orderId,
          pair: queuedOrder.order.pair,
          direction: queuedOrder.signal.direction,
          lotSize: result.executedVolume || queuedOrder.order.volume,
          entryPrice: result.executedPrice || 0,
          currentPrice: result.executedPrice || 0,
          stopLoss: queuedOrder.order.stopLoss || 0,
          takeProfit: queuedOrder.order.takeProfit || 0,
          pnl: 0,
          pnlPips: 0,
          openTime: new Date(),
          strategyId: queuedOrder.signal.strategyId,
          regime: queuedOrder.signal.regime,
          session: queuedOrder.signal.session,
        });

        useSystemState.getState().incrementDailyTrades();

        await eventBus.emit({
          type: EventType.TRADE_OPENED,
          timestamp: new Date(),
          source: 'execution-engine',
          data: {
            tradeId: result.orderId,
            pair: queuedOrder.order.pair,
            direction: queuedOrder.signal.direction,
            lotSize: result.executedVolume || 0,
            entryPrice: result.executedPrice || 0,
          },
        });
      }

      return result;
    } catch (error) {
      queuedOrder.retries++;

      if (queuedOrder.retries < queuedOrder.maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
        return this.executeOrder(queuedOrder, accountId);
      }

      return {
        orderId: queuedOrder.id,
        status: OrderStatus.REJECTED,
        rejectReason: String(error),
        timestamp: new Date(),
      };
    }
  }

  async closePosition(tradeId: string, accountId: string): Promise<OrderResult> {
    const result = await this.broker.closeOrder(tradeId);

    if (result.status === OrderStatus.FILLED) {
      const position = await this.broker.getPosition(tradeId);

      await this.updateTrade(tradeId, result);

      useSystemState.getState().removePosition(tradeId);

      await eventBus.emit({
        type: EventType.TRADE_CLOSED,
        timestamp: new Date(),
        source: 'execution-engine',
        data: {
          tradeId,
          pair: position?.pair || '',
          direction: useSystemState.getState().positions.find(p => p.tradeId === tradeId)?.direction || 'LONG',
          lotSize: position?.volume || 0,
          exitPrice: result.executedPrice || 0,
          pnl: position?.pnl || 0,
        },
      });

      this.updateAccountBalance(accountId);
    }

    return result;
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;

    this.processing = true;

    while (this.orderQueue.length > 0) {
      this.orderQueue.sort((a, b) => b.priority - a.priority);
      const order = this.orderQueue.shift();

      if (order && order.status === 'pending') {
        order.status = 'processing';
      }
    }

    this.processing = false;
  }

  private calculateLotSize(risk: number, entry: number, stopLoss: number): number {
    const pipDistance = Math.abs(entry - stopLoss) * 10000;
    const pipValue = 10;

    const lotSize = risk / (pipDistance * pipValue);
    return Math.max(0.01, Math.floor(lotSize * 100) / 100);
  }

  private async saveTrade(
    queuedOrder: QueuedOrder,
    result: OrderResult,
    accountId: string,
    latencyMs: number
  ): Promise<void> {
    const tradeId = this.generateTradeId();

    await supabase.from('trades').insert({
      account_id: accountId,
      trade_id: tradeId,
      broker_order_id: result.brokerOrderId,
      pair: queuedOrder.order.pair,
      direction: queuedOrder.signal.direction,
      order_type: 'MARKET',
      lot_size: result.executedVolume || queuedOrder.order.volume,
      entry_price: result.executedPrice,
      stop_loss: queuedOrder.order.stopLoss,
      take_profit: queuedOrder.order.takeProfit,
      executed_at: new Date().toISOString(),
      execution_latency_ms: latencyMs,
      slippage_pips: result.slippagePips,
      spread_at_execution: result.spreadAtExecution,
      status: 'OPEN',
      signal_id: queuedOrder.signal.signalId,
      strategy_id: queuedOrder.signal.strategyId,
      regime_at_entry: queuedOrder.signal.regime,
      session: queuedOrder.signal.session,
      risk_reward_ratio: queuedOrder.signal.riskReward,
    });

    await supabase.from('execution_log').insert({
      trade_id: tradeId,
      account_id: accountId,
      order_id: result.orderId,
      broker_order_id: result.brokerOrderId,
      action: 'OPEN',
      order_type: 'MARKET',
      requested_price: queuedOrder.signal.recommendedEntry,
      executed_price: result.executedPrice,
      slippage_pips: result.slippagePips,
      spread_at_execution: result.spreadAtExecution,
      total_latency_ms: latencyMs,
      requested_volume: queuedOrder.order.volume,
      executed_volume: result.executedVolume,
      status: 'FILLED',
      requested_at: queuedOrder.createdAt.toISOString(),
      executed_at: new Date().toISOString(),
    });
  }

  private async updateTrade(tradeId: string, result: OrderResult): Promise<void> {
    await supabase
      .from('trades')
      .update({
        exit_price: result.executedPrice,
        closed_at: new Date().toISOString(),
        status: 'CLOSED',
        close_reason: 'MANUAL',
      })
      .eq('trade_id', tradeId);
  }

  private async updateAccountBalance(accountId: string): Promise<void> {
    const accountInfo = await this.broker.getAccountInfo();

    await supabase
      .from('accounts')
      .update({
        balance: accountInfo.balance,
        equity: accountInfo.equity,
        margin: accountInfo.margin,
        free_margin: accountInfo.freeMargin,
        margin_level: accountInfo.marginLevel,
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId);

    useSystemState.getState().updateBalance(
      accountInfo.balance,
      accountInfo.equity,
      accountInfo.profit
    );
  }

  private generateOrderId(): string {
    return `ORD-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  private generateTradeId(): string {
    return `TRD-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  getBroker(): BaseBroker {
    return this.broker;
  }

  getOrderQueue(): QueuedOrder[] {
    return this.orderQueue;
  }
}

export const executionEngine = new ExecutionEngine();
