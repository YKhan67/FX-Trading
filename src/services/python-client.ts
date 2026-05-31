import { configManager } from '../core/config';
import { eventBus } from '../events/EventBus';
import { EventType } from '../events/EventTypes';
import { useSystemState } from '../core/state';

interface PythonStatus {
  connected: boolean;
  lastHeartbeat: Date | null;
  brokerConnected: boolean;
  activeOrders: number;
  errorCount: number;
}

interface PythonConfig {
  backendUrl: string;
  wsUrl: string;
  timeout: number;
  reconnectInterval: number;
}

class PythonBackendClient {
  private config: PythonConfig;
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;
  private messageQueue: any[] = [];
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    const config = configManager.get();
    this.config = {
      backendUrl: config.python.backendUrl,
      wsUrl: config.python.wsUrl,
      timeout: config.python.timeout,
      reconnectInterval: config.python.reconnectInterval,
    };
  }

  async connect(): Promise<boolean> {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return true;
    }

    return this.connectWebSocket();
  }

  private async connectWebSocket(): Promise<boolean> {
    this.isConnecting = true;

    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(this.config.wsUrl);

        this.ws.onopen = () => {
          this.isConnecting = false;
          useSystemState.getState().setPythonConnected(true);

          eventBus.emit({
            type: EventType.PYTHON_CONNECTED,
            timestamp: new Date(),
            source: 'python-client',
            data: { brokerName: 'PythonMT5Backend' },
          });

          this.startHeartbeat();
          this.flushMessageQueue();
          resolve(true);
        };

        this.ws.onclose = () => {
          this.isConnecting = false;
          useSystemState.getState().setPythonConnected(false);

          eventBus.emit({
            type: EventType.PYTHON_DISCONNECTED,
            timestamp: new Date(),
            source: 'python-client',
            data: { brokerName: 'PythonMT5Backend' },
          });

          this.scheduleReconnect();
          resolve(false);
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          resolve(false);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            this.ws?.close();
            resolve(false);
          }
        }, this.config.timeout);
      } catch (error) {
        console.error('Failed to connect to Python backend:', error);
        this.isConnecting = false;
        resolve(false);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    useSystemState.getState().setPythonConnected(false);
  }

  async placeOrder(order: {
    pair: string;
    direction: 'LONG' | 'SHORT';
    lotSize: number;
    stopLoss?: number;
    takeProfit?: number;
    orderType?: 'MARKET' | 'LIMIT' | 'STOP';
    price?: number;
  }): Promise<any> {
    return this.send({
      action: 'place_order',
      data: {
        symbol: order.pair,
        order_type: order.orderType || 'MARKET',
        direction: order.direction,
        volume: order.lotSize,
        stop_loss: order.stopLoss,
        take_profit: order.takeProfit,
        price: order.price,
      },
    });
  }

  async closeOrder(orderId: string): Promise<any> {
    return this.send({
      action: 'close_order',
      data: { order_id: orderId },
    });
  }

  async getPositions(): Promise<any[]> {
    return this.send({
      action: 'get_positions',
      data: {},
    });
  }

  async getMarketData(pair: string, timeframe: string, bars: number): Promise<any> {
    return this.send({
      action: 'get_market_data',
      data: {
        symbol: pair,
        timeframe,
        bars,
      },
    });
  }

  async getAccountInfo(): Promise<any> {
    return this.send({
      action: 'get_account_info',
      data: {},
    });
  }

  async subscribeToTicks(pairs: string[]): Promise<void> {
    await this.send({
      action: 'subscribe_ticks',
      data: { symbols: pairs },
    });
  }

  async getStatus(): Promise<PythonStatus> {
    const state = useSystemState.getState();
    return {
      connected: state.pythonConnected,
      lastHeartbeat: state.lastHeartbeat,
      brokerConnected: state.brokerConnected,
      activeOrders: state.openPositions,
      errorCount: state.errorCount,
    };
  }

  private async send(message: any): Promise<any> {
    const payload = JSON.stringify({
      ...message,
      timestamp: new Date().toISOString(),
      requestId: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
    });

    if (this.ws?.readyState === WebSocket.OPEN) {
      return new Promise((resolve, reject) => {
        const requestId = JSON.parse(payload).requestId;

        const handler = (event: MessageEvent) => {
          try {
            const response = JSON.parse(event.data);
            if (response.requestId === requestId) {
              this.ws?.removeEventListener('message', handler);
              resolve(response.data);
            }
          } catch (error) {
            reject(error);
          }
        };

        this.ws?.addEventListener('message', handler);
        this.ws?.send(payload);

        setTimeout(() => {
          this.ws?.removeEventListener('message', handler);
          reject(new Error('Request timeout'));
        }, this.config.timeout);
      });
    } else {
      this.messageQueue.push(payload);
      throw new Error('WebSocket not connected');
    }
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'heartbeat':
          useSystemState.getState().updateHeartbeat();
          break;

        case 'tick':
          this.handleTick(message.data);
          break;

        case 'position_update':
          this.handlePositionUpdate(message.data);
          break;

        case 'order_update':
          this.handleOrderUpdate(message.data);
          break;

        case 'broker_status':
          this.handleBrokerStatus(message.data);
          break;

        case 'error':
          console.error('Python backend error:', message.data);
          useSystemState.getState().setError(message.data.message);
          break;

        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Failed to handle message:', error);
    }
  }

  private handleTick(data: any): void {
    // Update positions with new tick data
    const positions = useSystemState.getState().positions;
    const affectedPos = positions.filter((p) => p.pair === data.symbol);

    affectedPos.forEach((pos) => {
      const currentPrice = pos.direction === 'LONG' ? data.bid : data.ask;
      const pnlPips =
        pos.direction === 'LONG'
          ? (currentPrice - pos.entryPrice) * 10000
          : (pos.entryPrice - currentPrice) * 10000;

      useSystemState.getState().updatePosition(pos.tradeId, {
        currentPrice,
        pnlPips,
        pnl: pos.lotSize * pnlPips * 10,
      });
    });
  }

  private handlePositionUpdate(data: any): void {
    const { positionId, status, pnl, close_reason } = data;

    if (status === 'closed') {
      useSystemState.getState().removePosition(positionId);

      eventBus.emit({
        type: EventType.TRADE_CLOSED,
        timestamp: new Date(),
        source: 'python-client',
        data: {
          tradeId: positionId,
          pair: data.symbol,
          direction: data.direction,
          lotSize: data.volume,
          exitPrice: data.exitPrice,
          pnl,
          reason: close_reason,
        },
      });
    }
  }

  private handleOrderUpdate(data: any): void {
    eventBus.emit({
      type: EventType.ORDER_FILLED,
      timestamp: new Date(),
      source: 'python-client',
      data: {
        orderId: data.orderId,
        pair: data.symbol,
        requestedPrice: data.requestedPrice,
        executedPrice: data.executedPrice,
        slippagePips: data.slippage,
        latencyMs: data.latency,
      },
    });
  }

  private handleBrokerStatus(data: any): void {
    useSystemState.getState().setBrokerConnected(data.connected);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      this.ws.send(message);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      await this.connect();
    }, this.config.reconnectInterval);
  }
}

export const pythonClient = new PythonBackendClient();
