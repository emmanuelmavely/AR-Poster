  // Import your services (adjust paths as needed)
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
                    console.log('🚀 Initializing Free AR Movie Scanner...');
                    
                    // Initialize services
                    await this.visionService.init();
                    console.log('✅ Vision service ready');
                    
                    this.updateStatus('Ready to start AR');
                    
                } catch (error) {
                    console.error('❌ Initialization failed:', error);
                    this.showError('Failed to initialize. Please refresh and try again.');
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
                    
                    // Ensure camera feed is visible
                    this.ensureCameraVisible();
                    
                    this.isARStarted = true;
                    this.updateARUI();
                    this.showInstruction();
                    
                    this.updateStatus('AR Active - Point at poster and tap');
                    console.log('✅ AR started successfully');
                    
                } catch (error) {
                    console.error('❌ AR start failed:', error);
                    this.showError('Failed to start AR. Please allow camera access.');
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
                if (this.isScanning || !this.isARStarted) return;
                
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
                    
                    // Extract text
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
                        this.showError('No text detected. Make sure poster title is clearly visible.');
                    }
                    
                } catch (error) {
                    console.error('❌ Scan failed:', error);
                    this.showError(`Scan failed: ${error.message}`);
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
                
                // Create 3D entity anchored in world space
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
                
                // Start tracking this marker's 2D position
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
                // Create A-Frame entity anchored in 3D space
                const entity = document.createElement('a-entity');
                entity.setAttribute('id', markerId);
                entity.setAttribute('position', `${worldPos.x} ${worldPos.y} ${worldPos.z}`);
                entity.classList.add('ar-3d-marker');
                
                // Create invisible anchor point (for positioning)
                const anchor = document.createElement('a-sphere');
                anchor.setAttribute('radius', '0.05');
                anchor.setAttribute('color', '#00ff88');
                anchor.setAttribute('opacity', '0.8');
                anchor.setAttribute('material', 'transparent: true');
                
                // Create floating info panel
                const panel = document.createElement('a-plane');
                panel.setAttribute('width', '1.5');
                panel.setAttribute('height', '2');
                panel.setAttribute('color', '#000000');
                panel.setAttribute('opacity', '0.9');
                panel.setAttribute('material', 'transparent: true; side: double');
                panel.setAttribute('position', '0 1 0'); // Float above anchor
                
                // Create border
                const border = document.createElement('a-plane');
                border.setAttribute('width', '1.6');
                border.setAttribute('height', '2.1');
                border.setAttribute('color', '#00ff88');
                border.setAttribute('opacity', '0.7');
                border.setAttribute('material', 'transparent: true; side: double');
                border.setAttribute('position', '0 1 -0.01');
                
                // Create title text
                const titleText = document.createElement('a-text');
                titleText.setAttribute('value', movieData.title);
                titleText.setAttribute('color', '#00ff88');
                titleText.setAttribute('align', 'center');
                titleText.setAttribute('width', '8');
                titleText.setAttribute('position', '0 1.6 0.01');
                titleText.setAttribute('wrap-count', '20');
                
                // Create info text
                const infoText = document.createElement('a-text');
                const year = movieData.release_date?.substring(0, 4) || '?';
                const rating = movieData.vote_average?.toFixed(1) || 'N/A';
                infoText.setAttribute('value', `${year} • ★${rating}/10`);
                infoText.setAttribute('color', '#ffffff');
                infoText.setAttribute('align', 'center');
                infoText.setAttribute('width', '6');
                infoText.setAttribute('position', '0 1.2 0.01');
                
                // Make panel always face camera (billboard effect)
                panel.setAttribute('look-at', '[camera]');
                border.setAttribute('look-at', '[camera]');
                titleText.setAttribute('look-at', '[camera]');
                infoText.setAttribute('look-at', '[camera]');
                
                // Add subtle floating animation
                entity.setAttribute('animation', {
                    property: 'rotation',
                    to: '0 360 0',
                    dur: 30000,
                    loop: true,
                    easing: 'linear'
                });
                
                panel.setAttribute('animation__float', {
                    property: 'position',
                    to: '0 1.1 0',
                    dir: 'alternate',
                    dur: 3000,
                    loop: true,
                    easing: 'easeInOutSine'
                });
                
                // Assemble entity
                entity.appendChild(anchor);
                entity.appendChild(border);
                entity.appendChild(panel);
                entity.appendChild(titleText);
                entity.appendChild(infoText);
                
                return entity;
            }

            create2DOverlayCard(movieData, markerId) {
                const card = document.createElement('div');
                card.className = 'movie-card overlay-card';
                card.id = `overlay-${markerId}`;
                
                // Initially hidden, will be positioned by tracking
                card.style.position = 'fixed';
                card.style.zIndex = '150';
                card.style.display = 'none';
                card.style.pointerEvents = 'auto';
                
                card.innerHTML = `
                    <div class="close-btn" onclick="window.arScanner.removeMarker('${markerId}')"></div>
                    <div class="movie-title">${movieData.title}</div>
                    <div class="movie-meta">📅 ${movieData.release_date?.substring(0, 4) || 'Unknown'}</div>
                    <div class="movie-meta">⭐ ${movieData.vote_average?.toFixed(1) || 'N/A'}/10</div>
                    <div class="movie-meta">🎬 ${movieData.director || 'Unknown'}</div>
                    <div class="movie-overview">${(movieData.overview || 'No synopsis available.').substring(0, 150)}...</div>
                `;
                
                return card;
            }

            startEntityTracking(markerId) {
                // Start tracking loop to project 3D entity to 2D screen position
                const trackingLoop = () => {
                    if (!this.movieMarkers.has(markerId)) {
                        // Stop tracking if marker is removed
                        return;
                    }
                    
                    this.update3DTo2DProjection(markerId);
                    requestAnimationFrame(trackingLoop);
                };
                
                // Start the tracking loop
                requestAnimationFrame(trackingLoop);
            }

            update3DTo2DProjection(markerId) {
                const markerData = this.movieMarkers.get(markerId);
                if (!markerData || !markerData.arEntity || !markerData.movieCard) return;
                
                try {
                    // Get 3D entity position
                    const entity = markerData.arEntity;
                    const worldPos = entity.getAttribute('position');
                    
                    if (!worldPos) return;
                    
                    // Project 3D world position to 2D screen coordinates
                    const screenPos = this.project3DToScreen(worldPos);
                    
                    if (screenPos && screenPos.visible) {
                        // Update 2D overlay position
                        markerData.movieCard.style.left = `${screenPos.x}px`;
                        markerData.movieCard.style.top = `${screenPos.y}px`;
                        markerData.movieCard.style.transform = `translateX(-50%) translateY(-100%) scale(${screenPos.scale})`;
                        markerData.movieCard.style.display = 'block';
                        markerData.movieCard.style.opacity = screenPos.opacity;
                    } else {
                        // Hide overlay when 3D marker is not visible
                        markerData.movieCard.style.display = 'none';
                    }
                    
                } catch (error) {
                    console.warn('⚠️ Error updating 3D projection:', error);
                }
            }

            project3DToScreen(worldPos) {
                try {
                    // Get camera and its Three.js object
                    const cameraEl = this.arCamera;
                    const camera = cameraEl.getObject3D('camera');
                    
                    if (!camera) return null;
                    
                    // Create Three.js vector from world position
                    const vector = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);
                    
                    // Project to screen coordinates
                    vector.project(camera);
                    
                    // Convert to screen pixels
                    const screenX = (vector.x * 0.5 + 0.5) * window.innerWidth;
                    const screenY = (vector.y * -0.5 + 0.5) * window.innerHeight;
                    
                    // Check if object is in front of camera
                    const inFront = vector.z < 1;
                    
                    // Calculate distance for scaling
                    const cameraPos = camera.position;
                    const distance = Math.sqrt(
                        Math.pow(worldPos.x - cameraPos.x, 2) +
                        Math.pow(worldPos.y - cameraPos.y, 2) +
                        Math.pow(worldPos.z - cameraPos.z, 2)
                    );
                    
                    // Calculate scale and opacity based on distance
                    const scale = Math.max(0.3, Math.min(1.2, 2.5 / distance));
                    const opacity = Math.max(0.3, Math.min(1, 4 / distance));
                    
                    // Check if position is reasonably on screen
                    const onScreen = screenX > -200 && screenX < window.innerWidth + 200 &&
                                    screenY > -200 && screenY < window.innerHeight + 200;
                    
                    const visible = inFront && onScreen && distance < 10;
                    
                    return {
                        x: screenX,
                        y: screenY,
                        scale: scale,
                        opacity: opacity,
                        distance: distance,
                        visible: visible
                    };
                    
                } catch (error) {
                    console.warn('⚠️ Error in 3D projection:', error);
                    return null;
                }
            }

            removeMarker(markerId) {
                const markerData = this.movieMarkers.get(markerId);
                if (markerData) {
                    // Remove 3D entity
                    if (markerData.arEntity && markerData.arEntity.parentNode) {
                        markerData.arEntity.parentNode.removeChild(markerData.arEntity);
                    }
                    
                    // Remove 2D overlay
                    if (markerData.movieCard && markerData.movieCard.parentNode) {
                        markerData.movieCard.style.transition = 'all 0.3s ease';
                        markerData.movieCard.style.opacity = '0';
                        markerData.movieCard.style.transform = 'translateX(-50%) translateY(-100%) scale(0.3)';
                        
                        setTimeout(() => {
                            if (markerData.movieCard.parentNode) {
                                markerData.movieCard.parentNode.removeChild(markerData.movieCard);
                            }
                        }, 300);
                    }
                    
                    this.movieMarkers.delete(markerId);
                    console.log('🗑️ Removed 3D anchored marker:', markerId);
                }
            }

            clearAllMarkers() {
                console.log('🧹 Clearing all 3D anchored markers...');
                this.movieMarkers.forEach((markerData, markerId) => {
                    this.removeMarker(markerId);
                });
                this.updateStatus('All markers cleared');
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
        }

        // Initialize when page loads
        document.addEventListener('DOMContentLoaded', () => {
            window.arScanner = new FreeARMovieScanner();
        });

        // Add exit animation CSS
        const exitStyle = document.createElement('style');
        exitStyle.textContent = `
            @keyframes cardSlideOut {
                to {
                    opacity: 0;
                    transform: translateX(-50%) translateY(-50%) scale(0.3) rotateY(-180deg);
                }
            }
        `;
        document.head.appendChild(exitStyle);