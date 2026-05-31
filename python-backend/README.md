# FX Prop AI - Python MT5 Backend

MetaTrader 5 backend service for the FX Prop AI Trading System.

## Overview

This Python backend connects to MetaTrader 5 and provides:
- WebSocket endpoint for real-time communication
- REST API for order management and market data
- Real-time tick streaming
- Position and account monitoring

## Requirements

- Python 3.8+
- MetaTrader 5 terminal installed
- Valid MT5 trading account

## Installation

### 1. Install Dependencies

```bash
cd python-backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment

Edit `.env` file with your MT5 credentials:

```env
MT5_LOGIN=your_mt5_login
MT5_PASSWORD=your_password
MT5_SERVER=your_broker_server
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

### 3. Run the Server

```bash
python run.py
```

Or with uvicorn:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## WebSocket Protocol

Connect to: `ws://localhost:8000/ws`

### Message Types

#### Subscribe to Ticks
```json
{
  "action": "subscribe_ticks",
  "data": {"symbols": ["EURUSD", "GBPUSD"]}
}
```

#### Place Order
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

#### Close Position
```json
{
  "action": "close_order",
  "data": {"order_id": "123456"}
}
```

## REST API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ping` | GET | Health check |
| `/api/account` | GET | Account info |
| `/api/positions` | GET | Open positions |
| `/api/order/open` | POST | Open position |
| `/api/order/close` | POST | Close position |
| `/api/symbols` | GET | Available symbols |
| `/api/ticks/{symbol}` | GET | Current tick |
| `/api/ohlcv/{symbol}` | GET | OHLC data |

## Architecture

```
python-backend/
├── app/
│   ├── api/routes/        # REST & WebSocket endpoints
│   ├── core/              # Config and logging
│   ├── models/            # Pydantic models
│   ├── services/          # MT5 connector, streamer
│   └── main.py             # FastAPI app
├── logs/                   # Log files
├── tests/                  # Test suite
├── .env                    # Configuration
├── requirements.txt        # Dependencies
└── run.py                  # Entry point
```

## Safety Features

- MT5 connection validation
- Symbol verification before trading
- Slippage control
- Comprehensive error handling
- Graceful shutdown

## License

MIT