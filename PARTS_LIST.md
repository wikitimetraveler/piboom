# BOOM Project - Raspberry Pi 5 Audio System Parts List

## Core Components
- **Raspberry Pi 5** (CanaKit bundle)
  - 5V/5A PSU
  - 32GB+ microSD card (Class 10)
  - Case/enclosure
  - Cooling solution (recommended for Pi 5)

## Display & Input
- **SunFounder 7" touchscreen** - Primary interface
- **iClever BK09 foldable Bluetooth keyboard** - Wireless input with touchpad

## Audio Chain
- **HifiMe UAE23HD USB Type-C DAC**
  - Sabre ES9018 + SA9023 chipset
  - High-quality digital-to-analog conversion
- **Fosi Audio BT10A Bluetooth 5.0 Stereo Amplifier**
  - TPA3116D2 chip (50W × 2)
  - Bluetooth connectivity for wireless audio
- **Micca MB42 passive speakers** (pair)
  - Bookshelf speakers for quality audio output

## Cables & Wiring
- **Anker PowerLine+ USB-C to USB-A cable** (3 ft)
  - DAC connection to Pi
- **Amazon Basics RCA stereo audio cable** (4 ft)
  - DAC to amplifier connection
- **14 AWG OFC speaker wire** (roll)
  - Amplifier to speakers

## Software Requirements
- **Node.js** (v18+ recommended)
- **mpg123** (for Pi mode audio playback)
- **ALSA utilities** (audio system tools)

## Setup Notes
- DAC connects via USB-C to Pi
- Amplifier receives audio via RCA from DAC
- Speakers connect to amplifier via speaker wire
- Touchscreen provides primary user interface
- Bluetooth keyboard for wireless control

## Power Considerations
- Pi 5: 5V/5A minimum (CanaKit PSU)
- Amplifier: Check power requirements
- Total system power draw: ~25-30W typical

