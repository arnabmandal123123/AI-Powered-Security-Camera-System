// ESP32-CAM Security System - AI Human Detection Dashboard

// Global variables
let esp32IP = '';
let isStreaming = false;
let detectionEnabled = false;
let alarmArmed = false;
let cocoSsdModel = null;
let alertTriggerObjects = new Set(['person']); // Objects that trigger alarm
let alertBannerTimeout = null;
let audioContext = null;
let sirenOscillator = null;
let sirenGain = null;
let detectionInterval = null;
let startTime = Date.now();
let totalDetections = 0;
let alarmTriggers = 0;
let lastDetectionTime = null;
let fpsCounter = 0;
let fpsStartTime = Date.now();
let snapshots = [];

// Canvas and Image elements
let canvas, ctx, img;

// Detection sensitivity threshold (0.0 to 1.0)
let detectionThreshold = 0.6;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Security System Dashboard Initialized');
    initializeElements();
    initializeEventListeners();
    loadAIModel();
    updateSystemInfo();
    setInterval(updateSystemInfo, 1000);
    setInterval(updateFPS, 1000);
});

// Initialize canvas and image elements
function initializeElements() {
    canvas = document.getElementById('detectionCanvas');
    ctx = canvas.getContext('2d');
    img = document.getElementById('cameraFeed');
    
    // CRITICAL: Enable CORS for cross-origin images
    img.crossOrigin = "anonymous";
    
    // Set canvas size
    canvas.width = 640;
    canvas.height = 480;
}

// Initialize event listeners
function initializeEventListeners() {
    document.getElementById('connectCamBtn').addEventListener('click', connectCamera);
    document.getElementById('streamBtn').addEventListener('click', toggleStream);
    document.getElementById('captureBtn').addEventListener('click', captureImage);
    document.getElementById('toggleDetectionBtn').addEventListener('click', toggleDetection);
    document.getElementById('toggleAlarmBtn').addEventListener('click', toggleAlarm);    
    // Add event listeners for alert checkboxes
    const checkboxes = document.querySelectorAll('.object-checkbox input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateAlertTriggers);
    });
    updateAlertTriggers();    document.getElementById('clearEventsBtn').addEventListener('click', clearEvents);
    document.getElementById('detectionSensitivity').addEventListener('change', updateSensitivity);
}

// Speak alert using text-to-speech
function speakAlert(objectName) {
    try {
        // Stop any ongoing speech
        window.speechSynthesis.cancel();
        
        // Create speech utterance
        const utterance = new SpeechSynthesisUtterance();
        utterance.text = `Alert! ${objectName} detected in room!`;
        utterance.rate = 1.1;  // Slightly faster
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        // Speak
        window.speechSynthesis.speak(utterance);
        
    } catch (e) {
        console.log('Speech synthesis not supported:', e);
    }
}

// Stop speech
function stopSpeech() {
    try {
        window.speechSynthesis.cancel();
    } catch (e) {
        // Already stopped
    }
}

// Load TensorFlow.js COCO-SSD model for object detection
async function loadAIModel() {
    try {
        addEvent('Loading AI detection model...', 'info');
        document.getElementById('aiStatus').textContent = 'Loading...';
        document.getElementById('aiModelStatus').textContent = 'Loading...';
        
        cocoSsdModel = await cocoSsd.load();
        
        addEvent('✓ AI Model loaded successfully! Ready for human detection.', 'success');
        document.getElementById('aiStatus').textContent = 'Ready';
        document.getElementById('aiModelStatus').textContent = 'COCO-SSD Ready';
        console.log('COCO-SSD model loaded');
    } catch (error) {
        addEvent('Failed to load AI model: ' + error.message, 'error');
        document.getElementById('aiStatus').textContent = 'Error';
        document.getElementById('aiModelStatus').textContent = 'Failed';
        console.error('Model loading error:', error);
    }
}
// Show alert banner
function showAlertBanner(objectName) {
    const banner = document.getElementById('alertBanner');
    const alertText = document.getElementById('alertText');
    
    const emoji = getObjectEmoji(objectName);
    alertText.textContent = `${emoji} ${objectName.toUpperCase()} DETECTED IN ROOM!`;
    
    // Only show if not already visible
    if (banner.style.display !== 'block') {
        banner.style.display = 'block';
        
        // Speak the alert
        speakAlert(objectName);
    }
    
    if (alertBannerTimeout) {
        clearTimeout(alertBannerTimeout);
    }
    
    alertBannerTimeout = setTimeout(() => {
        closeAlertBanner();
    }, 10000);
}

// Close alert banner
function closeAlertBanner() {
    const banner = document.getElementById('alertBanner');
    banner.style.display = 'none';
    
    // Stop speech
    stopSpeech();
    
    if (alertBannerTimeout) {
        clearTimeout(alertBannerTimeout);
        alertBannerTimeout = null;
    }
}

// Get emoji for object
function getObjectEmoji(objectName) {
    const emojiMap = {
        'person': '👤',
        'dog': '🐕',
        'cat': '🐈',
        'car': '🚗',
        'truck': '🚚',
        'bicycle': '🚲',
        'motorcycle': '🏍️',
        'backpack': '🎒',
        'cell phone': '📱',
        'laptop': '💻',
        'tv': '📺'
    };
    return emojiMap[objectName] || '⚠️';
}

// Update alert trigger objects
function updateAlertTriggers() {
    const checkboxes = document.querySelectorAll('.object-checkbox input[type="checkbox"]');
    alertTriggerObjects.clear();
    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            alertTriggerObjects.add(checkbox.value);
        }
    });
    const triggers = Array.from(alertTriggerObjects).join(', ');
    addEvent(`Alert triggers updated: ${triggers || 'None'}`, 'info');
}
// Connect to ESP32-CAM
function connectCamera() {
    esp32IP = document.getElementById('cameraIP').value.trim();
    
    if (!esp32IP) {
        alert('Please enter ESP32-CAM IP address');
        return;
    }
    
    addEvent('Camera set to ' + esp32IP + ' - Click Start Stream to begin', 'success');
    document.getElementById('cameraStatus').textContent = 'Ready';
    document.getElementById('cameraOverlay').style.display = 'none';
    updateConnectionStatus(true);
}

// Toggle video stream
function toggleStream() {
    if (!esp32IP) {
        alert('Please connect to camera first');
        return;
    }
    
    isStreaming = !isStreaming;
    const btn = document.getElementById('streamBtn');
    
    if (isStreaming) {
        // Use timestamp to prevent caching
        const streamUrl = `http://${esp32IP}/stream?t=${Date.now()}`;
        img.src = streamUrl;
        
        // Add load event listener
        img.onload = function() {
            addEvent('📹 Stream connected successfully', 'success');
        };
        
        // Add error event listener
        img.onerror = function() {
            addEvent('❌ Stream failed. Check: 1) ESP32 IP correct 2) Same network 3) Use http://localhost:8000', 'error');
            isStreaming = false;
            btn.textContent = '▶️ Start Stream';
            btn.classList.remove('btn-danger');
            btn.classList.add('btn-primary');
        };
        
        btn.textContent = '⏸ Stop Stream';
        btn.classList.add('btn-danger');
        btn.classList.remove('btn-primary');
        addEvent('📹 Streaming started from ' + streamUrl, 'info');
        
        // Start detection if enabled
        if (detectionEnabled && cocoSsdModel) {
            startDetection();
        }
    } else {
        img.src = '';
        img.onload = null;
        img.onerror = null;
        btn.textContent = '▶️ Start Stream';
        btn.classList.remove('btn-danger');
        btn.classList.add('btn-primary');
        addEvent('⏸ Streaming stopped', 'info');
        stopDetection();
    }
}

// Capture single image
function captureImage() {
    if (!esp32IP) {
        alert('Please connect to camera first');
        return;
    }
    
    const timestamp = Date.now();
    img.src = `http://${esp32IP}/capture?t=${timestamp}`;
    addEvent('📷 Image captured', 'info');
}

// Toggle AI detection
function toggleDetection() {
    if (!cocoSsdModel) {
        alert('AI model not loaded yet. Please wait...');
        return;
    }
    
    if (!isStreaming) {
        alert('Please start stream first');
        return;
    }
    
    detectionEnabled = !detectionEnabled;
    const btn = document.getElementById('toggleDetectionBtn');
    
    if (detectionEnabled) {
        btn.textContent = '🤖 Disable AI Detection';
        btn.classList.add('btn-danger');
        btn.classList.remove('btn-success');
        addEvent('🤖 AI Detection enabled', 'success');
        startDetection();
    } else {
        btn.textContent = '🤖 Enable AI Detection';
        btn.classList.remove('btn-danger');
        btn.classList.add('btn-success');
        addEvent('🤖 AI Detection disabled', 'info');
        stopDetection();
    }
}

// Start detection loop
function startDetection() {
    if (detectionInterval) return;
    
    detectionInterval = setInterval(async () => {
        if (!isStreaming || !detectionEnabled) {
            stopDetection();
            return;
        }
        
        await detectObjects();
    }, 500); // Run detection every 500ms
}

// Stop detection loop
function stopDetection() {
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }
    // Switch back to showing img directly
    canvas.style.display = 'none';
    img.style.display = 'block';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// Detect objects using TensorFlow.js COCO-SSD
async function detectObjects() {
    try {
        if (!img.complete || img.naturalWidth === 0) {
            return;
        }
        
        // Make canvas visible and match img size
        if (canvas.style.display === 'none') {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.style.display = 'block';
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            img.style.display = 'none';
        }
        
        // Draw image to canvas
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Detect objects
        const predictions = await cocoSsdModel.detect(canvas);
        
        // Filter for humans (person class)
        const humans = predictions.filter(pred => 
            pred.class === 'person' && pred.score >= detectionThreshold
        );
        
        // Draw bounding boxes
        drawPredictions(predictions);
        
        // Update detection count
        let detectedObjects = predictions.map(p => p.class).join(', ') || 'None';
        document.getElementById('detectedObjects').textContent = detectedObjects;
        
        // Check for alert trigger objects
        const detectedTriggers = predictions.filter(p => alertTriggerObjects.has(p.class));
        
        if (detectedTriggers.length > 0) {
            // Get unique trigger objects
            const uniqueTriggers = [...new Set(detectedTriggers.map(p => p.class))];
            
            // Always show banner for detected triggers
            uniqueTriggers.forEach(objectName => {
                showAlertBanner(objectName);
                addEvent(`🚨 ALERT! ${objectName.toUpperCase()} detected!`, 'error');
            });
            
            // Capture snapshot of detected objects
            captureSnapshot();
            
            // Only trigger ESP32 alarm if system is armed
            if (alarmArmed) {
                triggerAlarm(detectedTriggers.length);
            }
        }
        
        // Handle human detection for statistics
        if (humans.length > 0) {
            handleHumanDetection(humans);
        }
        
        // Update FPS
        fpsCounter++;
        
    } catch (error) {
        console.error('Detection error:', error);
    }
}

// Draw prediction bounding boxes on canvas
function drawPredictions(predictions) {
    predictions.forEach(pred => {
        const [x, y, width, height] = pred.bbox;
        
        // Choose color based on object type
        const isHuman = pred.class === 'person';
        ctx.strokeStyle = isHuman ? '#ff0000' : '#00ff00';
        ctx.lineWidth = isHuman ? 4 : 2;
        ctx.strokeRect(x, y, width, height);
        
        // Draw label background
        ctx.fillStyle = isHuman ? '#ff0000' : '#00ff00';
        const label = `${pred.class} ${Math.round(pred.score * 100)}%`;
        const textWidth = ctx.measureText(label).width;
        ctx.fillRect(x, y - 25, textWidth + 10, 25);
        
        // Draw label text
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Arial';
        ctx.fillText(label, x + 5, y - 7);
    });
}

// Handle human detection event
function handleHumanDetection(humans) {
    const now = Date.now();
    
    // Throttle detections (minimum 2 seconds between events)
    if (lastDetectionTime && (now - lastDetectionTime) < 2000) {
        return;
    }
    
    lastDetectionTime = now;
    totalDetections++;
    
    const humanCount = humans.length;
    const confidences = humans.map(h => Math.round(h.score * 100));
    
    addEvent(`👤 HUMAN DETECTED! Count: ${humanCount}, Confidence: ${confidences.join(', ')}%`, 'warning');
    
    // Update statistics
    document.getElementById('totalDetections').textContent = totalDetections;
    document.getElementById('lastDetection').textContent = new Date().toLocaleTimeString();
    document.getElementById('eventsCount').textContent = totalDetections;
    document.getElementById('detectionStatus').textContent = `${humanCount} Human(s)`;
    
    // Capture snapshot
    captureSnapshot();
    
    // Notify ESP32-CAM about detection
    notifyMotionDetection();
    
    // Trigger alarm if armed
    if (alarmArmed) {
        triggerAlarm(humanCount);
    }
}

// Notify ESP32-CAM about motion detection
function notifyMotionDetection() {
    if (!esp32IP) return;
    
    fetch(`http://${esp32IP}/motion`, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(() => console.log('Motion notified'))
    .catch(() => {})  // Silently ignore - endpoint not critical
}

// Trigger alarm
function triggerAlarm(humanCount) {
    alarmTriggers++;
    document.getElementById('alarmTriggers').textContent = alarmTriggers;
    
    addEvent(`🚨 ALARM TRIGGERED! ${humanCount} human(s) detected!`, 'alarm');
    
    // Play alarm sound
    const alarmSound = document.getElementById('alarmSound');
    alarmSound.play().catch(e => console.log('Audio play prevented'));
    
    // Flash alarm status
    flashAlarmStatus();
    
    // Auto-stop alarm after 10 seconds
    setTimeout(() => {
        alarmSound.pause();
        alarmSound.currentTime = 0;
    }, 10000);
}

// Flash alarm status indicator
function flashAlarmStatus() {
    const statusBar = document.getElementById('securityStatusBar');
    let flashCount = 0;
    const flashInterval = setInterval(() => {
        statusBar.style.background = flashCount % 2 === 0 ? '#e74c3c' : '';
        flashCount++;
        if (flashCount > 10) {
            clearInterval(flashInterval);
            statusBar.style.background = '';
        }
    }, 300);
}

// Capture snapshot
function captureSnapshot() {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const timestamp = new Date().toLocaleString();
    
    snapshots.unshift({ dataUrl, timestamp });
    
    // Keep only last 10 snapshots
    if (snapshots.length > 10) {
        snapshots = snapshots.slice(0, 10);
    }
    
    displaySnapshots();
}

// Display snapshots in UI
function displaySnapshots() {
    const container = document.getElementById('snapshotsContainer');
    
    if (snapshots.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No snapshots yet. Snapshots are automatically captured when humans are detected.</p>';
        return;
    }
    
    container.innerHTML = snapshots.map((snap, index) => `
        <div class="snapshot-item">
            <img src="${snap.dataUrl}" alt="Snapshot ${index + 1}">
            <div class="snapshot-info">
                <span class="snapshot-time">${snap.timestamp}</span>
                <button onclick="downloadSnapshot(${index})" class="btn-small">Download</button>
            </div>
        </div>
    `).join('');
}

// Download snapshot
function downloadSnapshot(index) {
    const snap = snapshots[index];
    const link = document.createElement('a');
    link.href = snap.dataUrl;
    link.download = `security_snapshot_${snap.timestamp.replace(/[/:, ]/g, '_')}.jpg`;
    link.click();
}

// Toggle alarm armed state
function toggleAlarm() {
    if (!esp32IP) {
        alert('Please connect to camera first');
        return;
    }
    
    fetch(`http://${esp32IP}/alarm/toggle`)
        .then(response => response.json())
        .then(data => {
            alarmArmed = data.armed;
            updateAlarmUI();
            addEvent(alarmArmed ? '🔒 ALARM ARMED' : '🔓 ALARM DISARMED', alarmArmed ? 'warning' : 'info');
        })
        .catch(error => {
            addEvent('Failed to toggle alarm: ' + error.message, 'error');
        });
}

// Update alarm UI
function updateAlarmUI() {
    const btn = document.getElementById('toggleAlarmBtn');
    const statusValue = document.getElementById('alarmStatus');
    
    if (alarmArmed) {
        btn.textContent = '🔓 Disarm Alarm';
        btn.classList.remove('btn-danger');
        btn.classList.add('btn-warning');
        statusValue.textContent = 'ARMED';
        statusValue.style.color = '#e74c3c';
    } else {
        btn.textContent = '🚨 Arm Alarm';
        btn.classList.add('btn-danger');
        btn.classList.remove('btn-warning');
        statusValue.textContent = 'DISARMED';
        statusValue.style.color = '#95a5a6';
    }
}

// Update detection sensitivity
function updateSensitivity() {
    detectionThreshold = parseFloat(document.getElementById('detectionSensitivity').value);
    addEvent(`Detection sensitivity updated to ${Math.round((1 - detectionThreshold) * 100)}%`, 'info');
}

// Update FPS display
function updateFPS() {
    const elapsed = (Date.now() - fpsStartTime) / 1000;
    const fps = elapsed > 0 ? Math.round(fpsCounter / elapsed) : 0;
    document.getElementById('fpsDisplay').textContent = fps;
    
    // Reset counters every 5 seconds
    if (elapsed > 5) {
        fpsCounter = 0;
        fpsStartTime = Date.now();
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
    const now = new Date();
    document.getElementById('lastUpdate').textContent = now.toLocaleTimeString();
    
    // Update uptime
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    document.getElementById('systemUptime').textContent = formatUptime(uptime);
}

// Format uptime
function formatUptime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
}

// Add event to security log
function addEvent(message, type = 'info') {
    const log = document.getElementById('eventsLog');
    const entry = document.createElement('p');
    entry.className = 'log-entry ' + type;
    
    const timestamp = new Date().toLocaleTimeString();
    entry.textContent = `[${timestamp}] ${message}`;
    
    log.insertBefore(entry, log.firstChild);
    
    // Limit log entries
    if (log.children.length > 50) {
        log.removeChild(log.lastChild);
    }
    
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// Clear events log
function clearEvents() {
    const log = document.getElementById('eventsLog');
    log.innerHTML = '<p class="log-entry info">Events log cleared</p>';
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
