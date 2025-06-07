// config.js - Simple Configuration

// Configure console logging
const DEBUG = true; // Set to false in production

if (DEBUG) {
    console.debug = console.log;
} else {
    console.debug = function() {}; // Disable debug logs in production
}

let API_KEY = null;

// Load API key from server
async function loadApiKey() {
    try {
        console.log('🔑 Loading API key from server...');
        const response = await fetch('/api/env');
        if (response.ok) {
            const data = await response.json();
            API_KEY = data.VITE_TMDB_API_KEY;
            console.log('✅ API key loaded from server successfully');
            return API_KEY;
        } else {
            console.warn('⚠️ Server API key endpoint returned:', response.status);
        }
    } catch (error) {
        console.warn('⚠️ Could not load API key from server:', error.message);
    }
    return null;
}

// Load immediately and wait for it
const apiKeyPromise = loadApiKey();

export const CONFIG = {
    TMDB: {
        BASE_URL: 'https://api.themoviedb.org/3',
        IMAGE_BASE_URL: 'https://image.tmdb.org/t/p',
        IMAGE_SIZES: {
            POSTER: 'w500',
            BACKDROP: 'w1280'
        },
        ENDPOINTS: {
            SEARCH_MOVIE: '/search/movie',
            MOVIE_DETAILS: '/movie'
        }
    },
    
    API_KEYS: {
        get TMDB() {
            return API_KEY;
        },
        // Async getter for when you need to ensure the key is loaded
        async getTMDB() {
            if (API_KEY) return API_KEY;
            return await apiKeyPromise;
        }
    },

    GENRES: {
        28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
        80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
        14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
        9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 53: 'Thriller'
    }
};

export default Object.freeze(CONFIG);