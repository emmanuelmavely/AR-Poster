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
          
        // Add console monitor
        console.log = ((oldLog) => (...args) => {
            oldLog.apply(console, args);
            // You could also update a UI element here to show logs
            this.updateStatus(args.join(' '));
        })(console.log);
    
        this.initElements();  
        this.bindEvents();  
        this.init();  
    }  
  
    initElements() {  
        this.arScene = document.getElementById('ar-scene');  
        this.arCamera = document.getElementById('ar-camera');  
        this.startBtn = document.getElementById('start-ar-btn');  
        this.clearBtn = document.getElementById('clear-markers-btn');  
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
          
        this.clearBtn.addEventListener('click', (e) => {  
            e.preventDefault();  
            e.stopPropagation();  
            this.clearAllMarkers();  
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
    }  
  
    async init() {  
        try {
            console.log('🚀 Initializing AR Movie Scanner...');
            
            // Initialize Vision Service first with better error handling
            console.log('👁️ Starting Vision Service initialization...');
            const visionStatus = await this.visionService.init();
            if (!visionStatus) {
                throw new Error('Vision service initialization failed');
            }
            
            // Verify Vision Service is ready
            const status = this.visionService.getStatus();
            if (!status.initialized) {
                throw new Error('Vision service is not ready');
            }
            
            // Set OCR ready flag only after confirmed initialization
            this.isOCRReady = true;
            console.log('👁️ Vision Service Status: Ready');
            
            // Initialize TMDb Service
            await this.tmdbService.getApiKey();
            console.log('🎬 TMDb Service Ready');
            
            this.updateStatus('Ready to scan');
            console.log('✅ Initialization complete');
        } catch (error) {
            console.error('❌ Initialization failed:', error);
            this.isOCRReady = false; // Ensure flag is false on failure
            this.showError('Vision service not ready. Please refresh the page');
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
            this.startBtn.textContent = '🛑 Stop AR';  
            this.startBtn.classList.add('active');  
            this.clearBtn.style.display = 'block';  
        } else {  
            this.startBtn.textContent = '🚀 Start AR';  
            this.startBtn.classList.remove('active');  
            this.clearBtn.style.display = 'none';  
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
        raycaster.setFromCamera(mouse, cameraEl.children[0]); // Get camera component  
          
        // Cast ray forward and place object at specific distance  
        const distance = 2.5; // 2.5 meters in front of camera  
        const direction = raycaster.ray.direction.clone();  
        const origin = raycaster.ray.origin.clone();  
          
        // Calculate world position  
        const worldPosition = origin.add(direction.multiplyScalar(distance));  
          
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
        
        // Format year and rating
        const year = movieData.release_date?.substring(0, 4) || '?';
        const rating = movieData.vote_average ? `★${movieData.vote_average.toFixed(1)}/10` : 'N/A';
        
        // Format runtime from minutes to hours and minutes
        const runtime = movieData.runtime ? 
            `${Math.floor(movieData.runtime/60)}h ${movieData.runtime%60}m` : 
            'N/A';
        
        movieCard.innerHTML = `
            <div class="close-btn" onclick="window.arScanner.removeMarker('${markerId}')">×</div>
            <div class="movie-title">${movieData.title}</div>
            <div class="movie-meta">
                ${year} • ${rating} | ${runtime}
            </div>
            <div class="movie-overview">${movieData.overview || 'No description available.'}</div>
        `;  
          
        return movieCard;  
    }  
  
    startEntityTracking(markerId) {  
        const marker = this.movieMarkers.get(markerId);  
        if (!marker) return;  
          
        const updatePosition = () => {  
            if (!this.movieMarkers.has(markerId)) return;  
              
            // FIXED: Enhanced 3D to 2D projection with Z-axis scaling  
            const screenPos = this.project3DToScreen(marker.worldPosition);  
            if (screenPos && screenPos.visible) {  
                marker.movieCard.style.left = `${screenPos.x}px`;  
                marker.movieCard.style.top = `${screenPos.y}px`;  
                marker.movieCard.style.transform = `translate(-50%, -50%) scale(${screenPos.scale})`;  
                marker.movieCard.style.opacity = screenPos.opacity;  
                marker.movieCard.style.display = 'block';  
            } else {  
                marker.movieCard.style.display = 'none';  
            }  
              
            requestAnimationFrame(updatePosition);  
        };  
          
        updatePosition();  
    }  
  
project3DToScreen(worldPos) {  
    try {  
        // Get the AR.js camera more directly  
        const scene = this.arScene;  
        const camera = scene.camera;  
          
        if (!camera) {  
            console.warn('⚠️ AR Camera not found');  
            return { visible: false };  
        }  
          
        // Create vector from world position  
        const vector = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);  
          
        // Get camera world position directly from AR.js  
        const cameraPosition = new THREE.Vector3();  
        camera.getWorldPosition(cameraPosition);  
          
        // Calculate actual distance  
        const distance = cameraPosition.distanceTo(vector);  
          
        // Project using AR camera  
        const projected = vector.clone().project(camera);  
          
        // Convert to screen coordinates  
        const x = (projected.x * 0.5 + 0.5) * window.innerWidth;  
        const y = (projected.y * -0.5 + 0.5) * window.innerHeight;  
          
        // Enhanced scaling based on distance  
        const baseDistance = 2.5;  
        const scale = Math.max(0.3, Math.min(1.5, baseDistance / Math.max(distance, 0.1)));  
        const opacity = Math.max(0.4, Math.min(1.0, baseDistance / Math.max(distance, 0.1)));  
          
        const visible = projected.z < 1 && distance < 10;  
          
        console.log(`Distance: ${distance.toFixed(2)}, Scale: ${scale.toFixed(2)}`); // Debug log  
          
        return { x, y, scale, opacity, visible, distance };  
          
    } catch (error) {  
        console.warn('⚠️ Projection error:', error);  
        return { visible: false };  
    }  
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
        console.error('❌ Error:', message);
        if (this.errorMessage) {
            this.errorMessage.textContent = message;
            this.errorMessage.classList.add('show');
            setTimeout(() => {
                this.errorMessage.classList.remove('show');
            }, 5000);
        }
    }  
  
    updateStatus(text) {
        console.log('📢 Status:', text);
        if (this.arStatus) {
            this.arStatus.textContent = text;
        }
    }
}  
  
// Initialize when page loads  
document.addEventListener('DOMContentLoaded', () => {  
    window.arScanner = new FreeARMovieScanner();  
});