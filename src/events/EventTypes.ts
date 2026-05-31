export enum EventType {
  // System Events
  SYSTEM_INITIALIZED = 'system:initialized',
  SYSTEM_SHUTDOWN = 'system:shutdown',
  SYSTEM_ERROR = 'system:error',
  HEARTBEAT = 'system:heartbeat',

  // Connection Events
  BROKER_CONNECTED = 'broker:connected',
  BROKER_DISCONNECTED = 'broker:disconnected',
  PYTHON_CONNECTED = 'python:connected',
  PYTHON_DISCONNECTED = 'python:disconnected',

  // Account Events
  ACCOUNT_UPDATED = 'account:updated',
  BALANCE_CHANGED = 'account:balance_changed',

  // Trade Events
  TRADE_OPENED = 'trade:opened',
  TRADE_CLOSED = 'trade:closed',
  TRADE_MODIFIED = 'trade:modified',
  TRADE_REJECTED = 'trade:rejected',

  // Signal Events
  SIGNAL_GENERATED = 'signal:generated',
  SIGNAL_SELECTED = 'signal:selected',
  SIGNAL_EXPIRED = 'signal:expired',

  // Scanner Events
  SCAN_STARTED = 'scanner:started',
  SCAN_COMPLETED = 'scanner:completed',
  PAIR_DETECTED = 'scanner:pair_detected',

  // Risk Events
  RISK_LIMIT_BREACH = 'risk:limit_breach',
  CIRCUIT_BREAKER_TRIGGERED = 'risk:circuit_breaker',
  CIRCUIT_BREAKER_RESET = 'risk:circuit_breaker_reset',
  DAILY_LOSS_LIMIT = 'risk:daily_loss_limit',
  MAX_DRAWDOWN = 'risk:max_drawdown',

  // Market Events
  MARKET_REGIME_CHANGED = 'market:regime_changed',
  SESSION_CHANGED = 'market:session_changed',
  NEWS_EVENT_DETECTED = 'market:news_event',

  // Execution Events
  ORDER_SUBMITTED = 'execution:order_submitted',
  ORDER_FILLED = 'execution:order_filled',
  ORDER_REJECTED = 'execution:order_rejected',
  SLIPPAGE_DETECTED = 'execution:slippage',

  // Learning Events
  PERFORMANCE_UPDATED = 'learning:performance_updated',
  STRATEGY_WEIGHT_CHANGED = 'learning:weight_changed',
  MODEL_DRIFT_DETECTED = 'learning:drift_detected',

  // Monitoring Events
  LATENCY_ALERT = 'monitor:latency_alert',
  HEALTH_CHECK = 'monitor:health_check',
  RESOURCE_WARNING = 'monitor:resource_warning',
}

export interface BaseEvent {
  type: EventType;
  timestamp: Date;
  source: string;
  correlationId?: string;
}

export interface SystemEvent extends BaseEvent {
  type: EventType.SYSTEM_INITIALIZED | EventType.SYSTEM_SHUTDOWN | EventType.SYSTEM_ERROR;
  data: {
    status: string;
    error?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface BrokerEvent extends BaseEvent {
  type: EventType.BROKER_CONNECTED | EventType.BROKER_DISCONNECTED;
  data: {
    brokerName: string;
    accountId?: string;
    server?: string;
  };
}

export interface TradeEvent extends BaseEvent {
  type:
    | EventType.TRADE_OPENED
    | EventType.TRADE_CLOSED
    | EventType.TRADE_MODIFIED
    | EventType.TRADE_REJECTED;
  data: {
    tradeId: string;
    pair: string;
    direction: 'LONG' | 'SHORT';
    lotSize: number;
    entryPrice?: number;
    exitPrice?: number;
    pnl?: number;
    reason?: string;
  };
}

export interface SignalEvent extends BaseEvent {
  type: EventType.SIGNAL_GENERATED | EventType.SIGNAL_SELECTED | EventType.SIGNAL_EXPIRED;
  data: {
    signalId: string;
    pair: string;
    direction: 'LONG' | 'SHORT';
    score: number;
    confidence: number;
    strategyId: string;
  };
}

export interface RiskEvent extends BaseEvent {
  type:
    | EventType.RISK_LIMIT_BREACH
    | EventType.CIRCUIT_BREAKER_TRIGGERED
    | EventType.CIRCUIT_BREAKER_RESET
    | EventType.DAILY_LOSS_LIMIT
    | EventType.MAX_DRAWDOWN;
  data: {
    riskType: string;
    currentValue: number;
    thresholdValue: number;
    breachPct: number;
    action: string;
  };
}

export interface MarketEvent extends BaseEvent {
  type: EventType.MARKET_REGIME_CHANGED | EventType.SESSION_CHANGED | EventType.NEWS_EVENT_DETECTED;
  data: {
    pair?: string;
    regime?: string;
    session?: string;
    newsImpact?: string;
    newsCurrency?: string;
    blackoutStarts?: Date;
  };
}

export interface ExecutionEvent extends BaseEvent {
  type:
    | EventType.ORDER_SUBMITTED
    | EventType.ORDER_FILLED
    | EventType.ORDER_REJECTED
    | EventType.SLIPPAGE_DETECTED;
  data: {
    orderId: string;
    pair: string;
    requestedPrice: number;
    executedPrice?: number;
    slippagePips?: number;
    latencyMs?: number;
    reason?: string;
  };
}

export type AnyEvent =
  | SystemEvent
  | BrokerEvent
  | TradeEvent
  | SignalEvent
  | RiskEvent
  | MarketEvent
  | ExecutionEvent;

export type EventHandler<T extends BaseEvent = AnyEvent> = (event: T) => void | Promise<void>;
