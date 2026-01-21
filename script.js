// Smart Agricultural System - Dashboard JavaScript

// Global variables
let isConnected = false;
let isStreaming = false;
let updateCount = 0;
let startTime = Date.now();
let esp32IP = '';

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initialized');
    initializeEventListeners();
    updateSystemInfo();
    setInterval(updateSystemInfo, 1000);
    
    // Check for Web Serial API support
    if ('serial' in navigator) {
        populateSerialPorts();
    } else {
        addLog('Web Serial API not supported in this browser', 'error');
        addLog('Please use Chrome, Edge, or Opera browser', 'warning');
    }
});

// Initialize event listeners
function initializeEventListeners() {
    document.getElementById('connectBtn').addEventListener('click', connectArduino);
    document.getElementById('connectCamBtn').addEventListener('click', connectCamera);
    document.getElementById('captureBtn').addEventListener('click', captureImage);
    document.getElementById('streamBtn').addEventListener('click', toggleStream);
    document.getElementById('clearLogBtn').addEventListener('click', clearLog);
}

// Populate available serial ports
async function populateSerialPorts() {
    try {
        const ports = await navigator.serial.getPorts();
        const select = document.getElementById('serialPort');
        select.innerHTML = '<option value="">Select Arduino Port</option>';
        
        if (ports.length === 0) {
            addLog('No serial ports found. Click Connect to select a port.', 'info');
        }
    } catch (error) {
        console.error('Error getting serial ports:', error);
    }
}

// Connect to Arduino
async function connectArduino() {
    if (!('serial' in navigator)) {
        alert('Web Serial API not supported! Use Chrome/Edge/Opera browser.');
        return;
    }
    
    try {
        addLog('Requesting serial port...', 'info');
        
        // Request port
        const port = await navigator.serial.requestPort();
        await port.open({ baudRate: 9600 });
        
        isConnected = true;
        updateConnectionStatus(true);
        addLog('✓ Connected to Arduino successfully!', 'info');
        
        // Start reading data
        readSerialData(port);
        
    } catch (error) {
        addLog('Failed to connect: ' + error.message, 'error');
        updateConnectionStatus(false);
    }
}

// Read serial data from Arduino
async function readSerialData(port) {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    
    let buffer = '';
    
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            buffer += value;
            
            // Process complete lines
            let lines = buffer.split('\n');
            buffer = lines.pop(); // Keep incomplete line in buffer
            
            for (let line of lines) {
                line = line.trim();
                if (line.length > 0) {
                    processSerialLine(line);
                    addLog(line);
                }
            }
        }
    } catch (error) {
        addLog('Serial read error: ' + error.message, 'error');
    } finally {
        reader.releaseLock();
    }
}

// Process serial data and update dashboard
function processSerialLine(line) {
    // Parse sensor data from Arduino output
    if (line.includes('Soil Moisture:')) {
        const value = parseFloat(line.split(':')[1]);
        updateSensorValue('soilMoisture', value.toFixed(1) + ' %');
        updateProgressBar('moistureBar', value);
    }
    else if (line.includes('Soil Temperature:')) {
        const value = parseFloat(line.split(':')[1]);
        updateSensorValue('soilTemp', value.toFixed(1) + ' °C');
    }
    else if (line.includes('Air Temperature:')) {
        const value = parseFloat(line.split(':')[1]);
        updateSensorValue('airTemp', value.toFixed(1) + ' °C');
    }
    else if (line.includes('Air Humidity:')) {
        const value = parseFloat(line.split(':')[1]);
        updateSensorValue('airHumidity', value.toFixed(1) + ' %');
        updateProgressBar('humidityBar', value);
    }
    else if (line.includes('Light Level:')) {
        const match = line.match(/(\d+)\s*\((\w+)\)/);
        if (match) {
            updateSensorValue('lightLevel', match[1]);
            updateSensorStatus('lightStatus', match[2]);
        }
    }
    else if (line.includes('TDS')) {
        const value = parseFloat(line.split(':')[1]);
        updateSensorValue('tds', value.toFixed(0) + ' ppm');
    }
    else if (line.includes('Runoff Detected:')) {
        const status = line.includes('YES') ? 'YES' : 'NO';
        updateSensorStatus('runoffStatus', status, status === 'YES' ? 'danger' : 'success');
    }
    else if (line.includes('Water Flow Rate:')) {
        const value = parseFloat(line.split(':')[1]);
        updateSensorValue('flowRate', value.toFixed(2) + ' L/min');
    }
    else if (line.includes('PIR Motion:')) {
        const status = line.includes('DETECTED') ? 'DETECTED' : 'None';
        updateSensorStatus('pirStatus', status, status === 'DETECTED' ? 'warning' : 'success');
    }
    else if (line.includes('Ultrasonic Distance:')) {
        const match = line.match(/([\d.]+)\s*cm/);
        if (match) {
            updateSensorValue('distance', match[1] + ' cm');
        } else {
            updateSensorValue('distance', 'Out of range');
        }
    }
    else if (line.includes('INTRUSION CONFIRMED')) {
        showIntrusionAlert(true);
    }
    else if (line.includes('Relay')) {
        const status = line.includes('ON') ? 'ON' : 'OFF';
        updateSensorStatus('pumpStatus', status, status === 'ON' ? 'success' : 'default');
    }
    
    updateCount++;
}

// Connect to ESP32-CAM
function connectCamera() {
    esp32IP = document.getElementById('cameraIP').value.trim();
    
    if (!esp32IP) {
        alert('Please enter ESP32-CAM IP address');
        return;
    }
    
    addLog('Connecting to camera at ' + esp32IP + '...', 'info');
    
    // Test connection by loading a capture
    const testImg = new Image();
    testImg.onload = function() {
        addLog('✓ Camera connected successfully!', 'info');
        document.getElementById('cameraOverlay').style.display = 'none';
    };
    testImg.onerror = function() {
        addLog('Failed to connect to camera. Check IP address.', 'error');
    };
    testImg.src = `http://${esp32IP}/capture?test=${Date.now()}`;
}

// Capture single image
function captureImage() {
    if (!esp32IP) {
        alert('Please connect to camera first');
        return;
    }
    
    const img = document.getElementById('cameraFeed');
    img.src = `http://${esp32IP}/capture?t=${Date.now()}`;
    addLog('📷 Image captured', 'info');
}

// Toggle video stream
function toggleStream() {
    if (!esp32IP) {
        alert('Please connect to camera first');
        return;
    }
    
    isStreaming = !isStreaming;
    const img = document.getElementById('cameraFeed');
    const btn = document.getElementById('streamBtn');
    
    if (isStreaming) {
        img.src = `http://${esp32IP}/stream`;
        btn.textContent = 'Stop Stream';
        btn.style.background = '#e74c3c';
        addLog('📹 Streaming started', 'info');
    } else {
        img.src = '';
        btn.textContent = 'Toggle Stream';
        btn.style.background = '';
        addLog('⏸ Streaming stopped', 'info');
    }
}

// Update sensor value
function updateSensorValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
        element.classList.add('updated');
        setTimeout(() => element.classList.remove('updated'), 300);
    }
}

// Update sensor status
function updateSensorStatus(elementId, status, type = 'default') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = status;
        element.className = 'sensor-status ' + type;
    }
}

// Update progress bar
function updateProgressBar(elementId, percentage) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.width = Math.max(0, Math.min(100, percentage)) + '%';
    }
}

// Show/hide intrusion alert
function showIntrusionAlert(show) {
    const alert = document.getElementById('intrusionAlert');
    if (alert) {
        alert.style.display = show ? 'flex' : 'none';
        if (show) {
            addLog('⚠️ INTRUSION ALERT!', 'error');
        }
    }
}

// Update connection status
function updateConnectionStatus(connected) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    
    if (connected) {
        statusDot.className = 'status-dot online';
        statusText.textContent = 'Connected';
    } else {
        statusDot.className = 'status-dot offline';
        statusText.textContent = 'Disconnected';
    }
}

// Update system information
function updateSystemInfo() {
    // Update timestamp
    const now = new Date();
    document.getElementById('lastUpdate').textContent = now.toLocaleTimeString();
    
    // Update data rate
    const elapsed = (Date.now() - startTime) / 60000; // minutes
    const rate = elapsed > 0 ? (updateCount / elapsed).toFixed(1) : 0;
    document.getElementById('dataRate').textContent = rate + ' updates/min';
    
    // Update uptime
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    document.getElementById('uptime').textContent = formatUptime(uptime);
}

// Format uptime
function formatUptime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
}

// Add log entry to serial monitor
function addLog(message, type = '') {
    const monitor = document.getElementById('serialMonitor');
    const entry = document.createElement('p');
    entry.className = 'log-entry ' + type;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    monitor.appendChild(entry);
    
    // Auto-scroll to bottom
    monitor.scrollTop = monitor.scrollHeight;
    
    // Limit log entries
    if (monitor.children.length > 100) {
        monitor.removeChild(monitor.firstChild);
    }
}

// Clear log
function clearLog() {
    const monitor = document.getElementById('serialMonitor');
    monitor.innerHTML = '<p class="log-entry">Log cleared</p>';
}

// Add CSS animation for updated values
const style = document.createElement('style');
style.textContent = `
    .updated {
        animation: highlight 0.3s ease;
    }
    @keyframes highlight {
        0%, 100% { background: transparent; }
        50% { background: rgba(39, 174, 96, 0.2); }
    }
`;
document.head.appendChild(style);
