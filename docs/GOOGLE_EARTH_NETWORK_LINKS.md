# Google Earth Network Links

This project includes Google Earth Network Link files that allow you to load KML data directly from your piBoom server into Google Earth.

## What are Network Links?

Network Links are special KML files that reference other KML files via URL. When you open a network link file in Google Earth:
- It automatically fetches the data from your server
- It can refresh periodically to get updated data
- You don't need to manually download and re-import files when data changes

## Available Network Links

All network link files are located in the `data/` directory:

1. **Bob Dylan - Highway 61**: `bob-dylan-highway-61.networklink.kml`
2. **Taylor Swift Timeline**: `taylor-swift-timeline.networklink.kml`
3. **Grateful Dead Tour**: `grateful-dead-tour.networklink.kml`
4. **Grateful Dead - Endless Tour**: `grateful-dead-endless-tour.networklink.kml`
5. **Legendary Music Venues**: `legendary-music-venues.networklink.kml`
6. **Blues History**: `blues-history.networklink.kml`

## How to Use

### From the Web Interface

1. Open your browser and go to `http://localhost:3000/music/kml-viewer.html`
2. Scroll to the "Open in Google Earth Desktop" section
3. Under "Network Links (Auto-updating)", click any timeline button to download the network link file
4. Open the downloaded `.networklink.kml` file in Google Earth

### Direct File Access

1. Navigate to your piBoom `data/` directory
2. Double-click any `.networklink.kml` file
3. It will open in Google Earth and load the data from your server

### Important Notes

- **Your server must be running** for network links to work
- Network links are configured to refresh every hour (3600 seconds)
- If you're accessing from a different computer on your network, you'll need to:
  1. Edit the network link file
  2. Replace `localhost` with your Pi's IP address (e.g., `192.168.1.100`)

## Customizing Network Links

Each network link file contains these key settings:

```xml
<refreshMode>onInterval</refreshMode>
<refreshInterval>3600</refreshInterval>  <!-- Refresh every hour -->
```

You can customize:
- **refreshMode**: `onInterval` (refresh on schedule) or `onExpire` (refresh when server says)
- **refreshInterval**: Number of seconds between refreshes (default: 3600 = 1 hour)

## For Raspberry Pi Deployment

When deploying to your Raspberry Pi, remember to update the network link URLs:

1. Open each `.networklink.kml` file in a text editor
2. Find the `<href>` line:
   ```xml
   <href>http://localhost:3000/data/grateful-dead-tour.kml</href>
   ```
3. Replace `localhost:3000` with your Pi's IP or hostname:
   ```xml
   <href>http://raspberrypi.local:3000/data/grateful-dead-tour.kml</href>
   ```
   or
   ```xml
   <href>http://192.168.1.100:3000/data/grateful-dead-tour.kml</href>
   ```

## Troubleshooting

**Network link not loading in Google Earth:**
- Make sure your piBoom server is running
- Check that you can access the KML file directly in a browser (e.g., `http://localhost:3000/data/grateful-dead-tour.kml`)
- Verify the URL in the network link file is correct

**Data not updating:**
- Network links refresh based on the interval setting
- To force a refresh in Google Earth: Right-click the network link → Refresh

**Accessing from another computer:**
- Replace `localhost` with your server's IP address in all network link files
- Make sure your firewall allows incoming connections on port 3000

