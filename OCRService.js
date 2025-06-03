// src/services/OCRService.js - Vision API Only (Simplified)

import { VisionService } from './VisionService.js';

export class OCRService {
    constructor() {
        this.isInitialized = false;
        this.visionService = new VisionService();
    }
    
    async init() {
        try {
            console.log('👁️ Initializing Vision-Only OCR Service...');
            
            // Initialize Vision Service
            await this.visionService.init();
            console.log('👁️ Vision service status:', this.visionService.getStatus());
            
            if (!this.visionService.isAvailable) {
                throw new Error('Google Vision API is required but not available. Please check your setup.');
            }
            
            this.isInitialized = true;
            console.log('✅ Vision-Only OCR Service initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Vision OCR Service:', error);
            throw new Error(`Vision OCR initialization failed: ${error.message}`);
        }
    }
    
    async extractTitle(canvas, progressCallback = null) {
        if (!this.isInitialized) {
            throw new Error('Vision OCR Service not initialized');
        }
        
        try {
            console.log('👁️ Extracting movie title and year using Google Vision API...');
            
            if (progressCallback) {
                progressCallback(25);
            }
            
            // Use Google Vision API directly
            const visionResult = await this.visionService.extractText(canvas);
            
            if (progressCallback) {
                progressCallback(75);
            }
            
            if (visionResult) {
                console.log(`✅ Vision API extracted: "${visionResult}"`);
                
                if (progressCallback) {
                    progressCallback(100);
                }
                
                return visionResult;
            } else {
                throw new Error('Google Vision API could not extract any text from the image');
            }
            
        } catch (error) {
            console.error('❌ Vision title extraction failed:', error);
            throw new Error(`Vision OCR failed: ${error.message}`);
        }
    }
    
    async testOCR(testText = 'Test Movie Title') {
        if (!this.isInitialized) {
            throw new Error('Vision OCR Service not initialized');
        }
        
        try {
            // Create a test canvas with movie-like text
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = 600;
            canvas.height = 200;
            
            // Movie poster style background
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Large movie title text
            ctx.fillStyle = 'white';
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(testText, 300, 80);
            
            // Year text
            ctx.font = '32px Arial';
            ctx.fillText('(2024)', 300, 130);
            
            // Test Vision OCR
            const result = await this.extractTitle(canvas);
            console.log(`🧪 Vision OCR Test Result: "${result}"`);
            
            return result && result.toLowerCase().includes(testText.toLowerCase());
            
        } catch (error) {
            console.error('❌ Vision OCR test failed:', error);
            return false;
        }
    }
    
    async destroy() {
        console.log('🗑️ Destroying Vision OCR Service...');
        this.isInitialized = false;
        console.log('✅ Vision OCR Service destroyed');
    }
    
    getStatus() {
        return {
            initialized: this.isInitialized,
            visionAvailable: this.visionService?.isAvailable || false,
            method: 'Google Vision API Only'
        };
    }
}