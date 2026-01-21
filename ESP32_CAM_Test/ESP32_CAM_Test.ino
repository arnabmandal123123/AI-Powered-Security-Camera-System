/*
 * ESP32-CAM Security System with Human Detection
 * Advanced security camera with motion detection and alarm capabilities
 * 
 * Features:
 * - Camera initialization and configuration
 * - HTTP web server for live streaming
 * - Single image capture endpoint
 * - WiFi connectivity
 * - Motion detection support
 * - Alarm system integration
 * - Security event logging
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>

// ============ WIFI CREDENTIALS ============
// Replace with your WiFi credentials
const char* ssid = "Arnabmandal";
const char* password = "hm403496";

// ============ CAMERA PIN DEFINITIONS (AI-THINKER ESP32-CAM) ============
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27

#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// ============ WEB SERVER ============
WebServer server(80);

// ============ LED PIN ============
#define LED_BUILTIN 4

// ============ ALARM BUZZER PIN (optional) ============
// #define BUZZER_PIN 12  // Uncomment and connect buzzer to GPIO 12 if needed

// ============ SECURITY STATE ============
bool alarmEnabled = false;
unsigned long lastMotionTime = 0;
unsigned long alarmTriggeredTime = 0;
int motionEventCount = 0;

// ============ FUNCTION PROTOTYPES ============
bool setupCamera();
bool connectWiFi();
void startAPMode();
void handleRoot();
void handleStream();
void handleCapture();
void handleStatus();
void handleNotFound();
void handleAlarmToggle();
void handleSecurityStatus();
void handleMotionDetection();

// ============ SETUP ============
void setup() {
  Serial.begin(115200);
  delay(1000); // Give serial time to initialize
  
  Serial.println("\n===================================");
  Serial.println("ESP32-CAM Test - Starting...");
  Serial.println("===================================\n");
  
  // Print diagnostic information
  Serial.println("--- System Diagnostics ---");
  Serial.print("Chip Model: ");
  Serial.println(ESP.getChipModel());
  Serial.print("Chip Revision: ");
  Serial.println(ESP.getChipRevision());
  Serial.print("CPU Frequency: ");
  Serial.print(ESP.getCpuFreqMHz());
  Serial.println(" MHz");
  Serial.print("Free Heap: ");
  Serial.print(ESP.getFreeHeap());
  Serial.println(" bytes");
  Serial.print("PSRAM Found: ");
  Serial.println(psramFound() ? "YES" : "NO");
  if(psramFound()) {
    Serial.print("PSRAM Size: ");
    Serial.print(ESP.getPsramSize() / 1024);
    Serial.println(" KB");
  }
  Serial.println();
  
  // Disable brownout detector (common issue with inadequate power)
  // WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
  Serial.println("⚠ WARNING: Ensure 5V/2A power supply!");
  Serial.println("Low power can cause camera init failures\n");
  
  // Initialize LED (but keep it off to save power during init)
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);
  
  // Initialize buzzer if enabled
  // #ifdef BUZZER_PIN
  // pinMode(BUZZER_PIN, OUTPUT);
  // digitalWrite(BUZZER_PIN, LOW);
  // #endif
  
  // Initialize camera with retry
  bool cameraOK = false;
  for(int i = 0; i < 3; i++) {
    if(setupCamera()) {
      cameraOK = true;
      break;
    }
    Serial.printf("Retrying camera init... (%d/3)\n", i + 2);
    delay(1000);
  }
  
  if(!cameraOK) {
    Serial.println("\n❌ CAMERA FAILED TO INITIALIZE!");
    Serial.println("Possible causes:");
    Serial.println("1. Insufficient power supply (need 5V/2A)");
    Serial.println("2. Camera ribbon cable loose");
    Serial.println("3. Faulty camera module");
    Serial.println("\nDevice will restart in 10 seconds...");
    delay(10000);
    ESP.restart();
  }
  
  // Connect to WiFi with retry
  if(!connectWiFi()) {
    Serial.println("\n❌ WiFi FAILED TO CONNECT!");
    Serial.println("Continuing in AP mode...");
    startAPMode();
  }
  
  // Setup web server routes
  server.on("/", handleRoot);
  server.on("/stream", handleStream);
  server.on("/capture", handleCapture);
  server.on("/status", handleStatus);
  server.on("/alarm/toggle", handleAlarmToggle);
  server.on("/security/status", handleSecurityStatus);
  server.on("/motion", handleMotionDetection);
  server.onNotFound(handleNotFound);
  
  // Start server
  server.begin();
  Serial.println("\n✓ HTTP server started!");
  
  // Print access information
  Serial.println("\n--- Access Information ---");
  if(WiFi.status() == WL_CONNECTED) {
    Serial.print("Mode: Station (Connected to ");
    Serial.print(ssid);
    Serial.println(")");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Gateway: ");
    Serial.println(WiFi.gatewayIP());
    Serial.print("Signal Strength: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    Serial.println("\n📹 Camera Stream: http://" + WiFi.localIP().toString() + "/stream");
    Serial.println("📷 Single Capture: http://" + WiFi.localIP().toString() + "/capture");
    Serial.println("🏠 Web Interface: http://" + WiFi.localIP().toString() + "/");
    Serial.println("📊 Status Page: http://" + WiFi.localIP().toString() + "/status");
    Serial.println("🔒 Security Status: http://" + WiFi.localIP().toString() + "/security/status");
    Serial.println("🚨 Alarm Control: http://" + WiFi.localIP().toString() + "/alarm/toggle");
  } else {
    Serial.println("Mode: Access Point");
    Serial.print("SSID: ");
    Serial.println("ESP32-CAM-AP");
    Serial.print("IP Address: ");
    Serial.println(WiFi.softAPIP());
    Serial.println("\n🏠 Connect to WiFi 'ESP32-CAM-AP' (no password)");
    Serial.println("📹 Then visit: http://" + WiFi.softAPIP().toString());
  }
  
  Serial.println("\n===================================");
  Serial.println("✓ SECURITY SYSTEM READY - Armed\n");
  
  // Flash LED to indicate ready
  for(int i = 0; i < 3; i++) {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(200);
    digitalWrite(LED_BUILTIN, LOW);
    delay(200);
  }
}

// ============ MAIN LOOP ============
void loop() {
  server.handleClient();
  delay(1);
}

// ============ CAMERA SETUP ============
bool setupCamera() {
  Serial.println("--- Initializing Camera ---");
  
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 16000000; // Reduced for stability (16MHz instead of 20MHz)
  config.pixel_format = PIXFORMAT_JPEG;
  config.grab_mode = CAMERA_GRAB_LATEST; // Use latest frame, skip old ones
  
  // Frame size and quality settings optimized for speed
  if(psramFound()) {
    config.frame_size = FRAMESIZE_QVGA; // 320x240 - Lower for stability
    config.jpeg_quality = 20; // Higher value = more compression = less power
    config.fb_count = 1; // Single buffer to reduce power
    config.fb_location = CAMERA_FB_IN_PSRAM;
    Serial.println("✓ PSRAM found - Power-saving mode");
  } else {
    config.frame_size = FRAMESIZE_QVGA; // 320x240
    config.jpeg_quality = 25; // More compression for slower systems
    config.fb_count = 1;
    config.fb_location = CAMERA_FB_IN_DRAM;
    Serial.println("⚠ No PSRAM - Reduced quality mode");
  }
  
  // Initialize camera
  Serial.print("Initializing camera sensor... ");
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("FAILED!\n");
    Serial.printf("Error code: 0x%x\n", err);
    
    // Print specific error messages
    if(err == ESP_ERR_NOT_FOUND) {
      Serial.println("Camera sensor not found!");
      Serial.println("Check camera ribbon cable connection.");
    } else if(err == ESP_ERR_NO_MEM) {
      Serial.println("Out of memory!");
      Serial.println("Try reducing frame size or quality.");
    } else if(err == ESP_ERR_INVALID_STATE) {
      Serial.println("Invalid state - camera may be already initialized.");
    } else {
      Serial.println("Unknown error - check power supply (need 5V/2A).");
    }
    
    return false;
  }
  
  Serial.println("SUCCESS!");
  
  // Get camera sensor
  sensor_t * s = esp_camera_sensor_get();
  if(s == NULL) {
    Serial.println("Failed to get camera sensor!");
    return false;
  }
  
  // Print sensor info
  Serial.print("Sensor ID: 0x");
  Serial.println(s->id.PID, HEX);
  
  // Optimize sensor settings to reduce noise and artifacts
  s->set_brightness(s, 0);     // -2 to 2
  s->set_contrast(s, 0);       // -2 to 2
  s->set_saturation(s, 0);     // -2 to 2
  s->set_special_effect(s, 0); // 0 to 6 (0 - No Effect)
  s->set_whitebal(s, 1);       // Enable auto white balance
  s->set_awb_gain(s, 1);       // Enable auto white balance gain
  s->set_wb_mode(s, 0);        // Auto white balance mode
  s->set_exposure_ctrl(s, 1);  // Enable auto exposure
  s->set_aec2(s, 1);           // Enable AEC DSP (reduces lines)
  s->set_ae_level(s, 0);       // Auto exposure level
  s->set_aec_value(s, 300);    // AEC value
  s->set_gain_ctrl(s, 1);      // Enable gain control
  s->set_agc_gain(s, 0);       // AGC gain
  s->set_gainceiling(s, (gainceiling_t)2);  // Limit gain ceiling (reduces noise)
  s->set_bpc(s, 1);            // Enable black pixel correction (fixes lines!)
  s->set_wpc(s, 1);            // Enable white pixel correction (fixes lines!)
  s->set_raw_gma(s, 1);        // Enable gamma correction
  s->set_lenc(s, 1);           // Enable lens correction
  s->set_hmirror(s, 0);        // Horizontal mirror
  s->set_vflip(s, 0);          // Vertical flip
  s->set_dcw(s, 1);            // Enable downsize
  s->set_colorbar(s, 0);       // Disable color bar test pattern
  
  // Test camera by taking a test frame
  Serial.print("Testing camera capture... ");
  camera_fb_t * fb = esp_camera_fb_get();
  if(!fb) {
    Serial.println("FAILED!");
    return false;
  }
  Serial.printf("SUCCESS! (Frame size: %d bytes)\n", fb->len);
  esp_camera_fb_return(fb);
  
  Serial.println("✓ Camera initialized and tested successfully!\n");
  return true;
}

// ============ WIFI CONNECTION ============
bool connectWiFi() {
  Serial.println("--- Connecting to WiFi ---");
  Serial.print("SSID: ");
  Serial.println(ssid);
  Serial.print("Attempting connection");
  
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false); // Disable power saving for better performance
  WiFi.setTxPower(WIFI_POWER_19_5dBm); // Maximum WiFi power for better speed
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
    
    // Show WiFi status
    if(attempts % 10 == 0) {
      Serial.printf("\nStatus: %d | ", WiFi.status());
      switch(WiFi.status()) {
        case WL_IDLE_STATUS: Serial.print("Idle"); break;
        case WL_NO_SSID_AVAIL: Serial.print("SSID not found"); break;
        case WL_CONNECT_FAILED: Serial.print("Connection failed"); break;
        case WL_CONNECTION_LOST: Serial.print("Connection lost"); break;
        case WL_DISCONNECTED: Serial.print("Disconnected"); break;
        default: Serial.print("Unknown"); break;
      }
      Serial.print(" | Trying again");
    }
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi connected successfully!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Subnet Mask: ");
    Serial.println(WiFi.subnetMask());
    Serial.print("Gateway: ");
    Serial.println(WiFi.gatewayIP());
    Serial.print("DNS: ");
    Serial.println(WiFi.dnsIP());
    Serial.print("MAC Address: ");
    Serial.println(WiFi.macAddress());
    Serial.print("Signal Strength: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    return true;
  } else {
    Serial.println("\n✗ WiFi connection failed!");
    Serial.println("\nTroubleshooting:");
    Serial.println("1. Check SSID name: '" + String(ssid) + "'");
    Serial.println("2. Verify password is correct");
    Serial.println("3. Check if router is in range");
    Serial.println("4. Verify 2.4GHz WiFi (ESP32 doesn't support 5GHz)");
    Serial.println("5. Check if router has MAC filtering enabled");
    return false;
  }
}

// ============ START ACCESS POINT MODE ============
void startAPMode() {
  Serial.println("\n--- Starting Access Point Mode ---");
  WiFi.mode(WIFI_AP);
  WiFi.softAP("ESP32-CAM-AP", ""); // No password for easy access
  
  IPAddress IP = WiFi.softAPIP();
  Serial.print("✓ AP Started! IP address: ");
  Serial.println(IP);
  Serial.println("Connect to WiFi: ESP32-CAM-AP (no password)");
  Serial.println("Then visit: http://" + IP.toString());
}

// ============ WEB SERVER HANDLERS ============

// Root page - Security control panel
void handleRoot() {
  String html = "<!DOCTYPE html><html><head>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1.0'>";
  html += "<title>ESP32-CAM Security System</title>";
  html += "<style>";
  html += "body { font-family: Arial; margin: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }";
  html += ".container { max-width: 900px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }";
  html += "h1 { color: #2c3e50; text-align: center; margin-bottom: 10px; }";
  html += ".subtitle { text-align: center; color: #7f8c8d; margin-bottom: 20px; }";
  html += ".status { background: #27ae60; color: white; padding: 15px; border-radius: 5px; margin: 10px 0; }";
  html += ".alarm-status { background: " + String(alarmEnabled ? "#e74c3c" : "#95a5a6") + "; color: white; padding: 15px; border-radius: 5px; margin: 10px 0; text-align: center; font-size: 1.2em; font-weight: bold; }";
  html += ".button { display: inline-block; background: #3498db; color: white; padding: 12px 24px; margin: 5px; text-decoration: none; border-radius: 5px; cursor: pointer; border: none; }";
  html += ".button:hover { background: #2980b9; }";
  html += ".button-danger { background: #e74c3c; }";
  html += ".button-danger:hover { background: #c0392b; }";
  html += ".button-success { background: #27ae60; }";
  html += ".button-success:hover { background: #229954; }";
  html += "img { max-width: 100%; border-radius: 5px; margin: 10px 0; border: 3px solid #3498db; }";
  html += ".info { background: #ecf0f1; padding: 15px; border-radius: 5px; margin: 10px 0; }";
  html += ".controls { text-align: center; margin: 20px 0; }";
  html += ".security-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 15px 0; }";
  html += ".stat-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #3498db; }";
  html += ".stat-label { color: #7f8c8d; font-size: 0.9em; }";
  html += ".stat-value { color: #2c3e50; font-size: 1.5em; font-weight: bold; margin-top: 5px; }";
  html += "</style></head><body>";
  
  html += "<div class='container'>";
  html += "<h1>🔒 ESP32-CAM Security System</h1>";
  html += "<p class='subtitle'>Human Detection & Alarm Monitoring</p>";
  
  html += "<div class='alarm-status'>";
  html += "🚨 ALARM: " + String(alarmEnabled ? "ARMED" : "DISARMED");
  html += "</div>";
  
  html += "<div class='status'>";
  html += "✓ Camera Status: Active<br>";
  html += "✓ WiFi Connected: " + WiFi.localIP().toString() + "<br>";
  html += "✓ Signal: " + String(WiFi.RSSI()) + " dBm<br>";
  html += "✓ Uptime: " + String(millis() / 1000) + " seconds";
  html += "</div>";
  
  html += "<div class='security-grid'>";
  html += "<div class='stat-card'><div class='stat-label'>Motion Events</div><div class='stat-value'>" + String(motionEventCount) + "</div></div>";
  html += "<div class='stat-card'><div class='stat-label'>Last Motion</div><div class='stat-value'>" + String((millis() - lastMotionTime) / 1000) + "s ago</div></div>";
  html += "<div class='stat-card'><div class='stat-label'>Free Memory</div><div class='stat-value'>" + String(ESP.getFreeHeap() / 1024) + " KB</div></div>";
  html += "</div>";
  
  html += "<div class='controls'>";
  html += "<h2>Security Controls</h2>";
  html += "<button onclick='toggleAlarm()' class='button " + String(alarmEnabled ? "button-danger" : "button-success") + "'>";
  html += alarmEnabled ? "🔓 DISARM ALARM" : "🔒 ARM ALARM";
  html += "</button>";
  html += "</div>";
  
  html += "<div class='controls'>";
  html += "<h2>Camera Controls</h2>";
  html += "<a href='/stream' class='button' target='_blank'>📹 Live Stream</a>";
  html += "<a href='/capture' class='button' target='_blank'>📷 Capture Image</a>";
  html += "<button onclick='refreshStatus()' class='button'>🔄 Refresh Status</button>";
  html += "</div>";
  
  html += "<h2>Live Security Feed</h2>";
  html += "<img id='stream' src='/stream' onerror='this.src=\"\"' />";
  
  html += "<div class='info'>";
  html += "<h3>📡 API Endpoints:</h3>";
  html += "<p><strong>Stream:</strong> http://" + WiFi.localIP().toString() + "/stream</p>";
  html += "<p><strong>Capture:</strong> http://" + WiFi.localIP().toString() + "/capture</p>";
  html += "<p><strong>Security Status:</strong> http://" + WiFi.localIP().toString() + "/security/status</p>";
  html += "<p><strong>Toggle Alarm:</strong> http://" + WiFi.localIP().toString() + "/alarm/toggle</p>";
  html += "</div>";
  
  html += "<script>";
  html += "function toggleAlarm() {";
  html += "  fetch('/alarm/toggle').then(r => r.json()).then(data => {";
  html += "    alert('Alarm ' + (data.armed ? 'ARMED' : 'DISARMED'));";
  html += "    location.reload();";
  html += "  });";
  html += "}";
  html += "function refreshStatus() { location.reload(); }";
  html += "</script>";
  
  html += "</div></body></html>";
  
  server.send(200, "text/html", html);
}

// Stream handler - Optimized for low latency
void handleStream() {
  WiFiClient client = server.client();
  
  // Enable TCP_NODELAY for lower latency
  client.setNoDelay(true);
  
  client.println("HTTP/1.1 200 OK");
  client.println("Content-Type: multipart/x-mixed-replace; boundary=frame");
  client.println("Access-Control-Allow-Origin: *");
  client.println("Cache-Control: no-cache, no-store, must-revalidate");
  client.println("Pragma: no-cache");
  client.println();
  
  Serial.println("Stream started - optimized mode");
  
  unsigned long lastFrameTime = 0;
  unsigned long frameCount = 0;
  int failCount = 0;
  
  while (client.connected()) {
    // Dynamic frame rate: ~15-20 FPS (60-70ms between frames)
    unsigned long now = millis();
    if (now - lastFrameTime < 60) {
      delay(5); // Short delay to prevent CPU hogging
      continue;
    }
    
    camera_fb_t * fb = esp_camera_fb_get();
    if (!fb) {
      failCount++;
      if(failCount > 10) {
        Serial.println("Too many failures, stopping stream");
        break;
      }
      delay(50);
      continue;
    }
    
    // Quick validation
    if(fb->len < 100) {
      esp_camera_fb_return(fb);
      failCount++;
      continue;
    }
    
    failCount = 0;
    
    // Send frame header and data
    client.println("--frame");
    client.println("Content-Type: image/jpeg");
    client.printf("Content-Length: %d\r\n\r\n", fb->len);
    
    // Write frame data in one go for speed
    client.write(fb->buf, fb->len);
    client.println();
    
    esp_camera_fb_return(fb);
    
    frameCount++;
    lastFrameTime = now;
    
    // Print FPS every 5 seconds
    if(frameCount % 75 == 0) {
      unsigned long elapsed = millis() / 1000;
      if(elapsed > 0) {
        Serial.printf("Streaming: %.1f FPS\n", (float)frameCount / elapsed);
      }
    }
  }
  
  Serial.printf("Stream ended. Total frames: %lu\n", frameCount);
}

// Single image capture with quality assurance
void handleCapture() {
  // Flash LED before capture
  digitalWrite(LED_BUILTIN, HIGH);
  delay(50);
  
  // Get frame
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    digitalWrite(LED_BUILTIN, LOW);
    server.send(500, "text/plain", "Camera capture failed - check power supply");
    Serial.println("❌ Capture failed!");
    return;
  }
  
  // Validate frame size
  if(fb->len < 1000) {
    esp_camera_fb_return(fb);
    digitalWrite(LED_BUILTIN, LOW);
    server.send(500, "text/plain", "Invalid frame - possible power issue");
    Serial.printf("❌ Frame too small: %d bytes\n", fb->len);
    return;
  }
  
  digitalWrite(LED_BUILTIN, LOW);
  
  // Send image
  server.sendHeader("Content-Disposition", "inline; filename=capture.jpg");
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send_P(200, "image/jpeg", (const char *)fb->buf, fb->len);
  
  Serial.printf("✓ Image captured: %d bytes\n", fb->len);
  
  esp_camera_fb_return(fb);
}

// Status page handler
void handleStatus() {
  String json = "{";
  json += "\"heap\":" + String(ESP.getFreeHeap()) + ",";
  json += "\"psram\":" + String(psramFound() ? ESP.getFreePsram() : 0) + ",";
  json += "\"wifi_strength\":" + String(WiFi.RSSI()) + ",";
  json += "\"uptime\":" + String(millis() / 1000) + ",";
  json += "\"ip\":\"" + WiFi.localIP().toString() + "\",";
  json += "\"camera\":\"OK\"";
  json += "}";
  server.send(200, "application/json", json);
}

// 404 handler
void handleNotFound() {
  String message = "404 - Not Found\n\n";
  message += "URI: " + server.uri() + "\n";
  message += "Method: " + String((server.method() == HTTP_GET) ? "GET" : "POST") + "\n";
  message += "\nAvailable endpoints:\n";
  message += "/ - Main interface\n";
  message += "/stream - Live video stream\n";
  message += "/capture - Single image capture\n";
  message += "/status - System status (JSON)\n";
  message += "/security/status - Security system status (JSON)\n";
  message += "/alarm/toggle - Toggle alarm arm/disarm (JSON)\n";
  message += "/motion - Report motion detection (POST)\n";
  server.send(404, "text/plain", message);
}

// ============ SECURITY SYSTEM HANDLERS ============

// Toggle alarm armed/disarmed state
void handleAlarmToggle() {
  alarmEnabled = !alarmEnabled;
  
  String json = "{";
  json += "\"armed\":" + String(alarmEnabled ? "true" : "false") + ",";
  json += "\"timestamp\":" + String(millis()) + ",";
  json += "\"message\":\"Alarm " + String(alarmEnabled ? "armed" : "disarmed") + "\"";
  json += "}";
  
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", json);
  
  Serial.println(alarmEnabled ? "🔒 ALARM ARMED" : "🔓 ALARM DISARMED");
  
  // Flash LED to indicate status change
  for(int i = 0; i < (alarmEnabled ? 3 : 2); i++) {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(100);
    digitalWrite(LED_BUILTIN, LOW);
    delay(100);
  }
}

// Security system status endpoint
void handleSecurityStatus() {
  String json = "{";
  json += "\"armed\":" + String(alarmEnabled ? "true" : "false") + ",";
  json += "\"motion_events\":" + String(motionEventCount) + ",";
  json += "\"last_motion\":" + String(lastMotionTime) + ",";
  json += "\"alarm_triggered\":" + String(alarmTriggeredTime) + ",";
  json += "\"uptime\":" + String(millis() / 1000) + ",";
  json += "\"camera_status\":\"active\",";
  json += "\"wifi_strength\":" + String(WiFi.RSSI());
  json += "}";
  
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", json);
}

// Motion detection endpoint (called by web interface when human detected)
void handleMotionDetection() {
  if(server.method() != HTTP_POST && server.method() != HTTP_GET) {
    server.send(405, "text/plain", "Method Not Allowed");
    return;
  }
  
  lastMotionTime = millis();
  motionEventCount++;
  
  Serial.println("⚠️ MOTION DETECTED - Event #" + String(motionEventCount));
  
  // If alarm is armed, trigger it
  if(alarmEnabled) {
    alarmTriggeredTime = millis();
    Serial.println("🚨 ALARM TRIGGERED! Human detected at " + String(alarmTriggeredTime / 1000) + "s");
    
    // Flash LED rapidly to indicate alarm
    for(int i = 0; i < 10; i++) {
      digitalWrite(LED_BUILTIN, HIGH);
      delay(50);
      digitalWrite(LED_BUILTIN, LOW);
      delay(50);
    }
    
    // Optional: Activate buzzer
    // #ifdef BUZZER_PIN
    // tone(BUZZER_PIN, 2000, 500); // 2kHz for 500ms
    // #endif
  }
  
  String json = "{";
  json += "\"success\":true,";
  json += "\"armed\":" + String(alarmEnabled ? "true" : "false") + ",";
  json += "\"alarm_triggered\":" + String(alarmEnabled ? "true" : "false") + ",";
  json += "\"timestamp\":" + String(millis()) + ",";
  json += "\"event_count\":" + String(motionEventCount);
  json += "}";
  
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", json);
}

