/*
  SMART IRRIGATION SYSTEM - ESP32-S3
  ------------------------------------
  Architecture: Sensors (this firmware) -> Node-RED -> Backend -> Frontend

  This firmware is intentionally "dumb": it only publishes raw sensor
  readings and executes whatever pump command it receives. It does NOT
  decide when to turn pumps on/off anymore — that decision now lives in
  Node-RED, which reads these same MQTT topics and publishes back to
  irrigation/cmd.

  Components:
   - Capacitive Soil Moisture Sensor  -> GPIO 1  (Analog)
   - pH Sensor                        -> GPIO 2  (Analog)
   - Ultrasonic Sensor (HC-SR04)      -> Trig: GPIO 4, Echo: GPIO 5 (via voltage divider)
   - DHT11                            -> GPIO 8
   - Relay 1 (Irrigation Pump)        -> GPIO 6
   - Relay 2 (Tank Fill Pump)         -> GPIO 7

  MQTT topics published (one raw value per topic, every few seconds):
   - irrigation/moisture
   - irrigation/tank_level
   - irrigation/ph
   - irrigation/temperature
   - irrigation/humidity

  MQTT topic subscribed:
   - irrigation/cmd  -> "PUMP_ON" / "PUMP_OFF" / "FILL_ON" / "FILL_OFF" / "AUTO_MODE"
     (AUTO_MODE has no direct effect here since this firmware never runs its
      own auto logic anymore — Node-RED handles clearing overrides on its side.
      This firmware just turns relays on/off exactly as told.)

  Before uploading:
   1. Install "PubSubClient" library (and "DHT sensor library" by Adafruit)
      via Arduino IDE Library Manager
   2. Select Board: "ESP32S3 Dev Module" under Tools > Board
   3. Fill in your WiFi and MQTT broker details below
*/

#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

// ---------------- USER CONFIG ----------------
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* MQTT_BROKER   = "broker.hivemq.com";   // must match Node-RED's broker config
const int   MQTT_PORT     = 1883;
const char* MQTT_CLIENT_ID = "esp32s3_irrigation_01";

// MQTT topics — must match the topics Node-RED subscribes to / publishes on
const char* TOPIC_MOISTURE    = "irrigation/moisture";
const char* TOPIC_TANK_LEVEL  = "irrigation/tank_level";
const char* TOPIC_PH          = "irrigation/ph";
const char* TOPIC_TEMPERATURE = "irrigation/temperature";
const char* TOPIC_HUMIDITY    = "irrigation/humidity";
const char* TOPIC_COMMAND     = "irrigation/cmd";   // subscribed — Node-RED publishes here

// ---------------- PIN CONFIG ----------------
const int PIN_MOISTURE   = 1;
const int PIN_PH         = 2;
const int PIN_TRIG       = 4;
const int PIN_ECHO       = 5;
const int PIN_RELAY_PUMP = 6;
const int PIN_RELAY_FILL = 7;
const int PIN_DHT        = 8;

#define DHTTYPE DHT11
DHT dht(PIN_DHT, DHTTYPE);

// ---------------- CALIBRATION VALUES ----------------
int MOISTURE_DRY_RAW = 3000;
int MOISTURE_WET_RAW = 1200;

float TANK_HEIGHT_CM    = 30.0;
float TANK_FULL_DIST_CM = 4.0;

// pH probe calibration (adjust after testing with pH 4/7/10 buffer solutions)
float PH_RAW_AT_PH7 = 2048.0;   // ADC reading in neutral buffer
float PH_SLOPE      = -0.0018;  // volts (or ADC units) per pH unit — calibrate for your probe

// ---------------- GLOBAL OBJECTS ----------------
WiFiClient espClient;
PubSubClient mqttClient(espClient);

bool irrigationPumpOn = false;
bool tankFillPumpOn   = false;

unsigned long lastPublish = 0;
const unsigned long PUBLISH_INTERVAL = 5000;

// =====================================================
void setup() {
  Serial.begin(115200);

  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_RELAY_PUMP, OUTPUT);
  pinMode(PIN_RELAY_FILL, OUTPUT);

  digitalWrite(PIN_RELAY_PUMP, HIGH); // active LOW relay -> HIGH = off
  digitalWrite(PIN_RELAY_FILL, HIGH);

  dht.begin();

  connectWiFi();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
}

// =====================================================
void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (!mqttClient.connected()) connectMQTT();
  mqttClient.loop();

  if (millis() - lastPublish > PUBLISH_INTERVAL) {
    publishReadings();
    lastPublish = millis();
  }

  delay(200);
}

// =====================================================
void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected. IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nWiFi connection failed, will retry in loop.");
  }
}

void connectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT...");
    if (mqttClient.connect(MQTT_CLIENT_ID)) {
      Serial.println("connected!");
      mqttClient.subscribe(TOPIC_COMMAND);
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" retrying in 3 seconds");
      delay(3000);
    }
  }
}

// Commands now come from Node-RED, not this firmware's own logic.
// This just executes whatever it's told — it never decides on its own.
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) message += (char)payload[i];
  Serial.println("Command received: " + message);

  if (message == "PUMP_ON") {
    setIrrigationPump(true);
  } else if (message == "PUMP_OFF") {
    setIrrigationPump(false);
  } else if (message == "FILL_ON") {
    setTankFillPump(true);
  } else if (message == "FILL_OFF") {
    setTankFillPump(false);
  }
  // AUTO_MODE: nothing to do here — Node-RED clears its own override flags
  // and will publish the next PUMP_ON/OFF or FILL_ON/OFF once it recalculates.
}

// =====================================================
// Read raw sensors and publish each on its own topic — no decisions made here.
void publishReadings() {
  int moisture = readMoisturePercent();
  float tankLevel = readTankPercent();
  float ph = readPh();
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  char buffer[10];

  dtostrf(moisture, 1, 0, buffer);
  mqttClient.publish(TOPIC_MOISTURE, buffer);

  dtostrf(tankLevel, 1, 1, buffer);
  mqttClient.publish(TOPIC_TANK_LEVEL, buffer);

  dtostrf(ph, 1, 2, buffer);
  mqttClient.publish(TOPIC_PH, buffer);

  if (!isnan(temperature)) {
    dtostrf(temperature, 1, 1, buffer);
    mqttClient.publish(TOPIC_TEMPERATURE, buffer);
  }
  if (!isnan(humidity)) {
    dtostrf(humidity, 1, 1, buffer);
    mqttClient.publish(TOPIC_HUMIDITY, buffer);
  }

  Serial.println("Moisture: " + String(moisture) + "% | Tank: " + String(tankLevel) +
                  "% | pH: " + String(ph) + " | Temp: " + String(temperature) +
                  "C | Humidity: " + String(humidity) + "%");
}

int readMoisturePercent() {
  int raw = analogRead(PIN_MOISTURE);
  int percent = map(raw, MOISTURE_DRY_RAW, MOISTURE_WET_RAW, 0, 100);
  return constrain(percent, 0, 100);
}

float readTankPercent() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  long duration = pulseIn(PIN_ECHO, HIGH, 30000);
  if (duration == 0) {
    Serial.println("Ultrasonic reading timeout");
    return -1;
  }

  float distanceCm = duration * 0.0343 / 2.0;
  float waterHeight = TANK_HEIGHT_CM - distanceCm;
  float maxHeight = TANK_HEIGHT_CM - TANK_FULL_DIST_CM;
  float percent = (waterHeight / maxHeight) * 100.0;
  return constrain(percent, 0, 100);
}

float readPh() {
  int raw = analogRead(PIN_PH);
  // Simple linear model around the pH-7 calibration point — recalibrate
  // PH_RAW_AT_PH7 and PH_SLOPE using pH 4/7/10 buffer solutions for accuracy.
  float ph = 7.0 + (raw - PH_RAW_AT_PH7) * PH_SLOPE;
  return constrain(ph, 0, 14);
}

// =====================================================
void setIrrigationPump(bool state) {
  irrigationPumpOn = state;
  digitalWrite(PIN_RELAY_PUMP, state ? LOW : HIGH);
}

void setTankFillPump(bool state) {
  tankFillPumpOn = state;
  digitalWrite(PIN_RELAY_FILL, state ? LOW : HIGH);
}
