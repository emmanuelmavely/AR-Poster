# AR Movie Scanner

A browser-based augmented reality application that lets you scan movie posters with your camera and displays interactive movie information in AR space. Built with A-Frame, AR.js, and Google Cloud Vision API.

## Features

- **Real-time Poster Scanning**: Point your camera at movie posters and tap to scan
- **OCR Text Recognition**: Powered by Google Cloud Vision API for accurate text extraction
- **Movie Database Integration**: Searches The Movie Database (TMDB) for comprehensive movie information
- **3D AR Markers**: Places interactive 3D content anchored in world space
- **Cross-Platform**: Works on any modern web browser with camera access
- **No App Installation**: Pure WebAR - no native app required

## Demo

The application provides an immersive AR experience where movie information appears as floating 3D elements positioned in real-world space.

## Technology Stack

### Frontend
- **A-Frame 1.4.0**: WebVR/AR framework for 3D scene management
- **AR.js**: Marker-less AR tracking and camera integration
- **Three.js**: 3D graphics and spatial calculations
- **Vanilla JavaScript**: ES6 modules for application logic

### Backend & APIs
- **Express.js**: API server and static file serving
- **Google Cloud Vision API**: OCR text extraction from camera frames
- **The Movie Database (TMDB) API**: Movie metadata and information
- **Node.js**: Server runtime environment

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- Google Cloud Vision API credentials
- TMDB API key
- HTTPS-enabled server (required for camera access)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/emmanuelmavely/AR-Poster.git
   cd AR-Poster
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the project root:
   ```env
   VITE_TMDB_API_KEY=your_tmdb_api_key_here
   NODE_ENV=development
   ```

4. **Configure Google Vision API**
   
   Place your Google Cloud Vision credentials file as `google-vision-credentials.json` in the project root.

5. **Start the server**
   ```bash
   # Development server with detailed logging
   node server-local.js
   
   # Or production server
   node server.js
   ```

6. **Access the application**
   
   Open your browser and navigate to:
   - Local: `http://localhost:8001`
   - Network: `http://[your-ip]:8001`

## Usage

### Basic Scanning
1. **Start AR Mode**: Tap the "🚀 Start AR" button
2. **Allow Camera Access**: Grant camera permissions when prompted
3. **Point at Poster**: Aim your camera at a movie poster
4. **Tap to Scan**: Tap anywhere on the poster area to initiate scanning
5. **View Results**: Movie information will appear as AR overlays

### Controls
- **Start/Stop AR**: Toggle AR mode on/off
- **Clear All**: Remove all placed AR markers
- **Tap Scanning**: Tap poster areas to scan for movie titles

## Architecture

### Application Structure
The main application controller orchestrates all AR operations, service integrations, and user interactions.

### Service Layer
The application uses a simplified service architecture:
- **VisionService**: Handles Google Vision API integration
- **TMDbService**: Manages movie database searches

### API Endpoints
- `GET /api/health` - System health and component status
- `POST /api/vision` - OCR text extraction endpoint
- `GET /api/test-vision` - Vision API configuration validation

## Configuration

### Environment Variables
| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_TMDB_API_KEY` | The Movie Database API key | Yes |
| `NODE_ENV` | Environment (development/production) | No |

### Google Cloud Vision Setup
1. Create a Google Cloud Project
2. Enable the Vision API
3. Create a service account and download credentials
4. Place credentials as `google-vision-credentials.json` in project root

### TMDB API Setup
1. Register at [The Movie Database](https://www.themoviedb.org/)
2. Generate an API key
3. Add to your `.env` file as `VITE_TMDB_API_KEY`

## Development

### Project Structure
```
AR-Poster/
├── index.html              # Main application entry point
├── app.js                  # Core application logic
├── server.js               # Production server
├── server-local.js         # Development server
├── api/
│   └── vision.js           # Vision API handler
├── src/services/
│   ├── VisionService.js    # OCR service integration
│   └── TMDbService.js      # Movie database service
├── css/
│   └── styles.css          # Application styling
└── package.json            # Dependencies and scripts
```

### Key Components
- **AR Scene Management**: Handles 3D scene setup and camera integration
- **Text Extraction Pipeline**: Processes camera frames through Vision API
- **3D Marker Placement**: Creates and positions AR content in world space

### Development Server
The development server provides enhanced logging and debugging capabilities for easier troubleshooting during development.

## Troubleshooting

### Common Issues

**Camera Access Denied**
- Ensure HTTPS is enabled
- Check browser permissions
- Try refreshing the page

**No Text Detected**
- Move closer to the poster
- Ensure good lighting conditions
- Try different angles

**Vision API Errors**
- Verify credentials file placement
- Check API quotas and billing
- Validate service account permissions

### Health Checks
Use the health endpoint to verify system status:
```bash
curl http://localhost:8001/api/health
```

## Browser Compatibility

- **Chrome/Chromium**: Full support
- **Firefox**: WebAR support varies
- **Safari**: iOS 11.3+ with WebRTC support
- **Edge**: Chromium-based versions

**Note**: HTTPS is required for camera access on all browsers.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly on mobile devices
5. Submit a pull request

## License

This project is open source. Please check the repository for license details.

## Acknowledgments

- **A-Frame Community**: For the excellent WebVR/AR framework
- **AR.js**: For marker-less AR tracking capabilities
- **Google Cloud Vision**: For powerful OCR capabilities
- **The Movie Database**: For comprehensive movie information

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/emmanuelmavely/AR-Poster)