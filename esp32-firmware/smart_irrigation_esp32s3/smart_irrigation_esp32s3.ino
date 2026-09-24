/*
  TERRAFLOW SMART IRRIGATION - ESP32-S3
  =====================================

  Pump 1 = TANK FILLING  -> GPIO 6
  Pump 2 = IRRIGATION    -> GPIO 7

  Soil moisture sensor  -> GPIO 1
  Ultrasonic TRIG       -> GPIO 4
  Ultrasonic ECHO       -> GPIO 5

  MQTT:
    Broker: broker.hivemq.com
    Port: 1883

  Commands from WebApp/Backend through MQTT:
    FILL_ON       = MANUAL Pump 1 filling ON
    FILL_OFF      = Pump 1 OFF
    PUMP_ON       = MANUAL Pump 2 irrigation ON
    PUMP_OFF      = Pump 2 OFF
    AUTO_MODE_ON  = Automatic irrigation ON/OFF by moisture
    AUTO_MODE_OFF = Automatic irrigation disabled

  IMPORTANT:
    - NO ECHO affects ONLY automatic Pump 1 filling.
    - Manual FILL_ON can start Pump 1 even if ultrasonic has NO ECHO.
    - Pump 2 does NOT depend on ultrasonic Echo.
    - Pump 2 can be started manually or automatically.

  Rules:
    1. Pump 1 is the tank-filling pump.
    2. Pump 2 is the irrigation pump.
    3. Only ONE pump can run at a time.
    4. Pump 2 can start only when soil moisture < 90%.
    5. If soil moisture reaches 90%, Pump 2 stops automatically.
    6. NO ECHO affects ONLY AUTOMATIC Pump 1 filling.
    7. Manual FILL_ON can start Pump 1 even with NO ECHO.
    8. Pump 2 does NOT depend on ultrasonic Echo.
    9. Pump 2 can be started manually or automatically.
   10. On startup/MQTT reconnect, both pumps are OFF.
*/

#include <WiFi.h>
#include <PubSubClient.h>

// ================= WIFI =================
const char* WIFI_SSID = "V";
const char* WIFI_PASSWORD = "12345678";

// ================= MQTT =================
const char* MQTT_BROKER = "broker.hivemq.com";
const int MQTT_PORT = 1883;
const char* MQTT_CLIENT_ID = "Terraflow_ESP32S3";

// MQTT topics
const char* TOPIC_COMMAND = "irrigation/cmd";
const char* TOPIC_MOISTURE = "irrigation/moisture";
const char* TOPIC_TANK_LEVEL = "irrigation/tank_level";
const char* TOPIC_PUMP1_STATUS = "irrigation/pump1_status";
const char* TOPIC_PUMP2_STATUS = "irrigation/pump2_status";

// ================= PINS =================
// Soil moisture
#define SOIL_PIN 1

// Ultrasonic
#define TRIG_PIN 4
#define ECHO_PIN 5

// Pump 1 = TANK FILLING
#define PUMP1_PIN 6

// Pump 2 = IRRIGATION
#define PUMP2_PIN 7

// Relay is active LOW
#define RELAY_ON LOW
#define RELAY_OFF HIGH

// ================= MOISTURE =================
#define SOIL_DRY 3000
#define SOIL_WET 1200

// Irrigation allowed only below 90%
#define IRRIGATION_THRESHOLD 90

// ================= TANK =================
#define TANK_HEIGHT_CM 8.0

// ================= OBJECTS =================
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// Pump states
bool pump1Running = false;
bool pump2Running = false;

// Automatic irrigation mode.
// When enabled:
//   moisture < 90%  -> Pump 2 ON
//   moisture >= 90% -> Pump 2 OFF
bool autoIrrigation = false;

unsigned long lastSensorPublish = 0;
const unsigned long SENSOR_INTERVAL = 3000;

// ============================================================
// SETUP
// ============================================================
void setup()
{
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("====================================");
  Serial.println("TERRAFLOW SMART IRRIGATION");
  Serial.println("ESP32-S3");
  Serial.println("====================================");

  pinMode(SOIL_PIN, INPUT);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  pinMode(PUMP1_PIN, OUTPUT);
  pinMode(PUMP2_PIN, OUTPUT);

  // SAFETY: both pumps OFF at startup
  allPumpsOFF();

  digitalWrite(TRIG_PIN, LOW);

  connectWiFi();

  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);

  Serial.println("System ready.");
}

// ============================================================
// LOOP
// ============================================================
void loop()
{
  if (WiFi.status() != WL_CONNECTED)
  {
    connectWiFi();
  }

  if (!mqttClient.connected())
  {
    connectMQTT();
  }

  mqttClient.loop();

  // Automatic irrigation is independent of the ultrasonic sensor.
  // Ultrasonic NO ECHO affects only automatic Pump 1 filling.
  if (autoIrrigation)
  {
    checkAutomaticIrrigation();
  }

  if (millis() - lastSensorPublish >= SENSOR_INTERVAL)
  {
    publishSensorData();
    lastSensorPublish = millis();
  }

  delay(50);
}

// ============================================================
// WIFI
// ============================================================
void connectWiFi()
{
  Serial.print("Connecting WiFi");

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;

  while (WiFi.status() != WL_CONNECTED && attempts < 20)
  {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED)
  {
    Serial.println();
    Serial.println("WiFi connected.");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  }
  else
  {
    Serial.println();
    Serial.println("WiFi connection failed.");
  }
}

// ============================================================
// MQTT
// ============================================================
void connectMQTT()
{
  while (!mqttClient.connected())
  {
    Serial.print("Connecting MQTT...");

    if (mqttClient.connect(MQTT_CLIENT_ID))
    {
      Serial.println("connected!");

      mqttClient.subscribe(TOPIC_COMMAND);

      Serial.print("Subscribed: ");
      Serial.println(TOPIC_COMMAND);

      // SAFETY: both pumps OFF after reconnect.
      // Automatic irrigation is also disabled until WebApp enables it again.
      autoIrrigation = false;
      allPumpsOFF();
    }
    else
    {
      Serial.print("MQTT failed, state=");
      Serial.println(mqttClient.state());
      delay(3000);
    }
  }
}

// ============================================================
// MQTT COMMAND CALLBACK
// ============================================================
void mqttCallback(char* topic, byte* payload, unsigned int length)
{
  String command = "";

  for (unsigned int i = 0; i < length; i++)
  {
    command += (char)payload[i];
  }

  command.trim();

  Serial.print("MQTT command received: ");
  Serial.println(command);

  // ----------------------------------------------------------
  // PUMP 1 - MANUAL TANK FILLING
  // ----------------------------------------------------------
  if (command == "FILL_ON")
  {
    // MANUAL command.
    // NO ECHO does NOT block manual filling.
    startFillingPumpManual();
  }

  else if (command == "FILL_OFF")
  {
    stopFillingPump();
  }

  // ----------------------------------------------------------
  // PUMP 2 - MANUAL IRRIGATION
  // ----------------------------------------------------------
  else if (command == "PUMP_ON")
  {
    // MANUAL irrigation.
    // Ultrasonic Echo is NOT checked here.
    startIrrigationPumpManual();
  }

  else if (command == "PUMP_OFF")
  {
    stopIrrigationPump();
  }

  // ----------------------------------------------------------
  // AUTOMATIC IRRIGATION
  // ----------------------------------------------------------
  else if (command == "AUTO_MODE_ON")
  {
    autoIrrigation = true;

    Serial.println("AUTOMATIC IRRIGATION ENABLED.");

    // Immediately evaluate moisture.
    checkAutomaticIrrigation();
  }

  else if (command == "AUTO_MODE_OFF")
  {
    autoIrrigation = false;

    Serial.println("AUTOMATIC IRRIGATION DISABLED.");

    // Stop Pump 2 when automatic mode is disabled.
    stopIrrigationPump();
  }

  else
  {
    Serial.println("Unknown MQTT command.");
  }
}

// ============================================================
// SOIL MOISTURE
// ============================================================
// Converts the raw analog reading to percentage.
// Calibration:
//   SOIL_DRY = 3000 -> 0%
//   SOIL_WET = 1200 -> 100%
//
// Higher ADC value = drier soil.
// Lower ADC value = wetter soil.
int readMoisture()
{
  int rawValue = analogRead(SOIL_PIN);

  int moisture = map(
    rawValue,
    SOIL_DRY,
    SOIL_WET,
    0,
    100
  );

  moisture = constrain(moisture, 0, 100);

  Serial.print("Soil raw ADC: ");
  Serial.print(rawValue);
  Serial.print(" | Moisture: ");
  Serial.print(moisture);
  Serial.println("%");

  return moisture;
}

// ============================================================
// PUMP 1 - TANK FILLING
// ============================================================

// MANUAL Pump 1 start.
// NO ECHO does NOT block this command.
void startFillingPumpManual()
{
  // HARD MUTUAL EXCLUSION:
  // Pump 2 must be OFF before Pump 1 starts.
  digitalWrite(PUMP2_PIN, RELAY_OFF);
  pump2Running = false;

  digitalWrite(PUMP1_PIN, RELAY_ON);
  pump1Running = true;

  Serial.println("PUMP 1 ON - MANUAL TANK FILLING.");
  Serial.println("Ultrasonic Echo is NOT required for manual filling.");
  Serial.println("Pump 2 forced OFF.");

  publishPumpStatus();
}


// AUTOMATIC Pump 1 start.
// This is the ONLY Pump 1 path that requires a valid Echo.
void startFillingPumpAutomatic()
{
  float tankLevel = readTankLevel();

  // NO ECHO = automatic filling blocked.
  if (tankLevel < 0)
  {
    digitalWrite(PUMP1_PIN, RELAY_OFF);
    pump1Running = false;

    Serial.println("AUTO FILL BLOCKED: NO ECHO.");
    Serial.println("Pump 1 remains OFF.");

    publishPumpStatus();
    return;
  }

  // HARD MUTUAL EXCLUSION.
  digitalWrite(PUMP2_PIN, RELAY_OFF);
  pump2Running = false;

  digitalWrite(PUMP1_PIN, RELAY_ON);
  pump1Running = true;

  Serial.print("PUMP 1 ON - AUTOMATIC TANK FILLING. Level: ");
  Serial.print(tankLevel);
  Serial.println(" cm");

  Serial.println("Pump 2 forced OFF.");

  publishPumpStatus();
}

// ============================================================
// STOP PUMP 1
// ============================================================
void stopFillingPump()
{
  digitalWrite(PUMP1_PIN, RELAY_OFF);
  pump1Running = false;

  Serial.println("PUMP 1 OFF - TANK FILLING STOPPED.");

  publishPumpStatus();
}

// ============================================================
// PUMP 2 - IRRIGATION
// ============================================================

// MANUAL Pump 2 start.
// This does NOT depend on ultrasonic Echo.
void startIrrigationPumpManual()
{
  int moisture = readMoisture();

  Serial.print("Manual irrigation request. Moisture: ");
  Serial.print(moisture);
  Serial.println("%");

  // Irrigation is allowed only below 90%.
  if (moisture >= IRRIGATION_THRESHOLD)
  {
    digitalWrite(PUMP2_PIN, RELAY_OFF);
    pump2Running = false;

    Serial.println("MANUAL IRRIGATION BLOCKED.");
    Serial.println("Soil moisture is 90% or higher.");

    publishPumpStatus();
    return;
  }

  // HARD MUTUAL EXCLUSION:
  // Pump 1 must be OFF before Pump 2 starts.
  digitalWrite(PUMP1_PIN, RELAY_OFF);
  pump1Running = false;

  digitalWrite(PUMP2_PIN, RELAY_ON);
  pump2Running = true;

  Serial.print("PUMP 2 ON - MANUAL IRRIGATION. Moisture: ");
  Serial.print(moisture);
  Serial.println("%");

  Serial.println("Ultrasonic Echo is irrelevant to Pump 2.");
  Serial.println("Pump 1 forced OFF.");

  publishPumpStatus();
}


// AUTOMATIC Pump 2 control.
// Ultrasonic Echo is NOT used here.
void checkAutomaticIrrigation()
{
  int moisture = readMoisture();

  if (moisture < IRRIGATION_THRESHOLD)
  {
    // If Pump 1 is running, do not allow Pump 2 to start.
    // Mutual exclusion is preserved.
    if (!pump2Running)
    {
      // Turn Pump 1 OFF first.
      digitalWrite(PUMP1_PIN, RELAY_OFF);
      pump1Running = false;

      digitalWrite(PUMP2_PIN, RELAY_ON);
      pump2Running = true;

      Serial.print("PUMP 2 ON - AUTOMATIC IRRIGATION. Moisture: ");
      Serial.print(moisture);
      Serial.println("%");

      publishPumpStatus();
    }
  }
  else
  {
    if (pump2Running)
    {
      Serial.print("Moisture reached ");
      Serial.print(moisture);
      Serial.println("% - automatic irrigation OFF.");

      stopIrrigationPump();
    }
  }
}


// ============================================================
// STOP PUMP 2
// ============================================================
void stopIrrigationPump()
{
  digitalWrite(PUMP2_PIN, RELAY_OFF);
  pump2Running = false;

  Serial.println("PUMP 2 OFF - IRRIGATION STOPPED.");

  publishPumpStatus();
}

// ============================================================
// ULTRASONIC - TANK WATER HEIGHT
// ============================================================
float readTankLevel()
{
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);

  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(
    ECHO_PIN,
    HIGH,
    30000
  );

  // NO ECHO
  if (duration == 0)
  {
    Serial.println("Ultrasonic: NO ECHO.");
    return -1;
  }

  float distance = duration * 0.0343 / 2.0;

  // Tank water height
  float waterLevel = TANK_HEIGHT_CM - distance;

  if (waterLevel < 0 || waterLevel > TANK_HEIGHT_CM)
  {
    Serial.println("Ultrasonic: INVALID LEVEL.");
    return -1;
  }

  return waterLevel;
}

// ============================================================
// PUBLISH SENSOR DATA
// ============================================================
void publishSensorData()
{
  // ---------- Moisture ----------
  int moisture = readMoisture();

  char moistureBuffer[10];

  snprintf(
    moistureBuffer,
    sizeof(moistureBuffer),
    "%d",
    moisture
  );

  mqttClient.publish(
    TOPIC_MOISTURE,
    moistureBuffer
  );

  // ---------- Tank ----------
  float tankLevel = readTankLevel();

  if (tankLevel < 0)
  {
    mqttClient.publish(
      TOPIC_TANK_LEVEL,
      "-1"
    );

    Serial.println("Tank level: NO ECHO.");
  }
  else
  {
    char tankBuffer[10];

    snprintf(
      tankBuffer,
      sizeof(tankBuffer),
      "%.1f",
      tankLevel
    );

    mqttClient.publish(
      TOPIC_TANK_LEVEL,
      tankBuffer
    );

    Serial.print("Tank level: ");
    Serial.print(tankLevel);
    Serial.println(" cm");
  }

  Serial.print("Soil moisture: ");
  Serial.print(moisture);
  Serial.println("%");
}

// ============================================================
// PUBLISH PUMP STATUS
// ============================================================
void publishPumpStatus()
{
  if (!mqttClient.connected())
    return;

  mqttClient.publish(
    TOPIC_PUMP1_STATUS,
    pump1Running ? "ON" : "OFF"
  );

  mqttClient.publish(
    TOPIC_PUMP2_STATUS,
    pump2Running ? "ON" : "OFF"
  );
}

// ============================================================
// ALL PUMPS OFF
// ============================================================
void allPumpsOFF()
{
  digitalWrite(PUMP1_PIN, RELAY_OFF);
  digitalWrite(PUMP2_PIN, RELAY_OFF);

  pump1Running = false;
  pump2Running = false;

  Serial.println("SAFETY: BOTH PUMPS OFF.");

  publishPumpStatus();
}
