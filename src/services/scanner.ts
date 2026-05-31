import { supabase } from '../lib/supabase';
import { eventBus } from '../events/EventBus';
import { EventType } from '../events/EventTypes';
import { MarketRegime, Session, useSystemState } from '../core/state';
import { configManager } from '../core/config';
import { signalEngine } from './signal-engine';

export class MultiPairScanner {
  private scanInterval: NodeJS.Timeout | null = null;
  private isScanning: boolean = false;
  private pairs: string[] = [];
  private currentCycleId: string | null = null;

  constructor() {
    this.pairs = configManager.get().trading.allowedPairs;
  }

  async start(accountId: string): Promise<void> {
    const intervalMs = configManager.get().scanner.intervalSeconds * 1000;

    await this.scan(accountId);

    this.scanInterval = setInterval(() => {
      this.scan(accountId);
    }, intervalMs);
  }

  stop(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }

  private async scan(accountId: string): Promise<void> {
    if (this.isScanning) return;

    this.isScanning = true;
    this.currentCycleId = this.generateCycleId();

    useSystemState.getState().startScan();

    await eventBus.emit({
      type: EventType.SCAN_STARTED,
      timestamp: new Date(),
      source: 'multi-pair-scanner',
      data: { status: 'scanning' },
    });

    try {
      await this.detectSession();
      await this.updateRegimes();

      const signals = await signalEngine.generateSignals(accountId, this.pairs);

      if (signals.length > 0) {
        useSystemState.getState().clearSignals();
        signals.slice(0, 10).forEach((signal) => {
          useSystemState.getState().addSignal(signal);
        });

        const bestSignal = signals[0];
        await eventBus.emit({
          type: EventType.SIGNAL_SELECTED,
          timestamp: new Date(),
          source: 'multi-pair-scanner',
          data: {
            signalId: bestSignal.signalId,
            pair: bestSignal.pair,
            direction: bestSignal.direction,
            score: bestSignal.score,
            confidence: bestSignal.confidence,
            strategyId: bestSignal.strategyId,
          },
        });
      }
    } catch (error) {
      console.error('Scan error:', error);
      useSystemState.getState().setError(String(error));
    } finally {
      this.isScanning = false;
      useSystemState.getState().endScan();

      await eventBus.emit({
        type: EventType.SCAN_COMPLETED,
        timestamp: new Date(),
        source: 'multi-pair-scanner',
        data: { status: 'completed' },
      });
    }
  }

  private async detectSession(): Promise<void> {
    const utcHour = new Date().getUTCHours();
    let session: Session;

    if (utcHour >= 0 && utcHour < 8) {
      session = 'ASIAN';
    } else if (utcHour >= 8 && utcHour < 13) {
      session = 'LONDON';
    } else if (utcHour >= 13 && utcHour < 16) {
      session = 'OVERLAP_LONDON_NY';
    } else if (utcHour >= 16 && utcHour < 21) {
      session = 'NEW_YORK';
    } else {
      session = 'OFF_HOURS';
    }

    useSystemState.getState().setCurrentSession(session);

    const previousSession = useSystemState.getState().currentSession;
    if (previousSession !== session) {
      await eventBus.emit({
        type: EventType.SESSION_CHANGED,
        timestamp: new Date(),
        source: 'multi-pair-scanner',
        data: {
          session,
          regime: '',
        },
      });
    }
  }

  private async updateRegimes(): Promise<void> {
    const pythonConnected = useSystemState.getState().pythonConnected;

    if (pythonConnected) {
      // TODO: Fetch real regime data from Python backend
    }

    // Use mock regime data for now
    for (const pair of this.pairs) {
      const regime = this.generateMockRegime(pair);
      useSystemState.getState().setRegime(pair, regime);
    }
  }

  private generateMockRegime(pair: string): MarketRegime {
    const regimes: MarketRegime[] = ['TREND_UP', 'TREND_DOWN', 'RANGE', 'VOLATILE', 'UNKNOWN'];
    const random = Math.random();

    if (random < 0.3) return 'TREND_UP';
    if (random < 0.5) return 'RANGE';
    if (random < 0.7) return 'VOLATILE';
    if (random < 0.85) return 'TREND_DOWN';
    return 'UNKNOWN';
  }

  private generateCycleId(): string {
    return `SCAN-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  isActive(): boolean {
    return this.isScanning;
  }

  getPairs(): string[] {
    return this.pairs;
  }
}

export const multiPairScanner = new MultiPairScanner();
