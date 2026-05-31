export interface SystemConfig {
  trading: {
    mode: 'paper' | 'live';
    maxOpenTrades: number;
    maxDailyLossPct: number;
    maxTotalDrawdownPct: number;
    maxRiskPerTradePct: number;
    allowedPairs: string[];
    defaultLotSize: number;
  };
  broker: {
    name: string;
    url: string;
    login: number;
    password: string;
    server: string;
    timeout: number;
    retryAttempts: number;
  };
  python: {
    backendUrl: string;
    wsUrl: string;
    timeout: number;
    reconnectInterval: number;
  };
  scanner: {
    intervalSeconds: number;
    lookbackPeriods: number;
    timeframes: string[];
    signalThreshold: number;
  };
  news: {
    blackoutMinutesBefore: number;
    blackoutMinutesAfter: number;
    impactLevels: string[];
    sources: string[];
  };
  risk: {
    circuitBreakerThreshold: number;
    cooldownPeriodMinutes: number;
    positionSizeMultiplier: number;
    maxCorrelatedRiskPct: number;
  };
  ai: {
    enabled: boolean;
    modelPath: string;
    features: string[];
    updateFrequency: number;
  };
}

export const DEFAULT_CONFIG: SystemConfig = {
  trading: {
    mode: 'paper',
    maxOpenTrades: 1,
    maxDailyLossPct: 5.0,
    maxTotalDrawdownPct: 10.0,
    maxRiskPerTradePct: 1.0,
    allowedPairs: [
      'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD',
      'USDCHF', 'NZDUSD', 'EURGBP', 'EURJPY', 'GBPJPY'
    ],
    defaultLotSize: 0.01,
  },
  broker: {
    name: 'MockBroker',
    url: '',
    login: 0,
    password: '',
    server: '',
    timeout: 5000,
    retryAttempts: 3,
  },
  python: {
    backendUrl: process.env.PYTHON_BACKEND_URL || 'http://localhost:8000',
    wsUrl: process.env.PYTHON_WS_URL || 'ws://localhost:8000/ws',
    timeout: 10000,
    reconnectInterval: 5000,
  },
  scanner: {
    intervalSeconds: 300,
    lookbackPeriods: 100,
    timeframes: ['M15', 'H1', 'H4'],
    signalThreshold: 70,
  },
  news: {
    blackoutMinutesBefore: 30,
    blackoutMinutesAfter: 15,
    impactLevels: ['HIGH'],
    sources: ['economic_calendar'],
  },
  risk: {
    circuitBreakerThreshold: 0.05,
    cooldownPeriodMinutes: 60,
    positionSizeMultiplier: 1.0,
    maxCorrelatedRiskPct: 2.0,
  },
  ai: {
    enabled: true,
    modelPath: '/models/',
    features: ['technical', 'fundamental', 'sentiment', 'volume', 'momentum', 'liquidity'],
    updateFrequency: 3600,
  },
};

export class ConfigManager {
  private config: SystemConfig;
  private storageKey = 'fx-trading-config';

  constructor() {
    this.config = this.load() || DEFAULT_CONFIG;
  }

  get(): SystemConfig {
    return this.config;
  }

  update(updates: Partial<SystemConfig>): void {
    this.config = { ...this.config, ...updates };
    this.save();
  }

  updateSection<K extends keyof SystemConfig>(
    section: K,
    updates: Partial<SystemConfig[K]>
  ): void {
    this.config[section] = { ...this.config[section], ...updates };
    this.save();
  }

  validate(config: SystemConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.trading.maxOpenTrades < 1) {
      errors.push('maxOpenTrades must be at least 1');
    }

    if (config.trading.maxDailyLossPct <= 0 || config.trading.maxDailyLossPct > 100) {
      errors.push('maxDailyLossPct must be between 0 and 100');
    }

    if (config.trading.maxTotalDrawdownPct <= 0 || config.trading.maxTotalDrawdownPct > 100) {
      errors.push('maxTotalDrawdownPct must be between 0 and 100');
    }

    if (config.trading.maxRiskPerTradePct <= 0 || config.trading.maxRiskPerTradePct > 10) {
      errors.push('maxRiskPerTradePct must be between 0 and 10');
    }

    return { valid: errors.length === 0, errors };
  }

  reset(): void {
    this.config = DEFAULT_CONFIG;
    this.save();
  }

  private save(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  private load(): SystemConfig | null {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to load config:', error);
      return null;
    }
  }
}

export const configManager = new ConfigManager();
