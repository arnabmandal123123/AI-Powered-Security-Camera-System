# ESP32-CAM Wiring & Hardware Setup Guide

## 📌 ESP32-CAM Pinout Reference

```
                    ESP32-CAM (Top View)
                    ┌─────────────────┐
                    │   ╔═══════╗     │
                    │   ║ CAMERA║     │
                    │   ╚═══════╝     │
                    │                 │
    ANT Connector → │ ●               │
                    │                 │
    3.3V ──────────►│ ●●              │
    GND ───────────►│ ●●              │
    U0T (TX) ──────►│ ●●              │
    U0R (RX) ──────►│ ●●              │
    GPIO 0 ────────►│ ●●              │
    GND ───────────►│ ●●              │
    VCC (5V) ──────►│ ●●              │
    GPIO 2 ────────►│ ●●              │
    GPIO 4 (LED) ──►│ ●●              │
    GPIO 12 ───────►│ ●●              │
    GPIO 13 ───────►│ ●●              │
    GPIO 14 ───────►│ ●●              │
    GPIO 15 ───────►│ ●●              │
    GPIO 16 ───────►│ ●●              │
    SD Card Slot ──►│ [____________]  │
                    └─────────────────┘
```

## 🔌 Connection Diagrams

### 1. Programming Setup (USB-to-Serial Adapter)

```
ESP32-CAM              FTDI/CP2102           Computer
┌─────────┐           ┌──────────┐          ┌─────────┐
│         │           │          │          │         │
│ 5V   ●──┼──────────►│ 5V       │          │         │
│         │           │          │          │         │
│ GND  ●──┼──────────►│ GND      │          │         │
│         │           │          │          │         │
│ U0R  ●──┼──────────►│ TX       │          │         │
│         │           │          │          │         │
│ U0T  ●──┼──────────►│ RX       │          │         │
│         │           │          │          │   USB   │
│ IO0  ●──┼───[GND]   │          │◄─────────┤   Port  │
│         │ (flash    │   USB ●──┼──────────►│         │
│         │  mode)    │          │          │         │
│         │           │          │          │         │
└─────────┘           └──────────┘          └─────────┘

IMPORTANT: Connect GPIO 0 to GND ONLY when uploading code!
Disconnect after upload and press RESET button.
```

### 2. Standalone Operation (Power Only)

```
ESP32-CAM              Power Supply
┌─────────┐           ┌──────────┐
│         │           │          │
│ 5V   ●──┼──────────►│ 5V OUT   │
│         │           │  (2A+)   │
│ GND  ●──┼──────────►│ GND      │
│         │           │          │
│ IO0  ●  │ [Float]   │          │
│         │ (do NOT   │  AC IN   │
│         │  ground)  │          │
└─────────┘           └──────────┘

CRITICAL: Use 5V/2A or higher power supply!
         Low power causes camera init failures.
```

### 3. Full Security System with Optional Components

```
ESP32-CAM
┌──────────────┐
│              │
│ 5V      ●────┼────► Power Supply 5V (2A+)
│              │
│ GND     ●────┼────► Common Ground ──┐
│              │                       │
│ GPIO 4  ●────┼──┐  Built-in LED     │
│    (LED)     │  └──[220Ω]──[LED+]─[GND]
│              │
│ GPIO 12 ●────┼────► Buzzer (+) ─┐
│              │      (Optional)  │
│ GPIO 13 ●────┼────► PIR Sensor  │
│              │      (Optional)  │
│ GPIO 14 ●────┼────► Relay       │
│              │      (Optional)  │
│              │                  │
│ GND     ●────┼──────────────────┴──► Common GND
│              │
│ SD Card ●────┼──► MicroSD Card (Optional)
│              │     (for recording)
└──────────────┘

Legend:
● = Pin/Connector
─ = Wire
[ ] = Component
```

## 🔊 Optional Buzzer Connection

### Passive Buzzer (Recommended)
```
ESP32-CAM          Passive Buzzer
┌─────────┐        ┌──────────┐
│         │        │          │
│ GPIO 12 ●───────►│ + (Red)  │
│         │        │          │
│ GND     ●───────►│ - (Black)│
└─────────┘        └──────────┘

Code Required:
#define BUZZER_PIN 12
pinMode(BUZZER_PIN, OUTPUT);
tone(BUZZER_PIN, 2000, 500); // 2kHz for 500ms
```

### Active Buzzer
```
ESP32-CAM          Active Buzzer       NPN Transistor
┌─────────┐        ┌──────────┐        (2N2222/BC547)
│         │        │          │        ┌───────┐
│ GPIO 12 ●───[1kΩ]────────────────────┤ Base  │
│         │        │          │        │       │
│ GND     ●───────►│ -  GND   │        │ Emit. ●───► GND
│         │        │          │    ┌───┤ Coll. │
│ 5V      ●────────┤          │    │   └───────┘
│         │        │ +  VCC ●─┴────┘
└─────────┘        └──────────┘

Use transistor for buzzer > 20mA draw
```

## 💡 LED Connections

### Built-in Flash LED (GPIO 4)
```
Already connected on board!
No external wiring needed.

Control:
pinMode(4, OUTPUT);
digitalWrite(4, HIGH);  // LED ON
digitalWrite(4, LOW);   // LED OFF
```

### External Status LED (Optional)
```
ESP32-CAM          LED             Resistor
┌─────────┐        ┌─┐             [220Ω]
│         │        │+│                │
│ GPIO 2  ●───────►├─┤────►──────────┤
│         │        │-│               │
│ GND     ●────────┴─┴───────────────┘

Code:
#define STATUS_LED 2
pinMode(STATUS_LED, OUTPUT);
```

## 📡 External Antenna (Optional)

```
ESP32-CAM (with U.FL connector)
┌─────────────────┐
│   ● U.FL Conn.  │──► External Antenna
│                 │     (2.4GHz, 3-5dBi)
│   ╔═══════╗     │
│   ║CAMERA ║     │     OR
│   ╚═══════╝     │
│                 │──► PCB Antenna (onboard)
│   [Resistor]    │     (solder bridge selection)
└─────────────────┘

Benefits of External Antenna:
✓ Better WiFi range (2-3x)
✓ More stable connection
✓ Penetrates walls better
```

## 🔋 Power Supply Options

### Option 1: USB Power (Simple)
```
USB Adapter (5V/2A) → Micro USB Cable → FTDI Adapter → ESP32-CAM
                                              │
                                              └─► 5V & GND pins

Pros: Easy, portable
Cons: Needs adapter board
```

### Option 2: Direct 5V Supply (Recommended)
```
Wall Adapter → DC Jack → ESP32-CAM
(5V/2-3A)                (5V & GND pins)

Pros: Stable, reliable, standalone
Cons: Need to solder/crimp wires
```

### Option 3: Battery Power (Mobile)
```
4x AA Batteries (6V) → LM7805 Regulator → ESP32-CAM
                              │
                       ┌──────┴──────┐
                       │  IN  REG OUT│
                       │  [LM7805]   │
                       │ GND      GND│
                       └─────────────┘
                       
Pros: Portable, no wires
Cons: Limited runtime (2-4 hours)
```

### Option 4: Solar Power (Outdoor)
```
Solar Panel (6V/5W) → Charge Controller → LiPo Battery → ESP32-CAM
                                                │
                                         [Power Bank]
                                         
Pros: Continuous outdoor use
Cons: Complex, weather dependent
```

## ⚠️ Critical Power Requirements

```
Component         Current Draw    Notes
─────────────────────────────────────────────
ESP32 Idle        80-100 mA      Normal operation
ESP32 WiFi TX     170-240 mA     During transmission
Camera Active     120-150 mA     Capturing frames
Total Peak        ~400 mA        All components active
Recommended PSU   2000 mA (2A)   Safety margin
─────────────────────────────────────────────

⚠️ INSUFFICIENT POWER = BROWNOUTS & FAILURES!
```

## 🛡️ Protection Circuits

### Basic Protection (Recommended)
```
Power Supply (+5V) ──►[Fuse 1A]──►[Capacitor 100µF]──► ESP32-CAM 5V
                                          │
                                          │
Ground ────────────────────────────────────┴──────────► ESP32-CAM GND

Components:
- Fuse: Protects from overcurrent
- Capacitor: Smooths power fluctuations
```

### Advanced Protection
```
                    ┌─[Diode]─┐
Power Supply ───────┤         ├──► [Capacitor 100µF] ──► ESP32-CAM
(5V/2A)            │         │           │
                   │ [Fuse   │           │
                   │  1-2A]  │          [│] 10µF (ceramic)
                   │         │           │
GND ───────────────┴─────────┴───────────┴──► ESP32-CAM GND

Diode: Reverse polarity protection (1N4007)
Fuses: Overcurrent protection
Caps: Filter noise and smooth power
```

## 📦 Enclosure & Mounting

### Weatherproof Outdoor Setup
```
┌────────────────────────────┐
│  Waterproof Junction Box   │
│  ┌──────────────────────┐  │
│  │  ESP32-CAM Module    │  │
│  │  ┌────────┐          │  │
│  │  │Camera  │◄─────────┼──┼─► Glass/Acrylic Window
│  │  └────────┘          │  │
│  │                      │  │
│  │  [Power Supply 5V]   │  │
│  │         │            │  │
│  └─────────┼────────────┘  │
│            │               │
│     Cable Gland ◄──────────┼─► Power Cable Entry
└────────────────────────────┘

Materials Needed:
- IP65+ waterproof box
- Silicone sealant
- Cable glands
- Mounting bracket
```

### Indoor Compact Setup
```
┌─────────────┐
│ 3D Printed  │
│  Case       │
│   ┌───┐     │
│   │CAM│◄────┼── Clear Lens Cover
│   └───┘     │
│   [ESP32]   │
│   [USB]     │
└──────┬──────┘
       │
    USB Cable
```

## 🔧 Tools Required

### Basic Setup
- [ ] Soldering iron (if soldering headers)
- [ ] Wire strippers
- [ ] Multimeter
- [ ] Small screwdrivers
- [ ] USB cable

### Advanced Setup
- [ ] Crimping tool
- [ ] Heat shrink tubing
- [ ] Wire cutters
- [ ] Label maker
- [ ] Cable tester

## ✅ Pre-Flight Checklist

Before powering on:
- [ ] All connections secured
- [ ] Polarity correct (5V/GND)
- [ ] GPIO 0 NOT grounded (unless flashing)
- [ ] Camera ribbon cable seated properly
- [ ] No short circuits (multimeter check)
- [ ] Power supply rated 2A minimum
- [ ] Antenna connected (if using external)
- [ ] SD card inserted (if using)

## 🆘 Troubleshooting Hardware

| Problem | Check | Solution |
|---------|-------|----------|
| Won't power on | No LED | Check power connections, try different supply |
| Camera init fails | Ribbon cable | Reseat camera connector, check for damage |
| WiFi weak | Antenna | Use external antenna, move closer to router |
| Frequent resets | Power | Upgrade to 2A+ power supply, add capacitor |
| Hot to touch | Overheating | Improve ventilation, reduce quality/FPS |
| SD card error | Card format | Format as FAT32, use Class 10 card |

## 📐 Mounting Angles

### Optimal Camera Placement
```
        Ceiling Mount (Recommended)
              ╔═══╗
              ║CAM║
              ╚═╤═╝
                │
               ╱│╲  15-30° angle
              ╱ │ ╲
             ╱  │  ╲
            ╱   │   ╲
           ╱    │    ╲
          ╱     │     ╲
         ╱      │      ╲
     ───────────┴───────────  Floor
         Viewing Area
         (3-5 meters)
```

### Coverage Patterns
```
Wide Angle (120°):        Narrow (60°):
      │                       │
     ╱│╲                     ╱│╲
    ╱ │ ╲                   ╱ │ ╲
   ╱  │  ╲                 │  │  │
  ╱   │   ╲                │  │  │
 ╱    │    ╲               │  │  │
──────────────            ────────
Close range, wide         Far range, focused
```

## 🌡️ Environmental Considerations

### Operating Conditions
```
Parameter           Min    Optimal    Max
─────────────────────────────────────────
Temperature        -20°C    25°C     60°C
Humidity            10%     50%      90%
Altitude            0m      0m      2000m

⚠️ Condensation = Camera Damage!
Use desiccant packs in outdoor enclosures.
```

## 💾 SD Card (Optional Local Recording)

### Pin Connections
```
ESP32-CAM           MicroSD Card
┌─────────┐         ┌──────────┐
│ GPIO 2  ●────────►│ DATA 0   │
│ GPIO 14 ●────────►│ CLK      │
│ GPIO 15 ●────────►│ CMD      │
│ 3.3V    ●────────►│ VDD      │
│ GND     ●────────►│ VSS      │
└─────────┘         └──────────┘

Card Requirements:
- Format: FAT32
- Class: 10 or UHS-I
- Size: Up to 32GB
```

---

**Hardware Setup Guide v1.0**  
Last Updated: January 2026

⚡ Remember: Proper power = reliable operation!
