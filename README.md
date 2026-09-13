# Terraflow — Smart Irrigation System

Full pipeline: **Sensors (ESP32-S3) → Node-RED → Backend → Frontend**

Node-RED owns all the decision logic (when to water, when to refill the
tank). The backend is a thin relay between Node-RED and the dashboard. The
ESP32 firmware only publishes raw readings and executes whatever pump
command it's told — it doesn't decide anything on its own.

## Architecture

```
 ESP32-S3                Node-RED                  Backend              Frontend
 --------                --------                  -------              --------
 Moisture, tank,    ---> MQTT in: reads all    ---> POST /api/ingest/*  --> WebSocket
 pH, temp/humidity       raw sensor topics          (stores + relays        push to
 sensors publish          |                          to all connected       dashboard
 raw values over          | applies threshold        frontend clients)
 MQTT                     | logic (moisture <30%,
                          | tank <20%/>95%)
 MQTT cmd topic     <---  | publishes pump      
 (pump relays)            | commands back to
                          | ESP32
                          |
                          | exposes POST /command <--- POST /api/command <-- manual
                          | (manual override from      (forwarded)          pump
                          | the dashboard)                                  buttons
```

## What's in this folder

- `esp32-firmware/` — Arduino sketch for the ESP32-S3. Publishes sensor
  readings, executes pump commands. No onboard auto-logic.
- `node-red/flows.json` — the decision logic. Import this into Node-RED.
- `backend/` — Express + WebSocket server. Receives Node-RED's output,
  serves the frontend, relays manual override commands to Node-RED.
- `frontend/` — React dashboard + landing page (unchanged from before —
  it only talks to the backend, so it doesn't know or care that Node-RED
  exists behind it).

## Setup order

### 1. Backend (start this first)

```bash
cd backend
npm install
npm start
```

Runs on **http://localhost:1602**. Until Node-RED is sending real data,
it fills the dashboard with simulated readings so you can see it working
immediately — this switches off automatically the moment Node-RED posts
a real reading.

### 2. Node-RED

If you don't have it yet:
```bash
npm install -g node-red
node-red
```
This starts the Node-RED editor at **http://localhost:1880**.

Import the flow:
1. Open http://localhost:1880 in your browser
2. Menu (top right) → Import → select `node-red/flows.json`
3. Click **Deploy**

Check two things in the imported flow before relying on it:
- **The "Terraflow Broker" config node** — double-click any MQTT node,
  edit the broker, and point it at whatever MQTT broker your ESP32
  actually connects to (defaults to `broker.hivemq.com` to match the
  firmware's default — switch both to a local Mosquitto broker for
  more reliable testing)
- **The two "http request" nodes** ("POST reading to backend", "POST
  event to backend") — these default to `http://localhost:1602/...`.
  Only change this if your backend runs somewhere other than the same
  machine.

### 3. ESP32-S3 firmware

Open `esp32-firmware/smart_irrigation_esp32s3.ino` in Arduino IDE:
1. Install libraries: **PubSubClient**, **DHT sensor library** (by Adafruit)
2. Select board: **ESP32S3 Dev Module**
3. Fill in `WIFI_SSID`, `WIFI_PASSWORD`, and `MOISTURE_DRY_RAW` /
   `MOISTURE_WET_RAW` / `TANK_HEIGHT_CM` / `TANK_FULL_DIST_CM` /
   `PH_RAW_AT_PH7` / `PH_SLOPE` calibration values for your hardware
4. Make sure `MQTT_BROKER` matches whatever broker you set in Node-RED
5. Upload

### 4. Frontend

```bash
cd frontend
npm install
npm run build
```

The backend serves the built files automatically — open
**http://localhost:1602** once the backend is running.

## Testing without hardware connected

You don't need the ESP32 flashed to see the whole pipeline work:

- Backend alone → dashboard shows simulated data immediately
- Add Node-RED → once deployed, you can manually inject test values into
  the `irrigation/moisture` etc. topics using an "inject" node in the
  Node-RED editor, and watch the merge/decide logic run and push to the
  backend exactly like a real sensor would
- Manual override buttons on the dashboard → these work end-to-end even
  without the ESP32 connected, since the response comes back the moment
  Node-RED replies (you just won't see a real pump move)

## AI integration (future)

The backend has a marked `AI INTEGRATION POINT` comment in `server.js` —
history is stored in a consistent shape (`{moisture, tankLevel, ph,
temperature, humidity, irrigationPumpOn, tankFillPumpOn, timestamp}`)
specifically so a future recommendation model can read it without any
reshaping.

## Project structure
```
terraflow/
├── esp32-firmware/
│   └── smart_irrigation_esp32s3.ino
├── node-red/
│   └── flows.json
├── backend/
│   └── server.js
├── frontend/
│   └── src/...
└── README.md
```
