# 🎵 BOOM Box - Parts List & Hardware Setup

Complete hardware and software components for the voice-controlled BOOM box audio system.

## 🖥️ Core Computing

- **Raspberry Pi 5** - Main computing unit (4GB or 8GB RAM recommended)
- **MicroSD Card** - 32GB+ Class 10 for OS and music storage
- **Power Supply** - 5V/3A USB-C power adapter for Pi 5

## 🎵 Audio Chain

### Speakers & Amplification
- **Micca MB42 Passive Speakers** - High-quality bookshelf speakers
- **Fosi Audio BT10A Amplifier** - 50W Class D amplifier with Bluetooth
- **Speaker Wire** - 16-gauge oxygen-free copper wire
- **RCA Cables** - For Pi to amplifier connection

### Audio Interface
- **USB Audio Interface** (optional) - For higher quality audio output
- **3.5mm to RCA Adapter** - If using Pi's built-in audio output

## 🎤 Voice Control Hardware

### Microphone
- **USB Microphone** - For voice command input on Pi
- **3.5mm Microphone** - Alternative using Pi's audio input
- **Microphone Stand** - Adjustable positioning for optimal pickup

### Audio Processing
- **Hifime UAE23HD USB Type C DAC** (Sabre ES9018 + SA9023) - High-quality digital-to-analog conversion for superior audio output
- Audio interface for Raspberry Pi
- Volume control system

## 📱 Display & Interface

### Primary Display
- **7" Raspberry Pi Touchscreen** - Official Pi touch display
- **HDMI Monitor** - Alternative display option
- **Touchscreen Case** - Protective enclosure for display

### Control Interface
- **Physical Buttons** (optional) - Hardware play/pause/volume controls
- **Rotary Encoder** (optional) - Volume control knob
- **LED Indicators** - Status lights for power, audio, voice

## 🔌 Connectivity & Power

### Network
- **WiFi 6** - Built into Pi 5 for wireless access
- **Ethernet Cable** - Wired network connection (optional)
- **USB WiFi Adapter** - If using older Pi model

### Power Management
- **UPS Battery Backup** (optional) - Uninterruptible power supply
- **Power Strip** - Surge protection for all components
- **Extension Cables** - For flexible component placement

## 🏗️ Enclosure & Mounting

### Main Enclosure
- **Custom Wooden Case** - Handcrafted by Steven Wedekind
- **Ventilation** - Cooling vents for Pi and amplifier
- **Cable Management** - Internal routing and organization

### Mounting Hardware
- **Speaker Mounts** - Wall or shelf mounting brackets
- **Pi Mounting Plate** - Secure Pi installation
- **Amplifier Mounting** - Stable amplifier positioning

## 📦 Software & Dependencies

### Operating System
- **Raspberry Pi OS** - Latest 64-bit version
- **Node.js 18+** - JavaScript runtime
- **npm** - Package manager

### System Dependencies
```bash
# Audio processing tools
sudo apt install sox espeak-ng alsa-utils

# Audio playback
sudo apt install mpg123

# Volume control
sudo apt install alsa-utils
```

### Node.js Packages
```json
{
  "express": "^4.19.2",
  "play-sound": "^1.1.6",
  "socket.io": "^4.7.5",
  "say": "^0.16.0"
}
```

## 🔧 Setup & Configuration

### Initial Setup
1. **Flash Pi OS** to microSD card
2. **Enable SSH** and **WiFi** during first boot
3. **Update system**: `sudo apt update && sudo apt upgrade`
4. **Install Node.js**: Use NodeSource repository for latest version

### Audio Configuration
1. **Configure ALSA**: Set default audio output
2. **Test audio**: Verify speakers and amplifier work
3. **Calibrate volume**: Set appropriate levels
4. **Test microphone**: Ensure voice input works

### Voice Control Setup
1. **Install dependencies**: Audio processing tools
2. **Test microphone**: Check input levels and quality
3. **Configure recognition**: Adjust sensitivity and language
4. **Test commands**: Verify all voice commands work

## 📊 Power Requirements

### Total System Power
- **Raspberry Pi 5**: 5V/3A (15W)
- **Amplifier**: 12V/2A (24W)
- **Display**: 5V/1A (5W)
- **Total**: ~44W maximum

### Power Supply Recommendations
- **Main Power**: 12V/5A power supply for amplifier
- **Pi Power**: Dedicated 5V/3A USB-C supply
- **Backup**: UPS for critical operation

## 🎯 Performance Considerations

### Audio Quality
- **Sample Rate**: 44.1kHz minimum, 48kHz recommended
- **Bit Depth**: 16-bit minimum, 24-bit for high quality
- **Latency**: <50ms for voice control responsiveness

### Voice Recognition
- **Microphone Quality**: Condenser or dynamic with good pickup
- **Noise Reduction**: Minimize background noise
- **Distance**: Optimal 1-3 feet from microphone

## 🔍 Troubleshooting

### Common Issues
- **No Audio**: Check amplifier power and connections
- **Poor Voice Recognition**: Adjust microphone position and gain
- **Network Issues**: Verify WiFi/Ethernet configuration
- **Power Problems**: Ensure adequate power supply capacity

### Testing Procedures
1. **Audio Test**: Play test tone through speakers
2. **Voice Test**: Say "help" and verify response
3. **Network Test**: Access from other devices
4. **Stress Test**: Continuous playback and voice commands

## 📝 Maintenance

### Regular Tasks
- **Clean Microphone**: Remove dust and debris
- **Check Connections**: Ensure all cables are secure
- **Update Software**: Keep system and packages current
- **Monitor Performance**: Check for audio quality degradation

### Long-term Care
- **Speaker Break-in**: Allow speakers to settle (100+ hours)
- **Component Inspection**: Check for wear and damage
- **Backup Configuration**: Save settings and customizations

---

**🎵 Ready to build your voice-controlled BOOM box? This parts list covers everything you need!** 🛠️✨

