# Disaster mood music tracks

Place ambient MP3 files here for the **Disaster Processor Expert** AI chat panel.
When you open the floating AI chat on disaster dashboards, the app picks a track
based on the selected disaster type/source.

## Required filenames

| File | Used for |
|------|----------|
| `fire.mp3` | NASA FIRMS, ALERTCalifornia, fire/wildfire events |
| `flood.mp3` | Flood zones, flooding declarations |
| `hurricane.mp3` | NHC hurricanes and tropical storms |
| `earthquake.mp3` | USGS earthquakes |
| `storm.mp3` | NWS severe weather, tornadoes, winter storms |
| `default.mp3` | FEMA/other or when no disaster is selected |

## Setup

1. Add your MP3 files to this folder (`music/disasters/`).
2. Restart the server if it is already running.
3. Open a disaster page, select a disaster (optional), then open the **Disaster Processor Expert** chat.

Music plays only when the AI chat panel opens—not on grid/marker selection alone.

## Mute

Use the music icon in the AI chat header, or set `localStorage` key `dc_disaster_music_muted` to `1`.

## Streaming

Files are served at `/api/audio/stream/disasters%2F<filename>.mp3` from your configured `MUSIC_DIR` (default: project `music/` folder).
