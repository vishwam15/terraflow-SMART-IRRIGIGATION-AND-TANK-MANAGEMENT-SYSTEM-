/*
  TERRAFLOW BACKEND
  -----------------
  Serves the built frontend + a REST/WebSocket API for the dashboard.

  Right now sensor readings are SIMULATED (see `generateReading()` below) so the
  dashboard is fully demoable without hardware connected. When your ESP32-S3 is
  ready, replace the simulation block with a real MQTT subscription — the spot
  to do that is clearly marked as "MQTT INTEGRATION POINT" further down.

  Run with:  npm install && npm start
  Default port: 1602 (set PORT env var to change)
*/

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 1602;

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// ---------------------------------------------------------------------------
// In-memory state (swap for a real DB later if you need persistence)
// ---------------------------------------------------------------------------
let state = {
  moisture: 55,
  tankLevel: 80,
  ph: 6.5,
  temperature: 27,
  humidity: 60,
  irrigationPumpOn: false,
  tankFillPumpOn: false,
  manualOverrideIrrigation: false,
  manualOverrideFill: false,
};

const history = [];
const events = [];
const MAX_HISTORY = 30;
const MAX_EVENTS = 50;

function logEvent(message) {
  const event = { message, timestamp: Date.now() };
  events.unshift(event);
  if (events.length > MAX_EVENTS) events.pop();
  broadcast({ type: 'event', data: event });
}

function broadcast(payload) {
  const message = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) client.send(message);
  });
}

// ---------------------------------------------------------------------------
// Decision logic — mirrors the ESP32 firmware's auto-irrigation rules
// ---------------------------------------------------------------------------
const MOISTURE_THRESHOLD = 30;
const TANK_LOW = 20;
const TANK_FULL = 95;

function applyAutoLogic() {
  if (!state.manualOverrideIrrigation) {
    const shouldWater = state.moisture < MOISTURE_THRESHOLD && state.tankLevel > TANK_LOW;
    if (shouldWater !== state.irrigationPumpOn) {
      state.irrigationPumpOn = shouldWater;
      logEvent(shouldWater ? 'Irrigation pump turned ON (soil below threshold)' : 'Irrigation pump turned OFF (moisture adequate)');
    }
  }

  if (!state.manualOverrideFill) {
    if (state.tankLevel < TANK_LOW && !state.tankFillPumpOn) {
      state.tankFillPumpOn = true;
      logEvent('Tank-fill pump turned ON (level below 20%)');
    } else if (state.tankLevel > TANK_FULL && state.tankFillPumpOn) {
      state.tankFillPumpOn = false;
      logEvent('Tank-fill pump turned OFF (tank full)');
    }
  }
}

// ---------------------------------------------------------------------------
// MQTT INTEGRATION POINT
// ---------------------------------------------------------------------------
// When your ESP32-S3 is flashed and publishing to a broker, replace the
// simulation below with something like:
//
//   import mqtt from 'mqtt';
//   const client = mqtt.connect('mqtt://broker.hivemq.com');
//   client.subscribe(['irrigation/moisture', 'irrigation/tank_level', 'irrigation/pump_status']);
//   client.on('message', (topic, payload) => {
//     if (topic === 'irrigation/moisture') state.moisture = Number(payload);
//     if (topic === 'irrigation/tank_level') state.tankLevel = Number(payload);
//     // ...then call pushReading() below
//   });
//
// and to send commands back to the ESP32 instead of just updating local state,
// publish to 'irrigation/cmd' inside the /api/command handler further down.
// ---------------------------------------------------------------------------

function generateReading() {
  // Simple random-walk simulation so the dashboard has believable live data.
  state.moisture = clamp(state.moisture + rand(-3, 3), 5, 95);
  state.tankLevel = clamp(state.tankLevel + (state.tankFillPumpOn ? rand(1, 3) : rand(-1.5, 0.2)), 0, 100);
  state.ph = clamp(state.ph + rand(-0.05, 0.05), 5.5, 7.8);
  state.temperature = clamp(state.temperature + rand(-0.3, 0.3), 18, 38);
  state.humidity = clamp(state.humidity + rand(-1, 1), 30, 90);

  applyAutoLogic();
  pushReading();
}

function pushReading() {
  const reading = { ...state, timestamp: Date.now() };
  history.push(reading);
  if (history.length > MAX_HISTORY) history.shift();
  broadcast({ type: 'reading', data: reading });
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}
function clamp(v, min, max) {
  return Math.round(Math.min(max, Math.max(min, v)) * 10) / 10;
}

// Seed some history so the chart isn't empty on first load
for (let i = 0; i < MAX_HISTORY; i++) generateReading();
logEvent('Terraflow backend started (simulated sensor mode)');

setInterval(generateReading, 4000);

// ---------------------------------------------------------------------------
// REST API
// ---------------------------------------------------------------------------
app.get('/api/history', (req, res) => res.json(history));
app.get('/api/events', (req, res) => res.json(events));
app.get('/api/latest', (req, res) => res.json(history[history.length - 1] ?? state));

app.post('/api/command', (req, res) => {
  const { command } = req.body;
  handleCommand(command);
  res.json({ ok: true, state });
});

// ---------------------------------------------------------------------------
// AI INTEGRATION POINT (future)
// ---------------------------------------------------------------------------
// A natural next endpoint once you're ready to add AI-driven recommendations:
//
//   app.get('/api/recommendation', async (req, res) => {
//     const recentHistory = history.slice(-20);
//     // send `recentHistory` to your model of choice and return its suggestion
//     res.json({ suggestion: '...' });
//   });
//
// Keeping history shaped consistently (see the `reading` object above) means
// no data-wrangling is needed later — just point a model at this array.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// WebSocket — live push + manual command channel
// ---------------------------------------------------------------------------
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'reading', data: history[history.length - 1] }));

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'command') handleCommand(msg.command);
    } catch {
      /* ignore malformed frame */
    }
  });
});

function handleCommand(command) {
  switch (command) {
    case 'PUMP_ON':
      state.manualOverrideIrrigation = true;
      state.irrigationPumpOn = true;
      logEvent('Manual override: irrigation pump ON');
      break;
    case 'PUMP_OFF':
      state.manualOverrideIrrigation = true;
      state.irrigationPumpOn = false;
      logEvent('Manual override: irrigation pump OFF');
      break;
    case 'FILL_ON':
      state.manualOverrideFill = true;
      state.tankFillPumpOn = true;
      logEvent('Manual override: tank-fill pump ON');
      break;
    case 'FILL_OFF':
      state.manualOverrideFill = true;
      state.tankFillPumpOn = false;
      logEvent('Manual override: tank-fill pump OFF');
      break;
    case 'AUTO_MODE':
      state.manualOverrideIrrigation = false;
      state.manualOverrideFill = false;
      logEvent('Switched back to automatic mode');
      break;
    default:
      return;
  }
  pushReading();
}

// Fallback to index.html for client-side routing (dashboard/landing pages)
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

server.listen(PORT, () => {
  console.log(`Terraflow running at http://localhost:${PORT}`);
});
