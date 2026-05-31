import {
  BaseBroker,
  Order,
  OrderResult,
  Position,
  AccountInfo,
  TickData,
  OHLCV,
  BrokerConfig,
  OrderStatus,
  OrderAction,
} from './BaseBroker';

interface MockPosition extends Position {
  id: string;
}

export class MockBroker extends BaseBroker {
  private positions: Map<string, MockPosition> = new Map();
  private accountBalance: number = 100000;
  private accountEquity: number = 100000;
  private tickCache: Map<string, TickData> = new Map();
  private orderCounter: number = 0;
  private latencySimulation: number = 50;
  private slippageSimulation: number = 0.5;
  private spreadSimulation: number = 2;

  constructor(config: BrokerConfig) {
    super(config);
    this.initializeMockData();
  }

  private initializeMockData(): void {
    const pairs = [
      'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD',
      'USDCHF', 'NZDUSD', 'EURGBP', 'EURJPY', 'GBPJPY'
    ];

    const rates: Record<string, { bid: number; ask: number }> = {
      EURUSD: { bid: 1.0850, ask: 1.0852 },
      GBPUSD: { bid: 1.2650, ask: 1.2652 },
      USDJPY: { bid: 149.50, ask: 149.52 },
      AUDUSD: { bid: 0.6500, ask: 0.6502 },
      USDCAD: { bid: 1.3600, ask: 1.3602 },
      USDCHF: { bid: 0.8800, ask: 0.8802 },
      NZDUSD: { bid: 0.6000, ask: 0.6002 },
      EURGBP: { bid: 0.8580, ask: 0.8582 },
      EURJPY: { bid: 162.20, ask: 162.22 },
      GBPJPY: { bid: 189.10, ask: 189.12 },
    };

    pairs.forEach((pair) => {
      const rate = rates[pair] || { bid: 1.0000, ask: 1.0002 };
      this.tickCache.set(pair, {
        pair,
        bid: rate.bid,
        ask: rate.ask,
        spread: (rate.ask - rate.bid) * 10000,
        timestamp: new Date(),
      });
    });
  }

  async connect(): Promise<boolean> {
    await this.simulateLatency();
    this.isConnected = true;
    console.log(`[${this.config.name}] Connected to mock broker`);
    return true;
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    console.log(`[${this.config.name}] Disconnected from mock broker`);
  }

  isConnectedToBroker(): boolean {
    return this.isConnected;
  }

  async placeOrder(order: Order): Promise<OrderResult> {
    if (!this.isConnected) {
      return this.rejectOrder(order, 'Broker not connected');
    }

    await this.simulateLatency();

    const tick = await this.getTick(order.pair);
    const executedPrice = this.calculateExecutionPrice(order, tick);
    const slippagePips = this.calculateSlippage(order, tick);

    if (slippagePips > 3) {
      return this.rejectOrder(order, `Slippage too high: ${slippagePips.toFixed(2)} pips`);
    }

    const position: MockPosition = {
      id: order.orderId,
      positionId: order.orderId,
      pair: order.pair,
      action: order.action,
      volume: order.volume,
      entryPrice: executedPrice,
      currentPrice: executedPrice,
      stopLoss: order.stopLoss || 0,
      takeProfit: order.takeProfit || 0,
      pnl: 0,
      pnlPips: 0,
      swap: 0,
      commission: Math.abs(order.volume) * 7,
      openTime: new Date(),
      margin: this.calculateMargin(order.volume, executedPrice),
    };

    this.positions.set(position.id, position);

    return {
      orderId: order.orderId,
      brokerOrderId: `MOCK-${++this.orderCounter}`,
      status: OrderStatus.FILLED,
      executedPrice,
      executedVolume: order.volume,
      slippagePips,
      spreadAtExecution: tick.spread,
      timestamp: new Date(),
    };
  }

  async closeOrder(orderId: string): Promise<OrderResult> {
    if (!this.isConnected) {
      return {
        orderId,
        status: OrderStatus.REJECTED,
        rejectReason: 'Broker not connected',
        timestamp: new Date(),
      };
    }

    await this.simulateLatency();

    const position = this.positions.get(orderId);
    if (!position) {
      return {
        orderId,
        status: OrderStatus.REJECTED,
        rejectReason: 'Position not found',
        timestamp: new Date(),
      };
    }

    const tick = await this.getTick(position.pair);
    const closePrice = position.action === OrderAction.BUY ? tick.bid : tick.ask;
    const pnlPips = this.calculatePnlPips(position, closePrice);
    const pnl = position.volume * pnlPips * 10;

    this.accountBalance += pnl;
    this.accountEquity = this.accountBalance;
    this.positions.delete(orderId);

    return {
      orderId,
      status: OrderStatus.FILLED,
      executedPrice: closePrice,
      executedVolume: position.volume,
      slippagePips: this.randomSlippage(),
      spreadAtExecution: tick.spread,
      timestamp: new Date(),
    };
  }

  async modifyOrder(
    orderId: string,
    modifications: { stopLoss?: number; takeProfit?: number }
  ): Promise<OrderResult> {
    const position = this.positions.get(orderId);
    if (!position) {
      return {
        orderId,
        status: OrderStatus.REJECTED,
        rejectReason: 'Position not found',
        timestamp: new Date(),
      };
    }

    await this.simulateLatency();

    if (modifications.stopLoss !== undefined) {
      position.stopLoss = modifications.stopLoss;
    }
    if (modifications.takeProfit !== undefined) {
      position.takeProfit = modifications.takeProfit;
    }

    this.positions.set(orderId, position);

    return {
      orderId,
      status: OrderStatus.FILLED,
      timestamp: new Date(),
    };
  }

  async getPositions(): Promise<Position[]> {
    await this.simulateLatency();

    const positions = Array.from(this.positions.values());

    for (const pos of positions) {
      const tick = await this.getTick(pos.pair);
      pos.currentPrice = pos.action === OrderAction.BUY ? tick.bid : tick.ask;
      pos.pnlPips = this.calculatePnlPips(pos, pos.currentPrice);
      pos.pnl = pos.volume * pos.pnlPips * 10;
    }

    return positions;
  }

  async getPosition(positionId: string): Promise<Position | null> {
    const position = this.positions.get(positionId);
    if (!position) return null;

    const tick = await this.getTick(position.pair);
    position.currentPrice = position.action === OrderAction.BUY ? tick.bid : tick.ask;
    position.pnlPips = this.calculatePnlPips(position, position.currentPrice);
    position.pnl = position.volume * position.pnlPips * 10;

    return position;
  }

  async getAccountInfo(): Promise<AccountInfo> {
    const positions = await this.getPositions();
    const floatingPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
    const margin = positions.reduce((sum, p) => sum + p.margin, 0);

    this.accountEquity = this.accountBalance + floatingPnl;

    return {
      balance: this.accountBalance,
      equity: this.accountEquity,
      margin,
      freeMargin: this.accountEquity - margin,
      marginLevel: margin > 0 ? (this.accountEquity / margin) * 100 : 0,
      profit: floatingPnl,
    };
  }

  async getTick(pair: string): Promise<TickData> {
    let tick = this.tickCache.get(pair);

    if (!tick) {
      tick = {
        pair,
        bid: 1.0000,
        ask: 1.0002,
        spread: 2,
        timestamp: new Date(),
      };
      this.tickCache.set(pair, tick);
    }

    tick = this.fluctuatePrice(tick);
    tick.timestamp = new Date();

    return tick;
  }

  async getTicks(pairs: string[]): Promise<Map<string, TickData>> {
    const ticks = new Map<string, TickData>();

    for (const pair of pairs) {
      ticks.set(pair, await this.getTick(pair));
    }

    return ticks;
  }

  async getHistory(
    pair: string,
    timeframe: string,
    from: Date,
    to: Date
  ): Promise<OHLCV[]> {
    const candles: OHLCV[] = [];
    const intervalMinutes = this.getIntervalMinutes(timeframe);
    const current = new Date(from);

    let basePrice = Math.random() * 0.1 + 1.0;

    while (current <= to) {
      const open = basePrice;
      const volatility = Math.random() * 0.01;
      const change = (Math.random() - 0.5) * volatility;
      const close = open + change;
      const high = Math.max(open, close) + Math.random() * volatility * 0.5;
      const low = Math.min(open, close) - Math.random() * volatility * 0.5;

      candles.push({
        pair,
        timeframe,
        timestamp: new Date(current),
        open,
        high,
        low,
        close,
        volume: Math.floor(Math.random() * 10000) + 1000,
      });

      basePrice = close;
      current.setMinutes(current.getMinutes() + intervalMinutes);
    }

    return candles;
  }

  deposit(amount: number): void {
    this.accountBalance += amount;
    this.accountEquity += amount;
  }

  withdraw(amount: number): boolean {
    if (amount > this.accountBalance) return false;
    this.accountBalance -= amount;
    this.accountEquity -= amount;
    return true;
  }

  private rejectOrder(order: Order, reason: string): OrderResult {
    return {
      orderId: order.orderId,
      status: OrderStatus.REJECTED,
      rejectReason: reason,
      timestamp: new Date(),
    };
  }

  private calculateExecutionPrice(order: Order, tick: TickData): number {
    if (order.action === OrderAction.BUY) {
      return tick.ask + (this.randomSlippage() / 10000);
    }
    return tick.bid - (this.randomSlippage() / 10000);
  }

  private calculateSlippage(order: Order, tick: TickData): number {
    return this.randomSlippage();
  }

  private randomSlippage(): number {
    return Math.random() * this.slippageSimulation;
  }

  private calculatePnlPips(position: Position, currentPrice: number): number {
    const priceDiff = position.action === OrderAction.BUY
      ? currentPrice - position.entryPrice
      : position.entryPrice - currentPrice;

    return priceDiff * 10000;
  }

  private calculateMargin(volume: number, price: number): number {
    const leverage = 100;
    return (volume * 100000 * price) / leverage;
  }

  private simulateLatency(): Promise<void> {
    return new Promise((resolve) =>
      setTimeout(resolve, Math.random() * this.latencySimulation)
    );
  }

  private fluctuatePrice(tick: TickData): TickData {
    const fluctuation = Math.random() * 0.0002 - 0.0001;
    return {
      ...tick,
      bid: tick.bid + fluctuation,
      ask: tick.ask + fluctuation,
      spread: tick.spread + (Math.random() * 0.2 - 0.1),
    };
  }

  private getIntervalMinutes(timeframe: string): number {
    const intervals: Record<string, number> = {
      M1: 1,
      M5: 5,
      M15: 15,
      M30: 30,
      H1: 60,
      H4: 240,
      D1: 1440,
    };
    return intervals[timeframe] || 60;
  }
}
