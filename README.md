# FX Prop AI Trading System

A production-grade automated FX trading system with strict prop-firm risk compliance, using a hybrid TypeScript/Python architecture.

![Trading Dashboard](https://images.unsplash.com/photo-1611974789855-9c383c096db0?w=800&h=400&fit=crop)

## System Architecture

```
┌─────────────────────┐
│  React Dashboard    │  (Real-time UI)
│  TypeScript Frontend│
└──────────┬──────────┘
           │ WebSocket + REST
┌──────────▼──────────┐
│  TypeScript API     │  (Business Logic)
│  - Risk Engine      │
│  - Signal Engine    │
│  - Execution Engine │
└──────────┬──────────┘
           │ WebSocket
┌──────────▼──────────┐
│  Python MT5 Backend │  (Broker Connection)
│  - MT5 Connector    │
│  - Order Execution  │
│  - Market Data      │
└─────────────────────┘
```

## Project Structure

```
FX-Trading/
├── src/                    # TypeScript Frontend
│   ├── components/         # React components
│   ├── core/              # Config, State, Events
│   ├── services/          # Risk, Signal, Execution engines
│   ├── broker/            # Broker abstraction (MockBroker)
│   └── pages/             # Dashboard, Trades, Signals, Risk, Settings
│
├── python-backend/         # Python MT5 Service
│   ├── app/
│   │   ├── api/           # REST + WebSocket endpoints
│   │   ├── services/      # MT5 connector, tick streamer
│   │   └── models/        # Pydantic models
│   └── requirements.txt   # Python dependencies
│
└── supabase/
    └── migrations/         # Database schema
```

## Features

### Risk Management (Prop-Firm Compliant)
- **Daily Loss Limit**: 5% maximum daily loss
- **Max Drawdown**: 10% maximum account drawdown
- **Risk Per Trade**: 1% maximum risk per position
- **Position Limit**: 1 open trade at a time
- **Circuit Breaker**: Automatic trading halt on risk breach
- **News Filter**: Avoids high-impact news events

### Trading Engine
- **Multi-Pair Scanner**: Simultaneously scans 10+ FX pairs
- **Strategy Engine**: Multiple strategies (Liquidity Hunter, Trend Rider)
- **Signal Scoring**: Multi-factor analysis (technical, fundamental, sentiment, volume, momentum, liquidity)
- **Regime Detection**: Market condition classification
- **Session Awareness**: Asian/London/NY optimization

### Technology Stack
- **Frontend**: React 18, TypeScript, TailwindCSS, Recharts, Zustand
- **Middle Tier**: Node.js/TypeScript (risk, signal, execution engines)
- **Backend**: Python, FastAPI, MetaTrader5
- **Database**: Supabase (PostgreSQL with RLS)

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.8+
- MetaTrader 5 terminal
- Supabase account

### 1. Clone Repository
```bash
git clone https://github.com/YKhan67/FX-Trading.git
cd FX-Trading
```

### 2. TypeScript Frontend

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# Apply database migration
# Copy supabase/migrations/*.sql to Supabase SQL editor and run

# Start development server
npm run dev

# Build for production
npm run build
```

### 3. Python Backend (Optional - for Live Trading)

```bash
cd python-backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure MT5 credentials
cp .env.example .env
# Edit .env with your MT5 login, password, server

# Run the backend
python run.py
```

## Configuration

### Environment Variables (TypeScript)
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
PYTHON_BACKEND_URL=http://localhost:8000
PYTHON_WS_URL=ws://localhost:8000/ws
```

### Environment Variables (Python)
```env
MT5_LOGIN=12345678
MT5_PASSWORD=your_password
MT5_SERVER=BrokerName-Demo
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

## API Documentation

### WebSocket Protocol (ws://localhost:8000/ws)

**Subscribe to Ticks**
```json
{
  "action": "subscribe_ticks",
  "data": { "symbols": ["EURUSD", "GBPUSD"] }
}
```

**Place Order**
```json
{
  "action": "place_order",
  "data": {
    "symbol": "EURUSD",
    "direction": "LONG",
    "volume": 0.01,
    "stop_loss": 1.0800,
    "take_profit": 1.0900
  }
}
```

**Close Position**
```json
{
  "action": "close_order",
  "data": { "order_id": "123456" }
}
```

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/account` | GET | Account info |
| `/api/positions` | GET | Open positions |
| `/api/order/open` | POST | Open position |
| `/api/order/close` | POST | Close position |
| `/api/data/{symbol}` | GET | Market data |

## Database Schema

12 tables with Row Level Security:
- `accounts` - Trading account state
- `trades` - Complete trade history
- `signals` - Generated signals
- `equity_curve` - Performance tracking
- `risk_events` - Risk breaches
- `market_regimes` - Market conditions
- `pair_metrics` - Pair statistics
- `strategy_performance` - Strategy results
- `news_events` - Economic calendar
- `execution_log` - Order details
- `system_state` - Configuration
- `sessions` - Trading sessions

## Safety Features

1. **Default Paper Trading** - Starts in simulation mode
2. **Strict Risk Limits** - All trades validated
3. **Circuit Breaker** - Automatic halt on breach
4. **News Filter** - Avoids high-impact news
5. **Mock Broker** - Safe testing environment
6. **Position Limit** - Max 1 open position

## Running in Production

### TypeScript Frontend
```bash
npm run build
# Deploy dist/ folder to your hosting provider
```

### Python Backend
```bash
# Using PM2
pm2 start run.py --name mt5-backend --interpreter python

# Using Docker
docker build -t fx-mt5-backend .
docker run -p 8000:8000 fx-mt5-backend

# Using systemd
sudo systemctl start fx-mt5-backend
```

## Troubleshooting

### MT5 Connection Failed
- Verify MT5 terminal is running
- Check login credentials in `.env`
- Ensure terminal allows algorithmic trading
- Check firewall settings

### WebSocket Not Connecting
- Verify backend is running: `curl http://localhost:8000/health`
- Check CORS settings
- Verify WebSocket URL in frontend config

### Database Errors
- Run migration in Supabase SQL editor
- Check RLS policies are enabled
- Verify Supabase credentials

## Testing

### TypeScript
```bash
npm test
```

### Python
```bash
cd python-backend
pytest tests/
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

## License

MIT

## Author

**YKhan67**
- GitHub: [@YKhan67](https://github.com/YKhan67)

## Disclaimer

This software is for educational purposes only. Trading foreign exchange carries high risk and may not be suitable for all investors. Past performance is not indicative of future results.