// Simplified Vision Service - Direct Google Vision API integration  
export class VisionService {  
    constructor() {  
        this.isInitialized = false;  
        this.retryCount = 0;  
        this.maxRetries = 3;  
    }  
  
    async init() {  
        console.log('👁️ Initializing Vision Service...');  
        try {  
            // Test Vision API connectivity  
            const testResponse = await fetch('/api/test-vision');  
            const testResult = await testResponse.json();  
              
            if (!testResult.visionConfigured) {  
                throw new Error('Google Vision API credentials not configured');  
            }  
              
            this.isInitialized = true;  
            console.log('✅ Vision Service initialized successfully');  
            return true;  
        } catch (error) {  
            console.error('❌ Vision Service initialization failed:', error);  
            this.isInitialized = false;  
            throw new Error(`Vision API setup error: ${error.message}`);  
        }  
    }  
  
    async extractText(canvas) {  
        if (!this.isInitialized) {  
            throw new Error('Vision Service not initialized. Call init() first.');  
        }  
  
        try {  
            console.log('👁️ Starting text extraction...');  
            const imageBase64 = canvas.toDataURL('image/png').split(',')[1];  
              
            const response = await this.callVisionAPI(imageBase64);  
              
            if (response && response.text) {  
                console.log(`✅ Text extracted: "${response.text}"`);  
                this.retryCount = 0; // Reset on success  
                return response.text;  
            } else {  
                return this.handleNoTextDetected();  
            }  
        } catch (error) {  
            return this.handleExtractionError(error, canvas);  
        }  
    }  
  
    async callVisionAPI(imageBase64) {  
        const response = await fetch('/api/vision', {  
            method: 'POST',  
            headers: { 'Content-Type': 'application/json' },  
            body: JSON.stringify({ image: imageBase64 })  
        });  
  
        if (!response.ok) {  
            throw new Error(`Vision API returned ${response.status}: ${response.statusText}`);  
        }  
  
        return await response.json();  
    }  
  
    handleNoTextDetected() {  
        const suggestions = [  
            "Move closer to the poster",  
            "Ensure good lighting conditions",   
            "Hold camera steady",  
            "Try a different angle",  
            "Make sure text is clearly visible"  
        ];  
          
        const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];  
        throw new Error(`No text detected. Try: ${randomSuggestion}`);  
    }  
  
    async handleExtractionError(error, canvas) {  
        console.error('❌ Vision API error:', error);
        console.error('Stack trace:', error.stack);  // Add stack trace
        console.error('Error details:', {
            message: error.message,
            name: error.name,
            retryCount: this.retryCount
        });
              
        if (this.retryCount < this.maxRetries) {  
            this.retryCount++;  
            console.log(`🔄 Retrying... (${this.retryCount}/${this.maxRetries})`);  
            await new Promise(resolve => setTimeout(resolve, 1000 * this.retryCount));  
            return this.extractText(canvas);  
        }  
              
        this.retryCount = 0;  
        throw new Error(`Vision API failed after ${this.maxRetries} attempts: ${error.message}`);  
    }  
  
    getStatus() {  
        return {  
            initialized: this.isInitialized,  
            service: 'Google Vision API',  
            retryCount: this.retryCount  
        };  
    }  
  
    // Cleanup method for compatibility  
    async cleanup() {  
        console.log('🧹 Cleaning up Vision Service...');  
        this.isInitialized = false;  
        this.retryCount = 0;  
        console.log('✅ Vision Service cleaned up');  
    }  
}