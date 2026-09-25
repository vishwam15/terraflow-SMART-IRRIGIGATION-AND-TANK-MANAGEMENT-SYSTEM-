/*
  TERRAFLOW SMART IRRIGATION - ESP32-S3
  ======================================

  PUMP 1 = TANK-FILLING PUMP -> GPIO 6
  PUMP 2 = IRRIGATION PUMP   -> GPIO 7

  SOIL MOISTURE -> GPIO 1
  HC-SR04 TRIG  -> GPIO 4
  HC-SR04 ECHO  -> GPIO 5 (through voltage divider)

  MQTT:
    Broker: broker.hivemq.com
    Port : 1883

  MQTT COMMAND TOPIC:
    irrigation/cmd

  COMMANDS:
    FILL_ON       -> Manual Tank-Filling Pump ON
    FILL_OFF      -> Manual Tank-Filling Pump OFF

    PUMP_ON       -> Manual Irrigation Pump ON
    PUMP_OFF      -> Manual Irrigation Pump OFF

    AUTO_MODE_ON  -> Enable Automatic Irrigation
    AUTO_MODE_OFF -> Disable Automatic Irrigation

  AUTOMATIC IRRIGATION:
    Moisture < 30% -> Pump 2 ON
    Moisture > 80% -> Pump 2 OFF
    30% to 80%     -> Keep current Pump 2 state

  IMPORTANT:
    - Pump 1 is ALWAYS manual. There is NO automatic tank filling.
    - Ultrasonic NO ECHO does NOT stop or block Pump 1 manual control.
    - Ultrasonic has NO effect on Pump 2.
    - Pump 2 works in both manual and automatic modes.
    - Only one pump can run at a time.
    - Soil moisture is published every 1 second.
*/

#include <WiFi.h>
#include <PubSubClient.h>

// ============================================================
// WIFI
// ============================================================
const char* WIFI_SSID = "V";
const char* WIFI_PASSWORD = "12345678";

// ============================================================
// MQTT
// ============================================================
const char* MQTT_BROKER = "broker.hivemq.com";
const int MQTT_PORT = 1883;
const char* MQTT_CLIENT_ID = "Terraflow_ESP32S3";

const char* TOPIC_COMMAND       = "irrigation/cmd";
const char* TOPIC_MOISTURE      = "irrigation/moisture";
const char* TOPIC_TANK_LEVEL    = "irrigation/tank_level";
const char* TOPIC_PUMP1_STATUS  = "irrigation/pump1_status";
const char* TOPIC_PUMP2_STATUS  = "irrigation/pump2_status";

// ============================================================
// PINS
// ============================================================
#define SOIL_PIN 1

#define TRIG_PIN 4
#define ECHO_PIN 5

// Pump 1 = Tank filling
#define PUMP1_PIN 6

// Pump 2 = Irrigation
#define PUMP2_PIN 7

// Relay is active LOW
#define RELAY_ON  LOW
#define RELAY_OFF HIGH

// ============================================================
// SOIL MOISTURE CALIBRATION
// ============================================================
// Higher ADC value = drier soil
// Lower ADC value  = wetter soil
#define SOIL_DRY 3000
#define SOIL_WET 1200

// Automatic irrigation thresholds
#define IRRIGATION_START_THRESHOLD 30
#define IRRIGATION_STOP_THRESHOLD 80

// ============================================================
// TANK
// ============================================================
#define TANK_HEIGHT_CM 8.0

// ============================================================
// OBJECTS
// ============================================================
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// ============================================================
// STATE
// ============================================================
bool pump1Running = false;
bool pump2Running = false;

bool autoIrrigation = false;

// Latest soil moisture value
int currentMoisture = 0;

// ============================================================
// TIMERS
// ============================================================
unsigned long lastMoisturePublish = 0;
const unsigned long MOISTURE_INTERVAL = 1000; // 1 second

unsigned long lastTankPublish = 0;
const unsigned long TANK_INTERVAL = 3000; // tank level every 3 seconds

// ============================================================
// FUNCTION DECLARATIONS
// ============================================================
void connectWiFi();
void connectMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);

int readMoisture();
float readTankLevel();

void updateAutomaticIrrigation();

void startFillingPumpManual();
void stopFillingPump();

void startIrrigationPumpManual();
void stopIrrigationPump();

void allPumpsOFF();

void publishMoisture();
void publishTankLevel();
void publishPumpStatus();

// ============================================================
// SETUP
// ============================================================
void setup()
{
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("========================================");
  Serial.println("     TERRAFLOW SMART IRRIGATION");
  Serial.println("           ESP32-S3 SYSTEM");
  Serial.println("========================================");

  // Sensor pins
  pinMode(SOIL_PIN, INPUT);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  // Relay pins
  pinMode(PUMP1_PIN, OUTPUT);
  pinMode(PUMP2_PIN, OUTPUT);

  // Safety: both pumps OFF
  digitalWrite(PUMP1_PIN, RELAY_OFF);
  digitalWrite(PUMP2_PIN, RELAY_OFF);

  pump1Running = false;
  pump2Running = false;

  digitalWrite(TRIG_PIN, LOW);

  Serial.println("Both pumps OFF at startup.");

  // WiFi
  connectWiFi();

  // MQTT
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);

  // Initial moisture reading
  currentMoisture = readMoisture();

  Serial.println("System ready.");
}

// ============================================================
// LOOP
// ============================================================
void loop()
{
  // Keep WiFi connected
  if (WiFi.status() != WL_CONNECTED)
  {
    connectWiFi();
  }

  // Keep MQTT connected
  if (!mqttClient.connected())
  {
    connectMQTT();
  }

  mqttClient.loop();

  // ----------------------------------------------------------
  // SOIL MOISTURE EVERY 1 SECOND
  // ----------------------------------------------------------
  if (millis() - lastMoisturePublish >= MOISTURE_INTERVAL)
  {
    lastMoisturePublish = millis();

    currentMoisture = readMoisture();

    // Always publish moisture every second
    publishMoisture();

    // Automatic irrigation uses this same reading
    if (autoIrrigation)
    {
      updateAutomaticIrrigation();
    }
  }

  // ----------------------------------------------------------
  // TANK LEVEL
  // ----------------------------------------------------------
  if (millis() - lastTankPublish >= TANK_INTERVAL)
  {
    lastTankPublish = millis();
    publishTankLevel();
  }

  delay(10);
}

// ============================================================
// WIFI
// ============================================================
void connectWiFi()
{
  if (WiFi.status() == WL_CONNECTED)
  {
    return;
  }

  Serial.print("Connecting to WiFi");

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;

  while (WiFi.status() != WL_CONNECTED && attempts < 20)
  {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED)
  {
    Serial.println("WiFi connected.");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  }
  else
  {
    Serial.println("WiFi connection failed.");
  }
}

// ============================================================
// MQTT CONNECTION
// ============================================================
void connectMQTT()
{
  while (!mqttClient.connected())
  {
    Serial.print("Connecting to MQTT...");

    // Use a unique client ID if the same ID is already connected
    String clientId = MQTT_CLIENT_ID;
    clientId += "_";
    clientId += String((uint32_t)ESP.getEfuseMac(), HEX);

    if (mqttClient.connect(clientId.c_str()))
    {
      Serial.println("connected.");

      mqttClient.subscribe(TOPIC_COMMAND);

      Serial.print("Subscribed to: ");
      Serial.println(TOPIC_COMMAND);

      // Safety after reconnect
      allPumpsOFF();

      // Automatic mode must be enabled again by frontend
      autoIrrigation = false;

      Serial.println("Automatic irrigation disabled after MQTT reconnect.");
    }
    else
    {
      Serial.print("MQTT connection failed. State = ");
      Serial.println(mqttClient.state());

      delay(3000);
    }
  }
}

// ============================================================
// MQTT CALLBACK
// ============================================================
void mqttCallback(char* topic, byte* payload, unsigned int length)
{
  String command = "";

  for (unsigned int i = 0; i < length; i++)
  {
    command += (char)payload[i];
  }

  command.trim();

  Serial.println();
  Serial.println("========== MQTT COMMAND ==========");
  Serial.print("Topic   : ");
  Serial.println(topic);
  Serial.print("Command : ");
  Serial.println(command);

  // ==========================================================
  // MANUAL TANK-FILLING PUMP
  // ==========================================================
  if (command == "FILL_ON")
  {
    startFillingPumpManual();
  }
  else if (command == "FILL_OFF")
  {
    stopFillingPump();
  }

  // ==========================================================
  // MANUAL IRRIGATION PUMP
  // ==========================================================
  else if (command == "PUMP_ON")
  {
    startIrrigationPumpManual();
  }
  else if (command == "PUMP_OFF")
  {
    stopIrrigationPump();
  }

  // ==========================================================
  // AUTOMATIC IRRIGATION
  // ==========================================================
  else if (command == "AUTO_MODE_ON" || command == "AUTO_ON")
  {
    autoIrrigation = true;

    Serial.println("AUTOMATIC IRRIGATION = ON");

    // Immediately evaluate the current moisture.
    updateAutomaticIrrigation();
  }
  else if (command == "AUTO_MODE_OFF" || command == "AUTO_OFF")
  {
    autoIrrigation = false;

    Serial.println("AUTOMATIC IRRIGATION = OFF");

    // Turning automatic mode OFF stops Pump 2.
    stopIrrigationPump();
  }
  else
  {
    Serial.println("Unknown MQTT command.");
  }

  Serial.println("==================================");
}

// ============================================================
// READ SOIL MOISTURE
// ============================================================
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

  Serial.print("Soil ADC: ");
  Serial.print(rawValue);
  Serial.print(" | Moisture: ");
  Serial.print(moisture);
  Serial.println("%");

  return moisture;
}

// ============================================================
// AUTOMATIC IRRIGATION
// ============================================================
// Automatic rules:
//
// moisture < 30%
//      -> Pump 2 ON
//
// moisture > 80%
//      -> Pump 2 OFF
//
// 30% to 80%
//      -> Keep current Pump 2 state
//
// Ultrasonic is NOT used here.
// ============================================================
void updateAutomaticIrrigation()
{
  int moisture = currentMoisture;

  // ----------------------------------------------------------
  // SOIL IS TOO DRY
  // ----------------------------------------------------------
  if (moisture < IRRIGATION_START_THRESHOLD)
  {
    if (!pump2Running)
    {
      // Mutual exclusion:
      // Pump 1 MUST be OFF before Pump 2 starts.
      digitalWrite(PUMP1_PIN, RELAY_OFF);
      pump1Running = false;

      digitalWrite(PUMP2_PIN, RELAY_ON);
      pump2Running = true;

      Serial.print("AUTO: Pump 2 ON. Moisture = ");
      Serial.print(moisture);
      Serial.println("% (< 30%).");

      publishPumpStatus();
    }

    return;
  }

  // ----------------------------------------------------------
  // SOIL IS WET ENOUGH
  // ----------------------------------------------------------
  if (moisture > IRRIGATION_STOP_THRESHOLD)
  {
    if (pump2Running)
    {
      Serial.print("AUTO: Pump 2 OFF. Moisture = ");
      Serial.print(moisture);
      Serial.println("% (> 80%).");

      stopIrrigationPump();
    }

    return;
  }

  // ----------------------------------------------------------
  // BETWEEN 30% AND 80%
  // ----------------------------------------------------------
  Serial.print("AUTO: Moisture = ");
  Serial.print(moisture);
  Serial.println("% -> keeping current Pump 2 state.");
}

// ============================================================
// MANUAL PUMP 1 - TANK FILLING
// ============================================================
// IMPORTANT:
// There is NO ultrasonic check here.
//
// Therefore:
// FILL_ON -> Pump 1 starts even when ultrasonic says NO ECHO.
//
// Pump 1 has NO automatic start logic.
// ============================================================
void startFillingPumpManual()
{
  // Mutual exclusion:
  // Pump 2 MUST be OFF before Pump 1 starts.
  digitalWrite(PUMP2_PIN, RELAY_OFF);
  pump2Running = false;

  digitalWrite(PUMP1_PIN, RELAY_ON);
  pump1Running = true;

  Serial.println("MANUAL: Pump 1 ON - tank filling.");
  Serial.println("Ultrasonic Echo is NOT required.");
  Serial.println("Pump 2 forced OFF.");

  publishPumpStatus();
}

// ============================================================
// MANUAL PUMP 1 OFF
// ============================================================
void stopFillingPump()
{
  digitalWrite(PUMP1_PIN, RELAY_OFF);
  pump1Running = false;

  Serial.println("MANUAL: Pump 1 OFF - tank filling stopped.");

  publishPumpStatus();
}

// ============================================================
// MANUAL PUMP 2 - IRRIGATION
// ============================================================
// Manual irrigation ignores:
//   - ultrasonic
//   - 30% start threshold
//
// PUMP_ON from frontend starts Pump 2.
// ============================================================
void startIrrigationPumpManual()
{
  // Mutual exclusion:
  // Pump 1 MUST be OFF before Pump 2 starts.
  digitalWrite(PUMP1_PIN, RELAY_OFF);
  pump1Running = false;

  digitalWrite(PUMP2_PIN, RELAY_ON);
  pump2Running = true;

  Serial.println("MANUAL: Pump 2 ON - irrigation.");
  Serial.println("Ultrasonic Echo does NOT affect Pump 2.");
  Serial.println("Pump 1 forced OFF.");

  publishPumpStatus();
}

// ============================================================
// MANUAL / GENERAL PUMP 2 OFF
// ============================================================
void stopIrrigationPump()
{
  digitalWrite(PUMP2_PIN, RELAY_OFF);
  pump2Running = false;

  Serial.println("Pump 2 OFF - irrigation stopped.");

  publishPumpStatus();
}

// ============================================================
// ULTRASONIC TANK LEVEL
// ============================================================
// Used ONLY for tank-level monitoring.
//
// It does NOT control Pump 1.
// It does NOT control Pump 2.
//
// NO ECHO simply publishes -1.
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

  if (duration == 0)
  {
    Serial.println("Ultrasonic: NO ECHO.");
    return -1.0;
  }

  float distance = duration * 0.0343 / 2.0;

  float waterLevel = TANK_HEIGHT_CM - distance;

  if (waterLevel < 0.0 || waterLevel > TANK_HEIGHT_CM)
  {
    Serial.println("Ultrasonic: INVALID LEVEL.");
    return -1.0;
  }

  return waterLevel;
}

// ============================================================
// PUBLISH SOIL MOISTURE
// ============================================================
void publishMoisture()
{
  if (!mqttClient.connected())
  {
    return;
  }

  char moistureBuffer[10];

  snprintf(
    moistureBuffer,
    sizeof(moistureBuffer),
    "%d",
    currentMoisture
  );

  bool result = mqttClient.publish(
    TOPIC_MOISTURE,
    moistureBuffer
  );

  if (result)
  {
    Serial.print("MQTT moisture sent: ");
    Serial.print(currentMoisture);
    Serial.println("%");
  }
  else
  {
    Serial.println("MQTT moisture publish failed.");
  }
}

// ============================================================
// PUBLISH TANK LEVEL
// ============================================================
void publishTankLevel()
{
  if (!mqttClient.connected())
  {
    return;
  }

  float tankLevel = readTankLevel();

  char tankBuffer[16];

  if (tankLevel < 0)
  {
    strcpy(tankBuffer, "-1");
    mqttClient.publish(TOPIC_TANK_LEVEL, tankBuffer);

    Serial.println("MQTT tank level: -1 (NO ECHO)");
  }
  else
  {
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

    Serial.print("MQTT tank level sent: ");
    Serial.print(tankLevel);
    Serial.println(" cm");
  }
}

// ============================================================
// PUBLISH PUMP STATUS
// ============================================================
void publishPumpStatus()
{
  if (!mqttClient.connected())
  {
    return;
  }

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
// SAFETY - BOTH PUMPS OFF
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
