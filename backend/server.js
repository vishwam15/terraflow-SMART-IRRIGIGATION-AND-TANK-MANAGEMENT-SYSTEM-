/*
  TERRAFLOW BACKEND
  -----------------
  Architecture: Sensors (ESP32-S3) -> Node-RED -> Backend -> Frontend

  This backend does NOT talk to MQTT and does NOT decide pump state.
  Node-RED owns all of that. This server only:
    1. Receives processed readings/events from Node-RED over HTTP
       (POST /api/ingest/reading, POST /api/ingest/event)
    2. Pushes them to the frontend over WebSocket + REST
    3. Relays manual override commands FROM the frontend TO Node-RED
       (Node-RED is the one that actually publishes the MQTT command
       to the ESP32 and applies/clears the override flag)

  Until Node-RED is wired up, SIMULATION MODE fills in fake readings so the
  dashboard is demoable on its own. The moment a real reading arrives from
  Node-RED, simulation switches off automatically.

  Run with:  npm install && npm start
  Default port: 1602 (set PORT env var to change)
  Node-RED URL: set NODE_RED_URL env var (default http://localhost:1880)
*/

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 1602;
const NODE_RED_URL = process.env.NODE_RED_URL || 'http://localhost:1880';

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
};

const history = [];
const events = [];
const MAX_HISTORY = 30;
const MAX_EVENTS = 50;

let receivingRealData = false; // flips true the first time Node-RED posts a reading
let simulationTimer = null;

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

function pushReading(reading) {
  const stamped = { ...reading, timestamp: Date.now() };
  state = { ...state, ...reading };
  history.push(stamped);
  if (history.length > MAX_HISTORY) history.shift();
  broadcast({ type: 'reading', data: stamped });
}

// ---------------------------------------------------------------------------
// SIMULATION MODE — demo data only, disabled the instant Node-RED sends real data
// ---------------------------------------------------------------------------
function rand(min, max) {
  return Math.random() * (max - min) + min;
}
function clamp(v, min, max) {
  return Math.round(Math.min(max, Math.max(min, v)) * 10) / 10;
}

function simulateReading() {
  if (receivingRealData) return; // safety check in case timer wasn't cleared in time

  const next = {
    moisture: clamp(state.moisture + rand(-3, 3), 5, 95),
    tankLevel: clamp(state.tankLevel + (state.tankFillPumpOn ? rand(1, 3) : rand(-1.5, 0.2)), 0, 100),
    ph: clamp(state.ph + rand(-0.05, 0.05), 5.5, 7.8),
    temperature: clamp(state.temperature + rand(-0.3, 0.3), 18, 38),
    humidity: clamp(state.humidity + rand(-1, 1), 30, 90),
    irrigationPumpOn: state.moisture < 30,
    tankFillPumpOn: state.tankLevel < 20,
  };
  pushReading(next);
}

for (let i = 0; i < MAX_HISTORY; i++) simulateReading();
logEvent('Terraflow backend started (simulation mode — waiting for Node-RED)');
simulationTimer = setInterval(simulateReading, 4000);

// ---------------------------------------------------------------------------
// INGESTION FROM NODE-RED
// ---------------------------------------------------------------------------
// Node-RED calls these after it has read the ESP32's MQTT topics and applied
// the irrigation/tank-fill decision logic. Point Node-RED's "http request"
// nodes at:
//   POST http://<this-server>:1602/api/ingest/reading
//   POST http://<this-server>:1602/api/ingest/event
// ---------------------------------------------------------------------------
app.post('/api/ingest/reading', (req, res) => {
  if (!receivingRealData) {
    receivingRealData = true;
    clearInterval(simulationTimer);
    logEvent('Live data connected from Node-RED — simulation stopped');
  }

  const { moisture, tankLevel, ph, temperature, humidity, irrigationPumpOn, tankFillPumpOn } = req.body;
  pushReading({ moisture, tankLevel, ph, temperature, humidity, irrigationPumpOn, tankFillPumpOn });
  res.json({ ok: true });
});

app.post('/api/ingest/event', (req, res) => {
  const { message } = req.body;
  if (message) logEvent(message);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// REST API for the frontend
// ---------------------------------------------------------------------------
app.get('/api/history', (req, res) => res.json(history));
app.get('/api/events', (req, res) => res.json(events));
app.get('/api/latest', (req, res) => res.json(history[history.length - 1] ?? state));

// Manual override from the frontend — relayed to Node-RED, which applies it
// and publishes the actual MQTT command to the ESP32. This backend does not
// decide anything here; it just forwards the request.
app.post('/api/command', async (req, res) => {
  const { command } = req.body;
  try {
    await forwardCommandToNodeRed(command);
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to reach Node-RED:', err.message);
    res.status(502).json({ ok: false, error: 'Node-RED unreachable' });
  }
});

async function forwardCommandToNodeRed(command) {
  const response = await fetch(`${NODE_RED_URL}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command }),
  });
  if (!response.ok) throw new Error(`Node-RED responded with ${response.status}`);
}

// ---------------------------------------------------------------------------
// AI INTEGRATION POINT (future)
// ---------------------------------------------------------------------------
// app.get('/api/recommendation', async (req, res) => {
//   const recentHistory = history.slice(-20);
//   // send `recentHistory` to your model of choice and return its suggestion
//   res.json({ suggestion: '...' });
// });
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// WebSocket — live push to frontend + manual command channel
// ---------------------------------------------------------------------------
wss.on('connection', (ws) => {
  if (history.length) ws.send(JSON.stringify({ type: 'reading', data: history[history.length - 1] }));

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'command') {
        await forwardCommandToNodeRed(msg.command).catch((err) => {
          console.error('Failed to reach Node-RED:', err.message);
          logEvent(`Command "${msg.command}" failed — Node-RED unreachable`);
        });
      }
    } catch {
      /* ignore malformed frame */
    }
  });
});

// Fallback to index.html for client-side routing (dashboard/landing pages)
app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

server.listen(PORT, () => {
  console.log(`Terraflow backend running at http://localhost:${PORT}`);
  console.log(`Expecting Node-RED at ${NODE_RED_URL} (set NODE_RED_URL to change)`);
});
