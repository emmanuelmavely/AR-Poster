import express from 'express';
import { existsSync } from 'fs';
import { config } from 'dotenv';
import cors from 'cors';

config();

const app = express();
const port = 8001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

// Health check
app.get('/api/health', (req, res) => {
    const tmdbKey = process.env.VITE_TMDB_API_KEY;
    const hasCredentials = existsSync('google-vision-credentials.json');
    const hasVisionHandler = existsSync('api/vision.js');
    
    const health = {
        status: 'OK',
        server: 'WebAR Movie Scanner v3',
        port: port,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        
        // Component Status
        components: {
            tmdb: {
                configured: !!tmdbKey,
                status: tmdbKey ? 'ready' : 'missing_api_key'
            },
            vision: {
                configured: hasCredentials && hasVisionHandler,
                credentials: hasCredentials,
                handler: hasVisionHandler,
                status: (hasCredentials && hasVisionHandler) ? 'ready' : 'incomplete'
            },
            server: {
                status: 'running',
                memory: process.memoryUsage(),
                node_version: process.version
            }
        },
        
        // Overall readiness
        ready: tmdbKey && hasCredentials && hasVisionHandler
    };
    
    console.log('🏥 Health check requested:', {
        ready: health.ready,
        tmdb: health.components.tmdb.status,
        vision: health.components.vision.status
    });
    
    res.json(health);
});

// Environment variables endpoint
app.get('/api/env', (req, res) => {
    const apiKey = process.env.VITE_TMDB_API_KEY;
    
    if (!apiKey) {
        return res.status(500).json({
            error: 'VITE_TMDB_API_KEY not found',
            message: 'Please check your .env file'
        });
    }
    
    res.json({
        VITE_TMDB_API_KEY: apiKey
    });
});

// Test Vision API endpoint
app.get('/api/test-vision', (req, res) => {
    const hasCredentials = existsSync('google-vision-credentials.json');
    const hasVisionHandler = existsSync('api/vision.js');
    
    res.json({
        success: true,
        visionConfigured: hasCredentials,
        visionHandler: hasVisionHandler,
        credentialsFile: hasCredentials ? 'found' : 'missing',
        handlerFile: hasVisionHandler ? 'found' : 'missing'
    });
});

// Vision API endpoint
app.post('/api/vision', async (req, res) => {
    try {
        const { default: visionHandler } = await import('./api/vision.js');
        await visionHandler(req, res);
    } catch (error) {
        console.error('Vision API error:', error);
        res.status(500).json({
            success: false,
            error: 'Vision API processing failed'
        });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('Vision:', existsSync('google-vision-credentials.json') ? 'OK' : 'Missing credentials');
});