// ESP32-CAM Security System - Main JavaScript
// AI-Powered Object Detection with TensorFlow.js

// Global Variables
let esp32IP = '';
let isStreaming = false;
let detectionEnabled = false;
let alarmEnabled = false;
let aiModel = null;
let detectionInterval = null;
let detectionCount = 0;
let alertCount = 0;
let alertTriggerObjects = new Set(['person']); // Default: alert on person detection

// DOM Elements
const elements = {
    esp32IPInput: document.getElementById('esp32IP'),
    setIPBtn: document.getElementById('setIPBtn'),
    testConnectionBtn: document.getElementById('testConnectionBtn'),
    startStreamBtn: document.getElementById('startStreamBtn'),
    stopStreamBtn: document.getElementById('stopStreamBtn'),
    captureBtn: document.getElementById('captureBtn'),
    enableDetectionBtn: document.getElementById('enableDetectionBtn'),
    disableDetectionBtn: document.getElementById('disableDetectionBtn'),
    enableAlarmBtn: document.getElementById('enableAlarmBtn'),
    disableAlarmBtn: document.getElementById('disableAlarmBtn'),
    cameraFeed: document.getElementById('cameraFeed'),
    detectionCanvas: document.getElementById('detectionCanvas'),
    cameraPlaceholder: document.getElementById('cameraPlaceholder'),
    eventLog: document.getElementById('eventLog'),
    detectionCountSpan: document.getElementById('detectionCount'),
    alertCountSpan: document.getElementById('alertCount'),
    lastDetectionSpan: document.getElementById('lastDetection'),
    detectionActiveSpan: document.getElementById('detectionActive'),
    snapshotsContainer: document.getElementById('snapshotsContainer'),
    connectionStatus: document.getElementById('connectionStatus'),
    aiStatus: document.getElementById('aiStatus'),
    alarmStatus: document.getElementById('alarmStatus'),
    alertBanner: document.getElementById('alertBanner'),
    alertMessage: document.getElementById('alertMessage'),
    dismissAlertBtn: document.getElementById('dismissAlertBtn')
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    addEvent('System initialized and ready', 'info');
    console.log('Security System Dashboard Initialized');
    
    // Load AI Model
    await loadAIModel();
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup alert trigger checkboxes
    setupAlertTriggers();
    
    // Load saved IP if exists
    const savedIP = localStorage.getItem('esp32IP');
    if (savedIP) {
        elements.esp32IPInput.value = savedIP;
    }
});

// Setup Event Listeners
function setupEventListeners() {
    elements.setIPBtn.addEventListener('click', setIPAddress);
    elements.testConnectionBtn.addEventListener('click', testConnection);
    elements.startStreamBtn.addEventListener('click', startStream);
    elements.stopStreamBtn.addEventListener('click', stopStream);
    elements.captureBtn.addEventListener('click', capturePhoto);
    elements.enableDetectionBtn.addEventListener('click', enableDetection);
    elements.disableDetectionBtn.addEventListener('click', disableDetection);
    elements.enableAlarmBtn.addEventListener('click', enableAlarm);
    elements.disableAlarmBtn.addEventListener('click', disableAlarm);
    elements.dismissAlertBtn.addEventListener('click', dismissAlert);
}

// Setup Alert Trigger Checkboxes
function setupAlertTriggers() {
    const checkboxes = document.querySelectorAll('.object-checkbox input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateAlertTriggers);
    });
    updateAlertTriggers(); // Initialize with default (person)
}

// Update Alert Triggers
function updateAlertTriggers() {
    alertTriggerObjects.clear();
    const checkboxes = document.querySelectorAll('.object-checkbox input[type="checkbox"]:checked');
    checkboxes.forEach(checkbox => {
        alertTriggerObjects.add(checkbox.value);
    });
    addEvent(`Alert triggers updated: ${Array.from(alertTriggerObjects).join(', ')}`, 'info');
}

// Load TensorFlow.js AI Model
async function loadAIModel() {
    try {
        addEvent('Loading AI detection model...', 'info');
        aiModel = await cocoSsd.load();
        console.log('COCO-SSD model loaded');
        addEvent('✓ AI Model loaded successfully! Ready for human detection.', 'success');
        elements.aiStatus.textContent = 'Ready';
        elements.aiStatus.style.color = '#4ade80';
    } catch (error) {
        console.error('Failed to load AI model:', error);
        addEvent('✗ Failed to load AI model', 'error');
        elements.aiStatus.textContent = 'Failed';
        elements.aiStatus.style.color = '#ef4444';
    }
}

// Set IP Address
function setIPAddress() {
    const ip = elements.esp32IPInput.value.trim();
    if (!ip) {
        addEvent('Please enter an IP address', 'error');
        return;
    }
    
    esp32IP = ip;
    localStorage.setItem('esp32IP', ip);
    addEvent(`Camera set to ${ip} - Click Start Stream to begin`, 'success');
    elements.connectionStatus.textContent = 'Ready';
    elements.connectionStatus.style.color = '#fbbf24';
}

// Test Connection
async function testConnection() {
    if (!esp32IP) {
        addEvent('Please set IP address first', 'error');
        return;
    }
    
    try {
        addEvent(`Testing connection to ${esp32IP}...`, 'info');
        // Just try to fetch, ignore CORS errors since mode: 'no-cors' doesn't give us response
        await fetch(`http://${esp32IP}/`, { mode: 'no-cors' }).catch(() => {});
        // Assume success if no network error
        addEvent('✓ Connection test sent (CORS may block response)', 'success');
        elements.connectionStatus.textContent = 'Ready';
        elements.connectionStatus.style.color = '#fbbf24';
    } catch (error) {
        addEvent('✗ Connection failed. Check IP and network.', 'error');
        elements.connectionStatus.textContent = 'Failed';
        elements.connectionStatus.style.color = '#ef4444';
    }
}

// Start Camera Stream
function startStream() {
    if (!esp32IP) {
        addEvent('Please set IP address first', 'error');
        return;
    }
    
    addEvent(`📹 Attempting to connect to http://${esp32IP}/stream`, 'info');
    
    const streamUrl = `http://${esp32IP}/stream`;
    
    // Set crossOrigin for AI detection (ESP32 sends CORS headers)
    elements.cameraFeed.crossOrigin = "anonymous";
    
    // Set up the camera feed element directly
    elements.cameraFeed.onload = () => {
        isStreaming = true;
        elements.cameraFeed.style.display = 'block';
        elements.cameraPlaceholder.style.display = 'none';
        elements.startStreamBtn.disabled = true;
        elements.stopStreamBtn.disabled = false;
        addEvent(`✓ Stream connected successfully!`, 'success');
        elements.connectionStatus.textContent = 'Streaming';
        elements.connectionStatus.style.color = '#4ade80';
        
        // Setup canvas to match video size
        setTimeout(() => {
            const canvas = elements.detectionCanvas;
            canvas.width = elements.cameraFeed.naturalWidth || 640;
            canvas.height = elements.cameraFeed.naturalHeight || 480;
        }, 500);
    };
    
    elements.cameraFeed.onerror = (e) => {
        console.error('Stream error:', e);
        addEvent('❌ Cannot connect to ESP32 stream. Possible issues:', 'error');
        addEvent(`   1. ESP32 IP (${esp32IP}) incorrect or changed`, 'error');
        addEvent('   2. ESP32 not powered on or not on same network', 'error');
        addEvent('   3. Check ESP32 serial monitor for actual IP', 'error');
        addEvent('   4. Try accessing http://' + esp32IP + ' directly in browser', 'error');
        elements.connectionStatus.textContent = 'Failed';
        elements.connectionStatus.style.color = '#ef4444';
    };
    
    // Start the stream (don't use crossOrigin to avoid CORS issues)
    elements.cameraFeed.src = streamUrl + '?t=' + Date.now();
}

// Stop Camera Stream
function stopStream() {
    elements.cameraFeed.src = '';
    elements.cameraFeed.style.display = 'none';
    elements.cameraPlaceholder.style.display = 'flex';
    isStreaming = false;
    elements.startStreamBtn.disabled = false;
    elements.stopStreamBtn.disabled = true;
    
    if (detectionEnabled) {
        disableDetection();
    }
    
    addEvent('Stream stopped', 'info');
    elements.connectionStatus.textContent = 'Disconnected';
    elements.connectionStatus.style.color = '#9ca3af';
}

// Capture Photo
async function capturePhoto() {
    if (!isStreaming) {
        addEvent('Start streaming first', 'error');
        return;
    }
    
    try {
        const response = await fetch(`http://${esp32IP}/capture`, { mode: 'no-cors' });
        addEvent('📸 Photo captured!', 'success');
        
        // Also capture from canvas
        captureSnapshot();
    } catch (error) {
        addEvent('Failed to capture photo', 'error');
    }
}

// Enable AI Detection
function enableDetection() {
    if (!isStreaming) {
        addEvent('Start streaming first', 'error');
        return;
    }
    
    if (!aiModel) {
        addEvent('AI model not loaded yet', 'error');
        return;
    }
    
    detectionEnabled = true;
    elements.enableDetectionBtn.disabled = true;
    elements.disableDetectionBtn.disabled = false;
    elements.detectionActiveSpan.textContent = 'Yes';
    elements.detectionActiveSpan.style.color = '#4ade80';
    elements.aiStatus.textContent = 'Active';
    elements.aiStatus.style.color = '#4ade80';
    
    addEvent('🔍 AI Detection enabled', 'success');
    
    // Start detection loop
    detectionInterval = setInterval(detectObjects, 500); // Run every 500ms
}

// Disable AI Detection
function disableDetection() {
    detectionEnabled = false;
    elements.enableDetectionBtn.disabled = false;
    elements.disableDetectionBtn.disabled = true;
    elements.detectionActiveSpan.textContent = 'No';
    elements.detectionActiveSpan.style.color = '#9ca3af';
    elements.aiStatus.textContent = 'Inactive';
    elements.aiStatus.style.color = '#9ca3af';
    
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }
    
    // Clear canvas
    const canvas = elements.detectionCanvas;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    addEvent('AI Detection disabled', 'info');
}

// Detect Objects using AI
async function detectObjects() {
    if (!detectionEnabled || !aiModel || !isStreaming) return;
    
    try {
        const predictions = await aiModel.detect(elements.cameraFeed);
        
        // Update canvas
        drawPredictions(predictions);
        
        // Check for alert triggers
        if (predictions.length > 0) {
            detectionCount++;
            elements.detectionCountSpan.textContent = detectionCount;
            
            const detectedObjects = predictions.map(p => p.class);
            const uniqueObjects = [...new Set(detectedObjects)];
            elements.lastDetectionSpan.textContent = uniqueObjects.join(', ');
            
            // Check if any detected object is in alert triggers
            const triggeredObjects = uniqueObjects.filter(obj => alertTriggerObjects.has(obj));
            
            if (triggeredObjects.length > 0) {
                handleAlert(triggeredObjects, predictions);
            }
        }
    } catch (error) {
        console.error('Detection error:', error);
    }
}

// Draw Predictions on Canvas
function drawPredictions(predictions) {
    const canvas = elements.detectionCanvas;
    const ctx = canvas.getContext('2d');
    
    // Match canvas size to image
    if (elements.cameraFeed.naturalWidth > 0) {
        canvas.width = elements.cameraFeed.naturalWidth;
        canvas.height = elements.cameraFeed.naturalHeight;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    predictions.forEach(prediction => {
        const [x, y, width, height] = prediction.bbox;
        
        // Draw bounding box
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
        
        // Draw label background
        ctx.fillStyle = '#00ff00';
        const text = `${prediction.class} ${Math.round(prediction.score * 100)}%`;
        const textWidth = ctx.measureText(text).width;
        ctx.fillRect(x, y - 20, textWidth + 10, 20);
        
        // Draw label text
        ctx.fillStyle = '#000000';
        ctx.font = '14px Arial';
        ctx.fillText(text, x + 5, y - 5);
    });
}

// Handle Alert
function handleAlert(triggeredObjects, predictions) {
    alertCount++;
    elements.alertCountSpan.textContent = alertCount;
    
    const objectList = triggeredObjects.join(', ');
    const message = `Alert! ${objectList} detected in room!`;
    
    addEvent(`🚨 ${message}`, 'alert');
    
    // Show alert banner
    showAlertBanner(message);
    
    // Trigger alarm if enabled
    if (alarmEnabled) {
        triggerAlarm();
    }
    
    // Speak alert
    speakAlert(message);
    
    // Auto-capture snapshot
    captureSnapshot(`Alert: ${objectList}`);
}

// Show Alert Banner
function showAlertBanner(message) {
    elements.alertMessage.textContent = message;
    elements.alertBanner.classList.remove('hidden');
    elements.alertBanner.classList.add('show');
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        elements.alertBanner.classList.remove('show');
        setTimeout(() => {
            elements.alertBanner.classList.add('hidden');
        }, 300);
    }, 10000);
}

// Speak Alert using Text-to-Speech
function speakAlert(message) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 1.2;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        speechSynthesis.speak(utterance);
    }
}

// Dismiss Alert Banner
function dismissAlert() {
    elements.alertBanner.classList.remove('show');
    setTimeout(() => {
        elements.alertBanner.classList.add('hidden');
    }, 300);
    
    // Stop any ongoing speech
    if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
    }
    
    addEvent('Alert dismissed', 'info');
}

// Capture Snapshot
function captureSnapshot(label = null) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = elements.cameraFeed.naturalWidth || elements.cameraFeed.width;
    canvas.height = elements.cameraFeed.naturalHeight || elements.cameraFeed.height;
    
    // Draw current frame
    ctx.drawImage(elements.cameraFeed, 0, 0, canvas.width, canvas.height);
    
    // Draw detection overlay
    const detectionCanvas = elements.detectionCanvas;
    ctx.drawImage(detectionCanvas, 0, 0, canvas.width, canvas.height);
    
    // Convert to image
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    
    // Add to snapshots
    addSnapshot(dataUrl, label);
}

// Add Snapshot to Gallery
function addSnapshot(dataUrl, label) {
    const container = elements.snapshotsContainer;
    
    // Remove placeholder
    const placeholder = container.querySelector('.placeholder-text');
    if (placeholder) {
        placeholder.remove();
    }
    
    // Create snapshot element
    const snapshotDiv = document.createElement('div');
    snapshotDiv.className = 'snapshot-item';
    
    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = 'Snapshot';
    
    const time = new Date().toLocaleTimeString();
    const timeLabel = document.createElement('div');
    timeLabel.className = 'snapshot-time';
    timeLabel.textContent = label ? `${label} - ${time}` : time;
    
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'btn btn-small';
    downloadBtn.textContent = '💾 Download';
    downloadBtn.onclick = () => downloadSnapshot(dataUrl, time);
    
    snapshotDiv.appendChild(img);
    snapshotDiv.appendChild(timeLabel);
    snapshotDiv.appendChild(downloadBtn);
    
    container.insertBefore(snapshotDiv, container.firstChild);
}

// Download Snapshot
function downloadSnapshot(dataUrl, time) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `security_snapshot_${time.replace(/:/g, '-')}.jpg`;
    link.click();
}

// Display Snapshots
function displaySnapshots(snapshots) {
    elements.snapshotsContainer.innerHTML = '';
    if (snapshots.length === 0) {
        elements.snapshotsContainer.innerHTML = '<p class="placeholder-text">No snapshots captured yet</p>';
        return;
    }
    
    snapshots.forEach(snapshot => {
        addSnapshot(snapshot.dataUrl, snapshot.label);
    });
}

// Enable Alarm
async function enableAlarm() {
    try {
        const response = await fetch(`http://${esp32IP}/alarm/enable`, { mode: 'no-cors' });
        alarmEnabled = true;
        elements.enableAlarmBtn.disabled = true;
        elements.disableAlarmBtn.disabled = false;
        elements.alarmStatus.textContent = 'Enabled';
        elements.alarmStatus.style.color = '#ef4444';
        addEvent('🚨 Alarm system enabled', 'alert');
    } catch (error) {
        addEvent('Failed to enable alarm', 'error');
    }
}

// Disable Alarm
async function disableAlarm() {
    try {
        const response = await fetch(`http://${esp32IP}/alarm/disable`, { mode: 'no-cors' });
        alarmEnabled = false;
        elements.enableAlarmBtn.disabled = false;
        elements.disableAlarmBtn.disabled = true;
        elements.alarmStatus.textContent = 'Disabled';
        elements.alarmStatus.style.color = '#9ca3af';
        addEvent('Alarm system disabled', 'info');
    } catch (error) {
        addEvent('Failed to disable alarm', 'error');
    }
}

// Trigger Alarm
async function triggerAlarm() {
    try {
        await fetch(`http://${esp32IP}/alarm/trigger`, { mode: 'no-cors' });
    } catch (error) {
        console.error('Failed to trigger alarm:', error);
    }
}

// Add Event to Log
function addEvent(message, type = 'info') {
    const eventLog = elements.eventLog;
    const entry = document.createElement('p');
    entry.className = `log-entry ${type}`;
    
    const timestamp = new Date().toLocaleTimeString();
    entry.textContent = `[${timestamp}] ${message}`;
    
    // Add color based on type
    switch(type) {
        case 'success':
            entry.style.color = '#4ade80';
            break;
        case 'error':
            entry.style.color = '#ef4444';
            break;
        case 'alert':
            entry.style.color = '#fbbf24';
            entry.style.fontWeight = 'bold';
            break;
        case 'info':
        default:
            entry.style.color = '#60a5fa';
            break;
    }
    
    eventLog.insertBefore(entry, eventLog.firstChild);
    
    // Keep only last 50 entries
    while (eventLog.children.length > 50) {
        eventLog.removeChild(eventLog.lastChild);
    }
    
    // Console log for debugging
    console.log(`[${type.toUpperCase()}] ${message}`);
}
