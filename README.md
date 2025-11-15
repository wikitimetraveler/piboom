# 🎵 Pi BOOM - Multi-Domain Platform

A comprehensive multi-domain platform featuring **music research**, **mortgage loan pipeline management**, **disaster risk assessment**, and **AI-powered assistants**. Originally designed for Raspberry Pi with voice activation, now expanded to support web-based mortgage operations and disaster monitoring.

**🔥 Multi-API Mashup Architecture**: This system intelligently combines multiple APIs and data sources to create unified, comprehensive experiences across music, finance, and disaster monitoring domains.

## 🎯 Core Domains

### 🎵 Music Research Domain
- **🎤 Voice-Activated Music Research**: "Search Pink Floyd", "Tell me about Tool", "Who is Maynard?"
- **🎵 Audio Fingerprinting (Shazam Clone)**: "What song is this?" - Identify any song playing around you!
- **🤖 ChatGPT AI Integration**: Ask anything about music - "Ask what makes Pink Floyd unique", "Recommend progressive metal"
- **🗺️ Interactive Artist Maps**: Visualize band member birth places and musical journeys
- **📊 Comprehensive Timelines**: Chronological artist and band history
- **🎬 YouTube Integration**: Discover and play related music videos
- **🔍 Multi-Source Research**: Google Knowledge Graph, Wikipedia, MusicBrainz, and YouTube APIs

### 🏦 Finance & Mortgage Domain
- **📋 Loan Pipeline Management**: Complete CRUD operations for mortgage loans
- **🌍 Disaster Risk Assessment**: Real-time FEMA disaster data integration for loan properties
- **🎯 Risk Scoring Algorithm**: Automated risk calculation based on disaster history and flood zones
- **🗺️ Geographic Risk Visualization**: Interactive maps showing loan locations and disaster proximity
- **📊 Portfolio Analytics**: Loan portfolio risk analysis and reporting
- **🤖 AI Mortgage Assistant**: LangChain-powered AI assistant for mortgage operations and risk analysis
- **📈 Pipeline Efficiency Analysis**: Cycle time tracking, milestone optimization, bottleneck identification
- **🏢 Channel Management**: Correspondent and Retail lending channel support

### 🌪️ Disaster Monitoring Domain
- **📡 Real-Time Disaster Tracking**: 90-day rolling window of FEMA disaster declarations
- **🔥 Multi-Source Disaster Data**: FEMA, NASA FIRMS, USGS, NOAA/NWS, NHC, GDACS integration
- **📹 Live Camera Feeds**: ALERTCalifornia fire camera network with real-time video streaming
- **🗺️ Interactive Disaster Maps**: Google Maps integration with disaster markers and heat maps
- **🌊 Flood Zone Analysis**: FEMA NFHL integration for flood zone determination
- **📊 Unified Disaster Dashboard**: Single interface for all disaster sources and types
- **🎯 Geographic Filtering**: State, county, and event type filtering
- **📈 Risk Score Calculation**: Automated risk scoring based on disaster frequency and severity

### 🤖 AI Assistant Domain
- **💬 LangChain Integration**: Conversational AI with PostgreSQL memory persistence
- **🏦 Mortgage Operations AI**: Expert assistant for correspondent and retail lending operations
- **🌪️ Disaster Risk AI**: Specialized assistant for disaster impact on real estate values
- **📊 Data-Driven Insights**: AI-powered analysis of loan portfolios and disaster patterns
- **🔄 Context-Aware Conversations**: Maintains conversation context across sessions
- **📈 Operational Recommendations**: AI suggestions for process improvement and risk mitigation

## 🚀 Quick Start

### 1. Clone and Setup
```bash
git clone <your-repo-url>
cd piBoom
chmod +x setup-pi.sh
./setup-pi.sh
```

### 2. Configure Environment Variables
Create a `.env` file with your API keys:
```bash
# Google APIs
GOOGLE_API_KEY=your_google_api_key

# OpenAI (for AI assistants)
OPENAI_API_KEY=your_openai_api_key

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@host:port/database

# Optional: Shazam API (for song identification)
SHAZAM_API_KEY=your_shazam_api_key

# Optional: ArcGIS API (for some disaster services)
ARCGIS_API_KEY=your_arcgis_api_key
```

### 3. Start the System
```bash
# For Raspberry Pi
npm run pi

# For Windows/Development
npm run windows

# For Docker
docker-compose up
```

### 4. Access Web Interfaces
- **Music Research**: `http://localhost:3000/music/music-research.html`
- **Mortgage Pipeline**: `http://localhost:3000/finance/pipeline-risk-dashboard.html`
- **Disaster Dashboard**: `http://localhost:3000/finance/disasters-unified.html`
- **Encompass Assistant**: `http://localhost:3000/finance/encompass-assistant.html`
- **Main Hub**: `http://localhost:3000/`

## 🛠️ Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web server framework
- **PostgreSQL** - Relational database for loans, disasters, and AI memory
- **Socket.IO** - Real-time communication for voice commands
- **LangChain** - AI conversation framework with memory
- **OpenAI GPT** - AI assistant models

### Frontend
- **Bootstrap 5** - UI framework
- **DataTables** - Advanced table functionality
- **Google Maps API** - Interactive mapping and geocoding
- **YouTube Data API** - Video integration
- **Chart.js** - Data visualization

### APIs & Services
- **Google APIs**: Maps, Geocoding, Knowledge Graph, YouTube
- **FEMA API**: Disaster declarations and flood zone data
- **NASA FIRMS**: Fire detection data
- **USGS**: Earthquake data
- **NOAA/NWS**: Weather alerts and warnings
- **NHC**: Hurricane tracking
- **ALERTCalifornia**: Fire camera network
- **OpenAI**: ChatGPT integration
- **Shazam API**: Audio fingerprinting (optional)

### Database Schema
- **loans** - Mortgage loan pipeline data
- **disasters** - Unified disaster event storage
- **langchain_memory** - AI conversation persistence
- **records** - Music album collection (optional)
- **trees** - Tree collection (optional)

## 📦 Key Features

### 🎵 Music Research Features
- Voice-activated artist search and discovery
- Audio fingerprinting for song identification
- AI-powered music recommendations and insights
- Interactive maps showing artist locations
- Comprehensive timelines and discographies
- YouTube video integration

### 🏦 Mortgage Pipeline Features
- **Loan Management**: Create, read, update, delete loan records
- **Address Geocoding**: Automatic coordinate extraction from addresses
- **Disaster Risk Scoring**: Automated risk calculation (0-15 scale)
- **Flood Zone Detection**: FEMA NFHL integration for flood zone lookup
- **Portfolio Analytics**: Risk distribution, channel analysis, milestone tracking
- **KML Export**: Google Earth visualization of loan locations
- **Batch Processing**: Bulk operations for loan updates

### 🌪️ Disaster Monitoring Features
- **Multi-Source Integration**: FEMA, NASA, USGS, NOAA, NHC, GDACS
- **Real-Time Updates**: 90-day rolling window of disaster events
- **Live Camera Feeds**: ALERTCalifornia fire cameras with video streaming
- **Flood Zone Analysis**: FEMA NFHL flood zone determination with boundaries
- **Geographic Filtering**: Filter by state, county, event type, source
- **Risk Visualization**: Color-coded markers and heat maps
- **Distance Calculations**: Proximity analysis between loans and disasters

### 🤖 AI Assistant Features
- **Mortgage Operations Expert**: Specialized knowledge in correspondent and retail lending
- **Disaster Risk Expert**: Expertise in disaster impact on real estate values
- **Conversation Memory**: PostgreSQL-backed conversation persistence
- **Context Awareness**: Understands current filters, selected disasters, portfolio composition
- **Data Integration**: Direct access to loan pipeline and disaster data
- **Operational Insights**: Process improvement and efficiency recommendations

## 🎤 Voice Commands (Raspberry Pi)

### Music Research Commands
| Command | Example | Action |
|---------|---------|---------|
| **search [artist]** | "search Pink Floyd" | Search for artist information |
| **tell me about [artist]** | "tell me about Tool" | Get detailed artist info |
| **ask [question]** | "ask what makes Pink Floyd unique" | Get AI insights about music |

### Audio Player Commands
| Command | Action |
|---------|---------|
| **play** | Start playing current track |
| **pause** | Pause current track |
| **next** | Skip to next track |
| **volume up** | Increase volume by 10% |

## 📊 Disaster Risk Assessment

### Risk Scoring Algorithm
- **Base Score**: Disaster declaration count (0-10)
- **Flood Zone Risk**: Additional points for high-risk flood zones (A, V zones)
- **Distance Weighting**: Closer disasters = higher risk
- **Time Decay**: Recent disasters weighted more heavily
- **Final Score**: 0-15 scale (capped for display)

### Flood Zone Integration
- **FEMA NFHL**: National Flood Hazard Layer integration
- **Zone Types**: A, AE, AO, AH, V, VE, X (shaded/unshaded), D
- **Base Flood Elevation**: BFE data when available
- **Boundary Geometry**: Flood zone boundary visualization
- **Automatic Updates**: Batch flood zone checking for all loans

## 🗺️ Camera Viewer Features

### ALERTCalifornia Fire Cameras
- **Live Video Feeds**: Real-time camera streaming
- **Interactive Controls**: Pan/tilt controls when available
- **Auto-Refresh**: Static images refresh every 30 seconds
- **Multiple Access Methods**:
  - Table button: "View Feed" in Actions column
  - Map marker: Click marker → Info window → "View Camera Feed" button
- **Fallback Handling**: Graceful degradation if feeds unavailable

## 🔧 Configuration

### Database Setup
See [DATABASE_SETUP.md](DATABASE_SETUP.md) for detailed PostgreSQL setup instructions.

### Docker Deployment
See [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) for containerized deployment.

### API Keys Setup
- **Google API**: [Google Cloud Console](https://console.cloud.google.com/)
- **OpenAI API**: [OpenAI Platform](https://platform.openai.com/)
- **Shazam API**: [RapidAPI Shazam](https://rapidapi.com/apidojo/api/shazam) (optional, free tier available)

## 📁 Project Structure

```
piBoom/
├── config/              # Configuration files
├── controllers/         # API controllers
│   ├── loan-pipeline-ai.controller.js    # AI mortgage assistant
│   ├── disasters.controller.js            # Disaster data management
│   └── ...
├── services/           # Core services
│   ├── disaster-risk.service.js          # Risk assessment engine
│   ├── disasters.service.js             # Multi-source disaster data
│   ├── loan-pipeline.service.js          # Loan CRUD operations
│   ├── langchain-memory.service.js       # AI conversation memory
│   └── ...
├── routes/             # API routes
├── public/             # Web interfaces
│   ├── finance/        # Mortgage & disaster dashboards
│   ├── music/          # Music research interfaces
│   └── ...
├── data/               # Static data files
└── server.js           # Main server entry point
```

## 🚀 Deployment

### Raspberry Pi
```bash
./setup-pi.sh
npm run pi
```

### Docker
```bash
docker-compose up -d
```

### Production (Render/Heroku)
See [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) for cloud deployment instructions.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Raspberry Pi Foundation for the amazing hardware
- FEMA for disaster data APIs
- Google for Maps and Geocoding APIs
- OpenAI for GPT models
- ALERTCalifornia for fire camera network
- All open source contributors

---

**🎵 Pi BOOM - Your Multi-Domain Platform for Music, Mortgages, and Disaster Monitoring! 🎵**
