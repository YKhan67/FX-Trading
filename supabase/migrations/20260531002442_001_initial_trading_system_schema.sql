/*
  # FX Prop AI Trading System - Initial Schema

  This migration establishes the core database structure for a production-grade
  automated FX trading system with strict prop-firm risk compliance.

  ## Core Tables

  ### 1. accounts
  Primary trading account tracking with prop-firm constraints.
  
  ### 2. trades
  Complete trade history with execution details, risk metrics, and outcomes.
  
  ### 3. signals
  Generated trading signals with scoring, regime detection, and pair selection logic.
  
  ### 4. equity_curve
  Time-series equity snapshots for performance tracking.
  
  ### 5. risk_events
  Risk limit breaches, circuit breaker triggers, and risk adjustments.
  
  ### 6. market_regimes
  Market condition snapshots (trend/range/volatile) per pair.
  
  ### 7. pair_metrics
  Performance statistics per currency pair.
  
  ### 8. strategy_performance
  Strategy-level attribution tracking.
  
  ### 9. news_events
  Economic calendar and news filter data.
  
  ### 10. execution_log
  Order execution details including slippage, latency, spread.
  
  ### 11. system_state
  Global system configuration and state persistence.
  
  ### 12. sessions
  Trading session definitions (Asian/London/NY).

  ## Security
  - All tables have Row Level Security enabled
  - Policies restrict data access to authenticated users
  - Service role has full access for system operations

  ## Important Notes
  1. Default trading mode is PAPER (simulation)
  2. Strict risk limits: 5% daily loss, 10% max drawdown
  3. All monetary values stored as numeric for precision
  4. Timestamps use timezone-aware timestamptz
*/

-- ============================================================================
-- ACCOUNTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Account identification
  account_name text NOT NULL DEFAULT 'Main Trading Account',
  broker_name text DEFAULT 'MT5',
  account_type text DEFAULT 'paper' CHECK (account_type IN ('paper', 'live')),
  
  -- Financial state
  initial_balance numeric(18,2) NOT NULL DEFAULT 100000,
  current_balance numeric(18,2) NOT NULL DEFAULT 100000,
  equity numeric(18,2) NOT NULL DEFAULT 100000,
  margin numeric(18,2) DEFAULT 0,
  free_margin numeric(18,2) DEFAULT 100000,
  margin_level numeric(10,4) DEFAULT 0,
  
  -- Risk limits (prop-firm constraints)
  max_daily_loss_pct numeric(5,2) DEFAULT 5.0 CHECK (max_daily_loss_pct > 0 AND max_daily_loss_pct <= 100),
  max_total_drawdown_pct numeric(5,2) DEFAULT 10.0 CHECK (max_total_drawdown_pct > 0 AND max_total_drawdown_pct <= 100),
  max_risk_per_trade_pct numeric(5,2) DEFAULT 1.0 CHECK (max_risk_per_trade_pct > 0 AND max_risk_per_trade_pct <= 10),
  max_open_trades int DEFAULT 1 CHECK (max_open_trades > 0),
  
  -- Daily tracking
  daily_start_balance numeric(18,2) DEFAULT 100000,
  daily_pnl numeric(18,2) DEFAULT 0,
  daily_trades int DEFAULT 0,
  
  -- Status
  is_active boolean DEFAULT true,
  is_trading_enabled boolean DEFAULT true,
  circuit_breaker_active boolean DEFAULT false,
  circuit_breaker_reason text,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_trade_at timestamptz,
  
  -- Metadata
  risk_score numeric(5,2) DEFAULT 0,
  performance_score numeric(5,2) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_active ON accounts(is_active);

-- ============================================================================
-- TRADES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Trade identification
  trade_id text UNIQUE NOT NULL,
  broker_order_id text,
  
  -- Position details
  pair text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
  order_type text NOT NULL CHECK (order_type IN ('MARKET', 'LIMIT', 'STOP')),
  
  -- Sizing
  lot_size numeric(10,4) NOT NULL,
  requested_lot_size numeric(10,4),
  
  -- Prices
  entry_price numeric(18,6),
  exit_price numeric(18,6),
  requested_price numeric(18,6),
  stop_loss numeric(18,6),
  take_profit numeric(18,6),
  
  -- Execution details
  executed_at timestamptz,
  closed_at timestamptz,
  execution_latency_ms integer,
  slippage_pips numeric(8,4),
  spread_at_execution numeric(10,6),
  
  -- P&L
  pnl numeric(18,2) DEFAULT 0,
  pnl_pips numeric(10,2) DEFAULT 0,
  swap numeric(18,4) DEFAULT 0,
  commission numeric(18,4) DEFAULT 0,
  risk_amount numeric(18,2),
  risk_reward_ratio numeric(6,2),
  
  -- Signal context
  signal_id uuid,
  strategy_id text,
  regime_at_entry text,
  session text,
  
  -- Risk metrics
  max_drawdown_during_trade numeric(18,2),
  max_favorable_excursion numeric(18,2),
  max_adverse_excursion numeric(18,2),
  
  -- Status
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'OPEN', 'CLOSED', 'CANCELLED', 'REJECTED')),
  close_reason text CHECK (close_reason IN ('TAKE_PROFIT', 'STOP_LOSS', 'MANUAL', 'SIGNAL', 'RISK_LIMIT', 'CIRCUIT_BREAKER', 'TIME_EXIT', 'NEWS_FILTER')),
  
  -- Analysis
  thesis text,
  exit_reason text,
  lessons_learned text,
  trader_rating int CHECK (trader_rating >= 1 AND trader_rating <= 5),
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- AI/ML features
  quality_score numeric(5,2),
  optimal_exit_price numeric(18,6),
  execution_quality numeric(5,2)
);

CREATE INDEX IF NOT EXISTS idx_trades_account ON trades(account_id);
CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_pair ON trades(pair);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_executed ON trades(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_signal ON trades(signal_id);

-- ============================================================================
-- SIGNALS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Signal identification
  signal_id text UNIQUE NOT NULL,
  
  -- Market context
  pair text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
  
  -- Signal strength
  score numeric(6,3) NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  confidence numeric(5,2) CHECK (confidence >= 0 AND confidence <= 1),
  
  -- Strategy attribution
  strategy_id text NOT NULL,
  strategy_version text DEFAULT 'v1',
  
  -- Market regime
  detected_regime text CHECK (detected_regime IN ('TREND', 'RANGE', 'VOLATILE', 'BREAKOUT', 'UNKNOWN')),
  regime_confidence numeric(5,2),
  
  -- Session context
  session text CHECK (session IN ('ASIAN', 'LONDON', 'NEW_YORK', 'OVERLAP', 'OFF_HOURS')),
  
  -- Risk context
  recommended_risk_pct numeric(5,2),
  recommended_lot_size numeric(10,4),
  recommended_stop_loss numeric(18,6),
  recommended_take_profit numeric(18,6),
  risk_reward_ratio numeric(6,2),
  
  -- Multi-factor scoring
  technical_score numeric(6,3),
  fundamental_score numeric(6,3),
  sentiment_score numeric(6,3),
  volume_score numeric(6,3),
  momentum_score numeric(6,3),
  liquidity_score numeric(6,3),
  
  -- AI weighting
  ai_weight numeric(5,2) DEFAULT 0,
  ai_features jsonb DEFAULT '{}',
  
  -- News filter
  news_blocked boolean DEFAULT false,
  news_block_reason text,
  
  -- Execution
  was_executed boolean DEFAULT false,
  trade_id uuid REFERENCES trades(id),
  execution_quality numeric(5,2),
  
  -- Outcome tracking
  outcome_pnl numeric(18,2),
  outcome_pips numeric(10,2),
  hit_target boolean,
  
  -- Timestamps
  generated_at timestamptz DEFAULT now(),
  valid_until timestamptz,
  executed_at timestamptz,
  closed_at timestamptz,
  
  -- Priority (for multi-pair scanner)
  priority_rank int,
  scanner_cycle_id uuid
);

CREATE INDEX IF NOT EXISTS idx_signals_account ON signals(account_id);
CREATE INDEX IF NOT EXISTS idx_signals_pair ON signals(pair);
CREATE INDEX IF NOT EXISTS idx_signals_executed ON signals(was_executed);
CREATE INDEX IF NOT EXISTS idx_signals_generated ON signals(generated_at DESC);

-- ============================================================================
-- EQUITY CURVE TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS equity_curve (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Snapshot data
  timestamp timestamptz NOT NULL DEFAULT now(),
  
  -- Equity components
  balance numeric(18,2) NOT NULL,
  equity numeric(18,2) NOT NULL,
  floating_pnl numeric(18,2) DEFAULT 0,
  margin numeric(18,2) DEFAULT 0,
  free_margin numeric(18,2) DEFAULT 0,
  margin_level numeric(10,4) DEFAULT 0,
  
  -- Drawdown tracking
  peak_equity numeric(18,2),
  current_drawdown_pct numeric(6,3),
  daily_drawdown_pct numeric(6,3),
  
  -- Performance metrics
  daily_return_pct numeric(8,5),
  cumulative_return_pct numeric(10,4),
  
  -- Position summary
  open_positions int DEFAULT 0,
  total_lots numeric(10,4) DEFAULT 0,
  exposure_pct numeric(6,2) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_equity_account ON equity_curve(account_id);
CREATE INDEX IF NOT EXISTS idx_equity_timestamp ON equity_curve(timestamp DESC);

-- ============================================================================
-- RISK EVENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS risk_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Event identification
  event_type text NOT NULL CHECK (event_type IN (
    'DAILY_LOSS_LIMIT', 'MAX_DRAWDOWN', 'CIRCUIT_BREAKER_TRIGGER',
    'CIRCUIT_BREAKER_RESET', 'RISK_ADJUSTMENT', 'POSITION_SIZE_LIMIT',
    'CORRELATION_LIMIT', 'EXPOSURE_LIMIT', 'NEWS_FILTER_BLOCK',
    'REGIME_FILTER_BLOCK', 'LIQUIDITY_FILTER_BLOCK'
  )),
  
  -- Severity
  severity text NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  
  -- Event details
  triggered_value numeric(18,4),
  threshold_value numeric(18,4),
  breach_pct numeric(8,4),
  
  -- Impact
  trading_blocked boolean DEFAULT false,
  positions_closed int DEFAULT 0,
  pnl_impact numeric(18,2),
  
  -- Context
  description text NOT NULL,
  metadata jsonb DEFAULT '{}',
  
  -- Resolution
  resolved_at timestamptz,
  resolution text,
  
  -- Timestamps
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_events_account ON risk_events(account_id);
CREATE INDEX IF NOT EXISTS idx_risk_events_type ON risk_events(event_type);
CREATE INDEX IF NOT EXISTS idx_risk_events_created ON risk_events(created_at DESC);

-- ============================================================================
-- MARKET REGIMES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS market_regimes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Pair identification
  pair text NOT NULL,
  timeframe text NOT NULL DEFAULT 'H1',
  
  -- Regime classification
  regime_type text NOT NULL CHECK (regime_type IN ('TREND_UP', 'TREND_DOWN', 'RANGE', 'VOLATILE', 'BREAKOUT', 'UNKNOWN')),
  confidence numeric(5,2) DEFAULT 0,
  
  -- Trend metrics
  trend_strength numeric(5,2),
  trend_direction text CHECK (trend_direction IN ('BULLISH', 'BEARISH', 'NEUTRAL')),
  adx numeric(8,3),
  
  -- Volatility metrics
  atr numeric(18,6),
  atr_pct numeric(8,4),
  volatility_rank int CHECK (volatility_rank >= 0 AND volatility_rank <= 100),
  
  -- Range metrics
  range_high numeric(18,6),
  range_low numeric(18,6),
  range_width_pips numeric(10,2),
  
  -- Session context
  active_session text,
  liquidity_level text CHECK (liquidity_level IN ('LOW', 'MEDIUM', 'HIGH')),
  
  -- Price levels
  current_price numeric(18,6),
  support_levels jsonb DEFAULT '[]',
  resistance_levels jsonb DEFAULT '[]',
  
  -- Feature vector for ML
  feature_vector jsonb DEFAULT '{}',
  
  -- Timestamps
  detected_at timestamptz DEFAULT now(),
  valid_until timestamptz
);

CREATE INDEX IF NOT EXISTS idx_market_regimes_pair ON market_regimes(pair, timeframe);
CREATE INDEX IF NOT EXISTS idx_market_regimes_detected ON market_regimes(detected_at DESC);

-- ============================================================================
-- PAIR METRICS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS pair_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Pair identification
  pair text NOT NULL,
  
  -- Performance metrics
  total_trades int DEFAULT 0,
  winning_trades int DEFAULT 0,
  losing_trades int DEFAULT 0,
  win_rate numeric(5,2) DEFAULT 0,
  
  -- P&L tracking
  total_pnl numeric(18,2) DEFAULT 0,
  avg_pnl numeric(18,2),
  max_win numeric(18,2),
  max_loss numeric(18,2),
  profit_factor numeric(10,4),
  
  -- Pip metrics
  total_pips numeric(12,2) DEFAULT 0,
  avg_pips numeric(10,2),
  avg_win_pips numeric(10,2),
  avg_loss_pips numeric(10,2),
  
  -- Risk metrics
  avg_rr_ratio numeric(6,2),
  avg_risk numeric(18,2),
  sharpe_ratio numeric(8,4),
  sortino_ratio numeric(8,4),
  
  -- Execution quality
  avg_slippage numeric(8,4),
  avg_spread numeric(10,6),
  avg_latency_ms integer,
  
  -- Session performance
  asian_performance numeric(18,2) DEFAULT 0,
  london_performance numeric(18,2) DEFAULT 0,
  ny_performance numeric(18,2) DEFAULT 0,
  
  -- Regime performance
  trend_performance numeric(18,2) DEFAULT 0,
  range_performance numeric(18,2) DEFAULT 0,
  volatile_performance numeric(18,2) DEFAULT 0,
  
  -- Learning scores
  ai_score numeric(5,2),
  experience_score numeric(5,2),
  decay_factor numeric(6,4) DEFAULT 1.0,
  
  -- Timestamps
  period_start timestamptz,
  period_end timestamptz,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pair_metrics_account ON pair_metrics(account_id);
CREATE INDEX IF NOT EXISTS idx_pair_metrics_pair ON pair_metrics(pair);

-- ============================================================================
-- STRATEGY PERFORMANCE TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS strategy_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Strategy identification
  strategy_id text NOT NULL,
  strategy_name text NOT NULL,
  strategy_version text DEFAULT 'v1',
  
  -- Performance metrics
  total_trades int DEFAULT 0,
  winning_trades int DEFAULT 0,
  win_rate numeric(5,2) DEFAULT 0,
  
  -- P&L
  total_pnl numeric(18,2) DEFAULT 0,
  avg_pnl numeric(18,2),
  profit_factor numeric(10,4),
  
  -- Regime-specific performance
  trend_performance numeric(18,2) DEFAULT 0,
  range_performance numeric(18,2) DEFAULT 0,
  volatile_performance numeric(18,2) DEFAULT 0,
  
  -- Session performance
  asian_performance numeric(18,2) DEFAULT 0,
  london_performance numeric(18,2) DEFAULT 0,
  ny_performance numeric(18,2) DEFAULT 0,
  
  -- AI metrics
  current_weight numeric(5,2) DEFAULT 1.0,
  predicted_performance numeric(5,2),
  drift_score numeric(5,2),
  
  -- Attribution
  attribution_score numeric(5,2),
  confidence_level numeric(5,2),
  
  -- Timestamps
  period_start timestamptz,
  period_end timestamptz,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_strategy_perf_account ON strategy_performance(account_id);
CREATE INDEX IF NOT EXISTS idx_strategy_perf_id ON strategy_performance(strategy_id);

-- ============================================================================
-- NEWS EVENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS news_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event identification
  event_id text UNIQUE NOT NULL,
  
  -- Event details
  event_name text NOT NULL,
  currency text NOT NULL,
  impact text NOT NULL CHECK (impact IN ('HIGH', 'MEDIUM', 'LOW')),
  
  -- Timing
  event_date date NOT NULL,
  event_time timestamptz NOT NULL,
  
  -- Market expectations
  forecast_value text,
  actual_value text,
  previous_value text,
  
  -- Impact tracking
  deviation numeric(10,4),
  surprise_factor numeric(6,3),
  
  -- Trading constraints
  blackout_start timestamptz,
  blackout_end timestamptz,
  trading_blocked boolean DEFAULT false,
  
  -- Affected pairs
  affected_pairs jsonb DEFAULT '[]',
  
  -- Source
  source text DEFAULT 'economic_calendar',
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_news_events_date ON news_events(event_date);
CREATE INDEX IF NOT EXISTS idx_news_events_time ON news_events(event_time);
CREATE INDEX IF NOT EXISTS idx_news_events_impact ON news_events(impact);
CREATE INDEX IF NOT EXISTS idx_news_events_currency ON news_events(currency);

-- ============================================================================
-- EXECUTION LOG TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS execution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid REFERENCES trades(id) ON DELETE CASCADE,
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Order details
  order_id text,
  broker_order_id text,
  
  -- Execution type
  action text NOT NULL CHECK (action IN ('OPEN', 'CLOSE', 'MODIFY', 'CANCEL')),
  order_type text CHECK (order_type IN ('MARKET', 'LIMIT', 'STOP')),
  
  -- Execution metrics
  requested_price numeric(18,6),
  executed_price numeric(18,6),
  price_improvement numeric(10,6),
  slippage_pips numeric(8,4),
  spread_at_execution numeric(10,6),
  
  -- Timing
  requested_at timestamptz,
  submitted_at timestamptz,
  executed_at timestamptz,
  confirmed_at timestamptz,
  total_latency_ms integer,
  broker_latency_ms integer,
  
  -- Volume
  requested_volume numeric(10,4),
  executed_volume numeric(10,4),
  fill_rate numeric(5,2),
  
  -- Quality metrics
  execution_quality numeric(5,2),
  market_impact numeric(10,6),
  
  -- Status
  status text NOT NULL CHECK (status IN ('PENDING', 'SUBMITTED', 'FILLED', 'PARTIALLY_FILLED', 'REJECTED', 'CANCELLED')),
  reject_reason text,
  
  -- Metadata
  metadata jsonb DEFAULT '{}',
  
  -- Timestamps
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_execution_log_trade ON execution_log(trade_id);
CREATE INDEX IF NOT EXISTS idx_execution_log_account ON execution_log(account_id);
CREATE INDEX IF NOT EXISTS idx_execution_log_created ON execution_log(created_at DESC);

-- ============================================================================
-- SYSTEM STATE TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- System mode
  trading_mode text DEFAULT 'paper' CHECK (trading_mode IN ('paper', 'live')),
  is_active boolean DEFAULT true,
  
  -- Configuration
  config jsonb DEFAULT '{}',
  
  -- Feature flags
  features jsonb DEFAULT '{}',
  
  -- Connection status
  broker_connected boolean DEFAULT false,
  broker_name text,
  broker_connection_time timestamptz,
  
  -- Python backend status
  python_backend_url text,
  python_backend_connected boolean DEFAULT false,
  python_backend_status jsonb DEFAULT '{}',
  
  -- Scanner state
  last_scan_at timestamptz,
  scan_interval_seconds int DEFAULT 300,
  active_pairs jsonb DEFAULT '[]',
  
  -- State blob
  state_data jsonb DEFAULT '{}',
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_state_account ON system_state(account_id);

-- ============================================================================
-- SESSIONS TABLE (Trading Hours)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Session identification
  session_name text NOT NULL CHECK (session_name IN ('ASIAN', 'LONDON', 'NEW_YORK', 'OVERLAP_LONDON_NY', 'OVERLAP_ASIAN_LONDON')),
  
  -- Timing (UTC hours)
  start_hour int NOT NULL CHECK (start_hour >= 0 AND start_hour < 24),
  start_minute int DEFAULT 0 CHECK (start_minute >= 0 AND start_minute < 60),
  end_hour int NOT NULL CHECK (end_hour >= 0 AND end_hour < 24),
  end_minute int DEFAULT 0 CHECK (end_minute >= 0 AND end_minute < 60),
  
  -- Characteristics
  liquidity_level text DEFAULT 'MEDIUM' CHECK (liquidity_level IN ('LOW', 'MEDIUM', 'HIGH')),
  volatility_level text DEFAULT 'MEDIUM' CHECK (volatility_level IN ('LOW', 'MEDIUM', 'HIGH')),
  
  -- Preferred pairs
  preferred_pairs jsonb DEFAULT '[]',
  
  -- Session performance
  avg_spread_pips numeric(8,3),
  avg_volatility numeric(10,4),
  
  -- Trading rules
  trading_allowed boolean DEFAULT true,
  max_lot_multiplier numeric(5,2) DEFAULT 1.0,
  
  -- Timestamps
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE equity_curve ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_regimes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pair_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE RLS POLICIES - ACCOUNTS
-- ============================================================================
CREATE POLICY "Users can view own accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own accounts"
  ON accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts"
  ON accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- CREATE RLS POLICIES - TRADES
-- ============================================================================
CREATE POLICY "Users can view own trades"
  ON trades FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own trades"
  ON trades FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trades"
  ON trades FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- CREATE RLS POLICIES - SIGNALS
-- ============================================================================
CREATE POLICY "Users can view own signals"
  ON signals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own signals"
  ON signals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own signals"
  ON signals FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- CREATE RLS POLICIES - EQUITY CURVE
-- ============================================================================
CREATE POLICY "Users can view own equity curve"
  ON equity_curve FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own equity curve"
  ON equity_curve FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- CREATE RLS POLICIES - RISK EVENTS
-- ============================================================================
CREATE POLICY "Users can view own risk events"
  ON risk_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own risk events"
  ON risk_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- CREATE RLS POLICIES - PAIR METRICS
-- ============================================================================
CREATE POLICY "Users can view own pair metrics"
  ON pair_metrics FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own pair metrics"
  ON pair_metrics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pair metrics"
  ON pair_metrics FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- CREATE RLS POLICIES - STRATEGY PERFORMANCE
-- ============================================================================
CREATE POLICY "Users can view own strategy performance"
  ON strategy_performance FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own strategy performance"
  ON strategy_performance FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own strategy performance"
  ON strategy_performance FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- CREATE RLS POLICIES - EXECUTION LOG
-- ============================================================================
CREATE POLICY "Users can view own execution log"
  ON execution_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own execution log"
  ON execution_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- CREATE RLS POLICIES - SYSTEM STATE
-- ============================================================================
CREATE POLICY "Users can view own system state"
  ON system_state FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own system state"
  ON system_state FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own system state"
  ON system_state FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- CREATE RLS POLICIES - MARKET REGIMES (Read-only for all authenticated)
-- ============================================================================
CREATE POLICY "Authenticated users can view market regimes"
  ON market_regimes FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- CREATE RLS POLICIES - NEWS EVENTS (Read-only for all authenticated)
-- ============================================================================
CREATE POLICY "Authenticated users can view news events"
  ON news_events FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- CREATE RLS POLICIES - SESSIONS (Read-only for all authenticated)
-- ============================================================================
CREATE POLICY "Authenticated users can view sessions"
  ON sessions FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- INSERT DEFAULT SESSIONS DATA
-- ============================================================================
INSERT INTO sessions (session_name, start_hour, end_hour, liquidity_level, volatility_level, preferred_pairs) VALUES
('ASIAN', 0, 8, 'MEDIUM', 'LOW', '["USDJPY", "AUDJPY", "NZDJPY", "AUDUSD", "NZDUSD"]'),
('LONDON', 8, 16, 'HIGH', 'MEDIUM', '["EURUSD", "GBPUSD", "EURGBP", "GBPJPY", "EURJPY"]'),
('NEW_YORK', 13, 21, 'HIGH', 'MEDIUM', '["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "USDCAD"]'),
('OVERLAP_LONDON_NY', 13, 16, 'HIGH', 'HIGH', '["EURUSD", "GBPUSD", "USDJPY"]'),
('OVERLAP_ASIAN_LONDON', 8, 9, 'MEDIUM', 'MEDIUM', '["EURJPY", "GBPJPY", "USDJPY"]')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- CREATE TIMESTAMP TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON trades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pair_metrics_updated_at BEFORE UPDATE ON pair_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_strategy_perf_updated_at BEFORE UPDATE ON strategy_performance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_state_updated_at BEFORE UPDATE ON system_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_news_events_updated_at BEFORE UPDATE ON news_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();