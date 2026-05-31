export enum OrderStatus {
  PENDING = 'PENDING',
  SUBMITTED = 'SUBMITTED',
  FILLED = 'FILLED',
  PARTIALLY_FILLED = 'PARTIALLY_FILLED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum OrderType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
  STOP = 'STOP',
}

export enum OrderAction {
  BUY = 'BUY',
  SELL = 'SELL',
}

export interface Order {
  orderId: string;
  pair: string;
  action: OrderAction;
  type: OrderType;
  volume: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
}

export interface OrderResult {
  orderId: string;
  brokerOrderId?: string;
  status: OrderStatus;
  executedPrice?: number;
  executedVolume?: number;
  slippagePips?: number;
  spreadAtExecution?: number;
  latencyMs?: number;
  rejectReason?: string;
  timestamp: Date;
}

export interface Position {
  positionId: string;
  brokerPositionId?: string;
  pair: string;
  action: OrderAction;
  volume: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  pnl: number;
  pnlPips: number;
  swap: number;
  commission: number;
  openTime: Date;
  margin: number;
}

export interface AccountInfo {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  profit: number;
}

export interface TickData {
  pair: string;
  bid: number;
  ask: number;
  spread: number;
  timestamp: Date;
}

export interface OHLCV {
  pair: string;
  timeframe: string;
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BrokerConfig {
  name: string;
  server?: string;
  login?: number;
  password?: string;
  timeout?: number;
  maxRetries?: number;
}

export abstract class BaseBroker {
  protected config: BrokerConfig;
  protected isConnected: boolean = false;

  constructor(config: BrokerConfig) {
    this.config = config;
  }

  abstract connect(): Promise<boolean>;
  abstract disconnect(): Promise<void>;
  abstract isConnectedToBroker(): boolean;

  abstract placeOrder(order: Order): Promise<OrderResult>;
  abstract closeOrder(orderId: string): Promise<OrderResult>;
  abstract modifyOrder(
    orderId: string,
    modifications: { stopLoss?: number; takeProfit?: number }
  ): Promise<OrderResult>;

  abstract getPositions(): Promise<Position[]>;
  abstract getPosition(positionId: string): Promise<Position | null>;
  abstract getAccountInfo(): Promise<AccountInfo>;

  abstract getTick(pair: string): Promise<TickData>;
  abstract getTicks(pairs: string[]): Promise<Map<string, TickData>>;
  abstract getHistory(
    pair: string,
    timeframe: string,
    from: Date,
    to: Date
  ): Promise<OHLCV[]>;

  getName(): string {
    return this.config.name;
  }

  async reconnect(): Promise<boolean> {
    await this.disconnect();
    return this.connect();
  }

  protected generateOrderId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `ORD-${timestamp}-${random}`;
  }
}
