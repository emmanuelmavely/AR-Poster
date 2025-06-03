// src/services/VisionService.js - Updated to use Multi-OCR
import { MultiOCRService } from './MultiOCRService.js';

export class VisionService {
    constructor() {
        this.multiOCR = new MultiOCRService();
        this.isInitialized = false;
    }

    async init() {
        console.log('👁️ Initializing Vision Service with Multi-OCR...');
        try {
            console.log('🔄 Initializing Multi-OCR component...');
            await this.multiOCR.init();
            this.isInitialized = true;
            console.log('✅ Multi-OCR Vision Service ready');
        } catch (error) {
            console.error('❌ Failed to initialize Multi-OCR:', error);
            console.error('❌ Multi-OCR init error stack:', error.stack);
            console.log('⚠️ Will use fallback single Vision API only');
            this.isInitialized = false;
        }
    }

    async extractText(canvas) {
        console.log('👁️ VisionService.extractText called');
        
        if (!this.isInitialized) {
            console.warn('⚠️ Multi-OCR not initialized, using fallback single Vision API');
            return this.fallbackToSingleVision(canvas);
        }

        try {
            console.log('🚀 Starting Multi-OCR text extraction...');
            const result = await this.multiOCR.extractTextMultiOCR(canvas);
            console.log('📝 Multi-OCR completed, result:', result);
            
            if (result) {
                console.log(`✅ Multi-OCR success: "${result}"`);
                return result;
            } else {
                console.log('⚠️ Multi-OCR returned null, falling back to single Vision API');
                return this.fallbackToSingleVision(canvas);
            }
        } catch (error) {
            console.error('❌ Multi-OCR failed with error:', error);
            console.error('❌ Multi-OCR error stack:', error.stack);
            console.log('🔄 Falling back to single Vision API...');
            return this.fallbackToSingleVision(canvas);
        }
    }

    async fallbackToSingleVision(canvas) {
        try {
            console.log('🔄 Using fallback single Vision API...');
            const imageBase64 = canvas.toDataURL('image/png').split(',')[1];
            
            const response = await fetch('/api/vision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageBase64 })
            });

            const result = await response.json();
            
            if (result.success && result.text) {
                console.log(`✅ Fallback Vision result: "${result.text}"`);
                return result.text;
            } else {
                console.log('❌ Vision API returned no text');
                return null;
            }
        } catch (error) {
            console.error('❌ Fallback Vision API failed:', error);
            return null;
        }
    }

    async cleanup() {
        if (this.multiOCR) {
            await this.multiOCR.cleanup();
        }
    }
}