// server-local.js - Simple Express server for testing
import express from 'express';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config } from 'dotenv';

// Load environment variables from .env file - Force it!
console.log('📁 Loading .env file...');
const result = config();
if (result.error) {
    console.error('❌ Failed to load .env file:', result.error);
} else {
    console.log('✅ .env file loaded successfully');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 8001; // Use different port to avoid conflicts

// Make environment variables available to frontend
app.get('/api/env', (req, res) => {
    const apiKey = process.env.VITE_TMDB_API_KEY;
    
    if (!apiKey) {
        return res.status(500).json({
            error: 'VITE_TMDB_API_KEY not found in server environment',
            message: 'Please check your .env file'
        });
    }
    
    res.json({
        VITE_TMDB_API_KEY: apiKey, // Send the actual key
        NODE_ENV: process.env.NODE_ENV || 'development'
    });
});

// Inject environment variables into HTML
app.use((req, res, next) => {
    if (req.path === '/' || req.path.endsWith('.html')) {
        // For HTML requests, we'll inject environment variables
        res.locals.env = {
            VITE_TMDB_API_KEY: process.env.VITE_TMDB_API_KEY
        };
    }
    next();
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

// Enable CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Test Vision API endpoint
app.get('/api/test-vision', (req, res) => {
    const hasCredentials = existsSync('google-vision-credentials.json');
    const hasVisionHandler = existsSync('api/vision.mjs');
    
    res.json({
        success: true,
        visionConfigured: hasCredentials,
        visionHandler: hasVisionHandler,
        credentialsFile: hasCredentials ? 'found' : 'missing',
        handlerFile: hasVisionHandler ? 'found' : 'missing',
        timestamp: new Date().toISOString(),
        instructions: [
            hasCredentials ? '✅ Credentials OK' : '❌ Place google-vision-credentials.json in project root',
            hasVisionHandler ? '✅ Handler OK' : '❌ Create api/vision.mjs file'
        ]
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK',
        server: 'Express with Vision API',
        port: port,
        timestamp: new Date().toISOString(),
        vision: existsSync('google-vision-credentials.json') ? 'configured' : 'not configured'
    });
});

// Vision API endpoint - Connect to real handler
app.post('/api/vision', async (req, res) => {
    console.log('👁️ Vision API called - routing to real handler');
    
    try {
        // Import the real Vision API handler
        const { default: visionHandler } = await import('./api/vision.mjs');
        
        // Call the real handler
        await visionHandler(req, res);
    } catch (error) {
        console.error('❌ Vision API handler error:', error);
        console.error('❌ Error stack:', error.stack);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error details:', error.details);
        
        if (error.message.includes('Cannot resolve module')) {
            return res.status(500).json({
                success: false,
                error: 'Vision API handler not found. Please check api/vision.mjs file.'
            });
        }
        
        res.status(500).json({
            success: false,
            error: 'Vision API processing failed',
            details: error.message,
            code: error.code || 'UNKNOWN_ERROR'
        });
    }
});

// Start server
app.listen(port, '0.0.0.0', () => {
    console.log('🚀 Express server with Vision API running at:');
    console.log(`   http://localhost:${port}`);
    console.log(`   http://127.0.0.1:${port}`);
    
    // Check environment variables
    console.log('\n🔑 Environment variables:');
    const apiKey = process.env.VITE_TMDB_API_KEY;
    if (apiKey) {
        console.log(`   VITE_TMDB_API_KEY: ✅ Set (${apiKey.substring(0, 8)}...)`);
    } else {
        console.log('   VITE_TMDB_API_KEY: ❌ Missing');
        console.log('💡 Check if .env file exists and contains VITE_TMDB_API_KEY');
    }
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    
    // Check files
    if (existsSync('google-vision-credentials.json')) {
        console.log('✅ Google Vision credentials found');
    } else {
        console.log('⚠️ Google Vision credentials missing');
        console.log('💡 Place google-vision-credentials.json in project root');
    }
    
    console.log('\n🧪 Test endpoints:');
    console.log(`   GET  http://localhost:${port}/api/health`);
    console.log(`   GET  http://localhost:${port}/api/test-vision`);
    console.log(`   GET  http://localhost:${port}/api/env`);
    console.log(`   POST http://localhost:${port}/api/vision`);
    
    console.log('\n🎯 To use with your app:');
    console.log(`   1. Stop other servers`);
    console.log(`   2. Open http://localhost:${port}`);
    console.log(`   3. Upload movie poster image`);
});