// src/services/MultiOCRService.js - Simplified OCR with fallback to Google Vision only
export class MultiOCRService {
    constructor() {
        this.isInitialized = false;
    }

    async init() {
        console.log('🔄 Initializing Multi-OCR Service (Vision API Only Mode)...');
        
        try {
            // For now, we'll skip Tesseract.js due to CDN import issues
            // and focus on Google Vision API which is more reliable
            console.log('⚠️ Tesseract.js skipped due to environment constraints');
            console.log('✅ Multi-OCR Service initialized (Vision API only)');
            this.isInitialized = true;
        } catch (error) {
            console.warn('⚠️ Failed to initialize Multi-OCR:', error);
            this.isInitialized = false;
        }
    }

    async extractTextMultiOCR(imageCanvas) {
        console.log('🔀 Starting OCR extraction (Vision API only)...');
        const startTime = Date.now();
        
        // Convert canvas to base64 for Google Vision API
        const imageBase64 = imageCanvas.toDataURL('image/png').split(',')[1];
        
        console.log('🚀 Running Google Vision API...');
        
        try {
            const result = await this.runGoogleVision(imageBase64);
            const totalTime = Date.now() - startTime;
            
            console.log(`⏱️ OCR completed in ${totalTime}ms`);
            
            if (result && result.text) {
                console.log('✅ Vision API Success:');
                console.log(`   Text: "${result.text}"`);
                console.log(`   Confidence: High (Google Vision)`);
                console.log(`   Time: ${result.time}ms`);
                return result.text;
            } else {
                console.log('❌ No valid OCR results obtained');
                return null;
            }
            
        } catch (error) {
            console.error('❌ OCR extraction failed:', error);
            return null;
        }
    }

    async runGoogleVision(imageBase64) {
        const startTime = Date.now();
        
        try {
            console.log('📡 Calling Google Vision API...');
            const response = await fetch('/api/vision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageBase64 })
            });
            
            if (!response.ok) {
                throw new Error(`Vision API returned ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            const time = Date.now() - startTime;
            
            if (result.success && result.text) {
                console.log(`✅ Google Vision (${time}ms): "${result.text}"`);
                return {
                    engine: 'Google Vision',
                    text: result.text.trim().toUpperCase(),
                    confidence: 0.9, // Google Vision is generally high confidence
                    time: time,
                    fullResult: result
                };
            } else {
                console.log('⚠️ Google Vision returned no text');
                return null;
            }
        } catch (error) {
            console.warn(`❌ Google Vision failed: ${error.message}`);
            throw error;
        }
    }

    // Fallback method for when we can't use advanced OCR
    async extractTextSimple(imageCanvas) {
        console.log('🔄 Using simple text extraction...');
        return await this.extractTextMultiOCR(imageCanvas);
    }

    async cleanup() {
        console.log('🧹 Cleaning up Multi-OCR Service...');
        this.isInitialized = false;
        console.log('✅ Multi-OCR Service cleaned up');
    }

    getStatus() {
        return {
            initialized: this.isInitialized,
            engines: ['Google Vision API'],
            tesseractAvailable: false,
            ocrSpaceAvailable: false
        };
    }
}