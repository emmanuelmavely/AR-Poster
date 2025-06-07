import { VisionService } from './src/services/VisionService.js';  
import { TMDbService } from './src/services/TMDbService.js';  
  
class FreeARMovieScanner {  
    constructor() {  
        this.visionService = new VisionService();  
        this.tmdbService = new TMDbService();  
        this.arScene = null;  
        this.arCamera = null;  
        this.isARStarted = false;  
        this.isScanning = false;  
        this.isOCRReady = false;  
        this.movieMarkers = new Map();  
        this.markerIdCounter = 0;  
          
        this.initElements();  
        this.bindEvents();  
        this.init();  
    }  
  
    initElements() {  
        this.arScene = document.getElementById('ar-scene');  
        this.arCamera = document.getElementById('ar-camera');  
        this.startBtn = document.getElementById('start-ar-btn');  
        this.instruction = document.getElementById('scan-instruction');  
        this.loadingOverlay = document.getElementById('loading-overlay');  
        this.errorMessage = document.getElementById('error-message');  
        this.arStatus = document.getElementById('ar-status');  
    }  
  
    bindEvents() {  
        this.startBtn.addEventListener('click', (e) => {  
            e.preventDefault();  
            e.stopPropagation();  
            console.log('Start AR button clicked');  
            this.toggleAR();  
        });  
          
        this.startBtn.addEventListener('touchend', (e) => {  
            e.preventDefault();  
            e.stopPropagation();  
            console.log('Start AR button touched');  
            this.toggleAR();  
        });  
          
        // Screen tap for scanning - use touchend for better mobile support  
        document.addEventListener('touchend', (event) => {  
            if (this.isARStarted && !event.target.closest('.ar-btn, .movie-card, .close-btn')) {  
                event.preventDefault();  
                this.scanAtPosition(event.changedTouches[0]);  
            }  
        });  
          
        // Fallback for mouse clicks (desktop/testing)  
        document.addEventListener('click', (event) => {  
            if (this.isARStarted && !event.target.closest('.ar-btn, .movie-card, .close-btn')) {  
                this.scanAtPosition(event);  
            }  
        });  
  
        // A-Frame loaded event  
        this.arScene.addEventListener('loaded', () => {  
            console.log('✅ A-Frame scene loaded');  
            this.updateStatus('Ready - Tap Start AR');  
        });  
          
        // Handle visibility changes  
        document.addEventListener('visibilitychange', () => {  
            if (document.hidden) {  
                console.log('📱 Page hidden');  
            } else {  
                console.log('📱 Page visible');  
                if (this.isARStarted) {  
                    this.ensureCameraVisible();  
                }  
            }  
        });  
        
        const settingsBtn = document.getElementById('settings-btn');
        settingsBtn.addEventListener('click', () => {
            this.toggleSettings();
        });
    }  
  
    async init() {  
        try {  
            console.log('🚀 Initializing Free AR Movie Scanner...');  
              
            // Initialize simplified Vision service  
            this.updateStatus('Initializing Vision API...');  
            await this.visionService.init();  
            this.isOCRReady = true;  
            console.log('✅ Vision service ready');  
              
            this.updateStatus('Ready to start AR');  
              
        } catch (error) {  
            console.error('❌ Initialization failed:', error);  
            this.isOCRReady = false;  
            this.showError(`Setup Error: ${error.message}`);  
            this.updateStatus('Setup required - Check Vision API credentials');  
        }  
    }  
  
    async toggleAR() {  
        if (this.isARStarted) {  
            this.stopAR();  
        } else {  
            await this.startAR();  
        }  
    }  
  
    async startAR() {  
        try {  
            console.log('🚀 Starting AR...');  
            this.updateStatus('Starting AR...');  
              
            // Check if OCR is ready before starting AR  
            if (!this.isOCRReady) {  
                throw new Error('Vision service not ready. Please refresh the page.');  
            }  
              
            // Ensure camera feed is visible  
            this.ensureCameraVisible();  
              
            this.isARStarted = true;  
            this.updateARUI();  
            this.showInstruction();  
              
            this.updateStatus('AR Active - Point at poster and tap');  
            console.log('✅ AR started successfully');  
              
        } catch (error) {  
            console.error('❌ AR start failed:', error);  
            this.showError(error.message);  
        }  
    }  
  
    ensureCameraVisible() {  
        // Make sure AR.js camera feed is visible  
        const arjsVideo = document.querySelector('video');  
        if (arjsVideo) {  
            arjsVideo.style.display = 'block';  
            arjsVideo.style.position = 'fixed';  
            arjsVideo.style.top = '0';  
            arjsVideo.style.left = '0';  
            arjsVideo.style.width = '100vw';  
            arjsVideo.style.height = '100vh';  
            arjsVideo.style.objectFit = 'cover';  
            arjsVideo.style.zIndex = '0';  
            console.log('✅ Camera feed made visible');  
        }  
          
        // Make sure canvas allows camera passthrough  
        const canvas = document.querySelector('canvas');  
        if (canvas) {  
            canvas.style.background = 'transparent';  
            canvas.style.zIndex = '1';  
            console.log('✅ Canvas set to transparent');  
        }  
          
        // Force AR.js to show camera  
        setTimeout(() => {  
            const video = document.querySelector('video');  
            if (video && video.style.display === 'none') {  
                video.style.display = 'block';  
                console.log('✅ Forced camera visibility');  
            }  
        }, 1000);  
    }  
  
    stopAR() {  
        console.log('🛑 Stopping AR...');  
          
        this.isARStarted = false;  
        this.clearAllMarkers();  
        this.updateARUI();  
        this.hideInstruction();  
          
        this.updateStatus('AR Stopped');  
        console.log('✅ AR stopped');  
    }  
  
    updateARUI() {
        if (this.isARStarted) {
            this.startBtn.textContent = 'EXIT';
            this.startBtn.classList.add('active');
        } else {
            this.startBtn.textContent = 'START';
            this.startBtn.classList.remove('active');
        }
    }  
  
    showInstruction() {  
        this.instruction.classList.add('show');  
        setTimeout(() => {  
            this.hideInstruction();  
        }, 5000);  
    }  
  
    hideInstruction() {  
        this.instruction.classList.remove('show');  
    }  
  
    async scanAtPosition(event) {  
        if (this.isScanning || !this.isARStarted || !this.isOCRReady) return;  
          
        console.log('🎯 Scanning at tap position');  
        this.isScanning = true;  
        this.showLoading();  
        this.updateStatus('Scanning poster...');  
          
        try {  
            // Get tap position  
            const tapX = event.clientX;  
            const tapY = event.clientY;  
              
            // Capture camera frame  
            const canvas = await this.captureFrame();  
              
            // Extract text using simplified Vision service  
            const movieTitle = await this.visionService.extractText(canvas);  
              
            if (movieTitle && movieTitle.trim().length > 0) {  
                console.log('📝 Detected movie:', movieTitle);  
                  
                // Search for movie  
                const movieData = await this.tmdbService.searchMovie(movieTitle);  
                  
                if (movieData) {  
                    // Place AR marker  
                    this.placeARMovieMarker(tapX, tapY, movieData);  
                    this.updateStatus(`Found: ${movieData.title}`);  
                } else {  
                    this.updateStatus('Movie not found');  
                    this.showError('Movie not found in database. Try scanning the title area.');  
                }  
            } else {  
                this.updateStatus('No text detected');  
                this.showError('No text detected. Try moving closer or improving lighting.');  
            }  
              
        } catch (error) {  
            console.error('❌ Scan failed:', error);  
            this.showError(error.message); // Now shows specific guidance from VisionService  
            this.updateStatus('Scan failed');  
        } finally {  
            this.isScanning = false;  
            this.hideLoading();  
              
            setTimeout(() => {  
                if (this.isARStarted) {  
                    this.updateStatus('AR Active - Point at poster and tap');  
                }  
            }, 3000);  
        }  
    }  
  
    async captureFrame() {  
        // Get video element from A-Frame  
        const video = document.querySelector('video');  
        if (!video) {  
            throw new Error('No video feed available');  
        }  
          
        // Create canvas and capture frame  
        const canvas = document.createElement('canvas');  
        canvas.width = video.videoWidth || 640;  
        canvas.height = video.videoHeight || 480;  
          
        const ctx = canvas.getContext('2d');  
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);  
          
        return canvas;  
    }  
  
    placeARMovieMarker(screenX, screenY, movieData) {  
        const markerId = `movie_marker_${++this.markerIdCounter}`;  
          
        // Convert screen tap to 3D world position using raycasting  
        const worldPosition = this.screenToWorld3D(screenX, screenY);  
          
        // Create 3D entity anchored in world space (FIXED - no green rotating box)  
        const arEntity = this.create3DMovieEntity(movieData, markerId, worldPosition);  
        this.arScene.appendChild(arEntity);  
          
        // Create 2D overlay that follows the 3D entity  
        const movieCard = this.create2DOverlayCard(movieData, markerId);  
        document.body.appendChild(movieCard);  
          
        // Store marker data  
        this.movieMarkers.set(markerId, {  
            arEntity: arEntity,  
            movieCard: movieCard,  
            movieData: movieData,  
            worldPosition: worldPosition,  
            markerId: markerId  
        });  
          
        // Start tracking this marker's 2D position (FIXED - with Z-axis scaling)  
        this.startEntityTracking(markerId);  
          
        console.log('✅ Placed 3D anchored marker:', movieData.title, 'at world position:', worldPosition);  
    }  
  
    screenToWorld3D(screenX, screenY) {
        // Convert screen coordinates to world position using raycasting
    
        // Create normalized device coordinates (-1 to +1)
        const mouse = {
            x: (screenX / window.innerWidth) * 2 - 1,
            y: -(screenY / window.innerHeight) * 2 + 1
        };
        
        // Use A-Frame's camera to create a ray
        const camera = this.arCamera;
        const cameraEl = camera.object3D;
        
        // Create ray from camera through screen point
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraEl.children[0]);
        
        // Reduce distance to make markers appear closer
        const distance = 1.5; // Reduced from 2.5 to 1.5 meters
        
        // Get camera direction and position
        const direction = raycaster.ray.direction.normalize();
        const cameraPos = new THREE.Vector3();
        cameraEl.getWorldPosition(cameraPos);
        
        // Calculate world position with offset
        const worldPosition = new THREE.Vector3();
        worldPosition.copy(cameraPos);
        worldPosition.add(direction.multiplyScalar(distance));
        
        // Add slight vertical offset to improve visibility
        worldPosition.y += 0.1; // Small upward offset
        
        return {
            x: worldPosition.x,
            y: worldPosition.y,
            z: worldPosition.z
        };
    }
  
create3DMovieEntity(movieData, markerId, worldPos) {  
    // Create A-Frame entity anchored in 3D space (OPTION 3: Invisible anchor only)  
    const entity = document.createElement('a-entity');  
    entity.setAttribute('id', markerId);  
    entity.setAttribute('position', `${worldPos.x} ${worldPos.y} ${worldPos.z}`);  
    entity.classList.add('ar-3d-marker');  
      
    // Create tiny invisible anchor point for 3D positioning only  
    const anchor = document.createElement('a-sphere');  
    anchor.setAttribute('radius', '0.01'); // Very small  
    anchor.setAttribute('opacity', '0');   // Completely invisible  
    anchor.setAttribute('material', 'transparent: true');  
      
    // Assemble entity (only invisible anchor)  
    entity.appendChild(anchor);  
      
    return entity;  
}
  
    create2DOverlayCard(movieData, markerId) {
        const movieCard = document.createElement('div');
        movieCard.className = 'movie-card';
        movieCard.id = `movie-card-${markerId}`;
        
        // Format required info (always shown)
        const year = movieData.release_date?.substring(0, 4) || '?';
        
        // Format optional info based on settings
        const rating = movieData.vote_average ? `★${movieData.vote_average.toFixed(1)}/10` : 'N/A';
        const runtime = movieData.runtime ? `${movieData.runtime}min` : '';
        const genreText = movieData.genres?.join(' • ') || 'N/A';
        const director = movieData.director || 'N/A';
        const cast = movieData.cast?.join(', ') || 'N/A';
        
        // Get current settings
        const settings = this.getSettings();
        
        movieCard.innerHTML = `
            <div class="close-btn" onclick="window.arScanner.removeMarker('${markerId}')">×</div>
            <div class="movie-title">${movieData.title} (${year})</div>
            <div class="movie-meta">
                ${settings.showRating ? `<span class="rating">${rating}</span>` : ''}
                ${settings.showRuntime ? `<span class="runtime">${runtime}</span>` : ''}
            </div>
            ${settings.showGenres ? `<div class="movie-genres">${genreText}</div>` : ''}
            ${settings.showDirector ? `<div class="movie-director">Director: ${director}</div>` : ''}
            ${settings.showCast ? `<div class="movie-cast">Cast: ${cast}</div>` : ''}
            ${settings.showSynopsis ? `<div class="movie-overview">${movieData.overview || 'No description available.'}</div>` : ''}
            ${settings.showTrailer && movieData.trailer_url ? 
                `<a href="${movieData.trailer_url}" target="_blank" class="trailer-btn">Watch Trailer</a>` : ''}
        `;
        
        return movieCard;
    }  
  
    getSettings() {
        const defaultSettings = {
            showRating: true,
            showRuntime: true,
            showGenres: true,
            showDirector: true,
            showCast: true,
            showSynopsis: true,
            showTrailer: true
        };
        
        try {
            const saved = localStorage.getItem('arMovieScannerSettings');
            return saved ? JSON.parse(saved) : defaultSettings;
        } catch (e) {
            return defaultSettings;
        }
    }
  
    saveSettings(settings) {
        localStorage.setItem('arMovieScannerSettings', JSON.stringify(settings));
        // Refresh all existing markers with new settings
        this.refreshAllMarkers();
    }
  
    refreshAllMarkers() {
        this.movieMarkers.forEach((marker, markerId) => {
            const newCard = this.create2DOverlayCard(marker.movieData, markerId);
            marker.movieCard.replaceWith(newCard);
            marker.movieCard = newCard;
        });
    }
  
    toggleSettings() {
        const existing = document.getElementById('ar-settings-panel');
        if (existing) {
            existing.remove();
            return;
        }
        
        const settings = this.getSettings();
        const panel = document.createElement('div');
        panel.id = 'ar-settings-panel';
        panel.className = 'settings-panel';
        
        panel.innerHTML = `
            <h3>Display Settings</h3>
            <div class="settings-options">
                <label>
                    <input type="checkbox" ${settings.showRating ? 'checked' : ''} data-setting="showRating">
                    Show Rating
                </label>
                <label>
                    <input type="checkbox" ${settings.showRuntime ? 'checked' : ''} data-setting="showRuntime">
                    Show Runtime
                </label>
                <label>
                    <input type="checkbox" ${settings.showGenres ? 'checked' : ''} data-setting="showGenres">
                    Show Genres
                </label>
                <label>
                    <input type="checkbox" ${settings.showDirector ? 'checked' : ''} data-setting="showDirector">
                    Show Director
                </label>
                <label>
                    <input type="checkbox" ${settings.showCast ? 'checked' : ''} data-setting="showCast">
                    Show Cast
                </label>
                <label>
                    <input type="checkbox" ${settings.showSynopsis ? 'checked' : ''} data-setting="showSynopsis">
                    Show Synopsis
                </label>
                <label>
                    <input type="checkbox" ${settings.showTrailer ? 'checked' : ''} data-setting="showTrailer">
                    Show Trailer Button
                </label>
            </div>
        `;
        
        // Add event listeners for settings changes
        panel.addEventListener('change', (e) => {
            const checkbox = e.target;
            if (checkbox.dataset.setting) {
                const settings = this.getSettings();
                settings[checkbox.dataset.setting] = checkbox.checked;
                this.saveSettings(settings);
            }
        });
        
        document.body.appendChild(panel);
    }
  
    removeMarker(markerId) {  
        const marker = this.movieMarkers.get(markerId);  
        if (marker) {  
            marker.arEntity.remove();  
            marker.movieCard.remove();  
            this.movieMarkers.delete(markerId);  
            console.log('✅ Removed marker:', markerId);  
        }  
    }  
  
    clearAllMarkers() {  
        console.log('🧹 Clearing all AR markers...');  
        this.movieMarkers.forEach((marker, markerId) => {  
            marker.arEntity.remove();  
            marker.movieCard.remove();  
        });  
        this.movieMarkers.clear();  
        console.log('✅ All markers cleared');  
    }  
  
    showLoading() {  
        this.loadingOverlay.classList.add('show');  
    }  
  
    hideLoading() {  
        this.loadingOverlay.classList.remove('show');  
    }  
  
    showError(message) {  
        this.errorMessage.textContent = message;  
        this.errorMessage.classList.add('show');  
        setTimeout(() => {  
            this.errorMessage.classList.remove('show');  
        }, 5000);  
    }  
  
    updateStatus(text) {  
        this.arStatus.textContent = text;  
    }  
  
    startEntityTracking(markerId) {
        const marker = this.movieMarkers.get(markerId);
        if (!marker) return;

        // Get the 3D entity and corresponding 2D card
        const entity = marker.arEntity;
        const card = marker.movieCard;

        // Setup animation loop for tracking
        const tick = () => {
            if (!this.movieMarkers.has(markerId) || !this.isARStarted) return;

            // Get current camera position
            const camera = document.getElementById('ar-camera').object3D;
            const entityPos = new THREE.Vector3();
            
            // Get world position of entity
            entity.object3D.getWorldPosition(entityPos);
            
            // Project 3D position to 2D screen coordinates
            entityPos.project(camera.children[0]); // camera's PerspectiveCamera
            
            // Convert to pixel coordinates
            const x = (entityPos.x + 1) / 2 * window.innerWidth;
            const y = (-entityPos.y + 1) / 2 * window.innerHeight;
            
            // Calculate distance for scaling
            const distance = camera.position.distanceTo(entity.object3D.position);
            const scale = Math.max(0.6, Math.min(1.2, 1.5 / (distance * 0.8))); // Adjusted scale factors
            
            // Only update if entity is in front of camera (z < 1)
            if (entityPos.z < 1) {
                card.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`;
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }

            // Continue tracking
            requestAnimationFrame(tick);
        };

        // Start tracking loop
        requestAnimationFrame(tick);
    }
}  
  
// Initialize when page loads  
document.addEventListener('DOMContentLoaded', () => {  
    window.arScanner = new FreeARMovieScanner();  
});