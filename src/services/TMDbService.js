// src/services/TMDbService.js - Fixed for async API key loading
import { CONFIG } from '../config.js';

export class TMDbService {
    constructor() {
        this.baseUrl = CONFIG.TMDB.BASE_URL;
        this.imageBaseUrl = `${CONFIG.TMDB.IMAGE_BASE_URL}/${CONFIG.TMDB.IMAGE_SIZES.POSTER}`;
        this.cache = new Map();
        this.rateLimiter = {
            requests: 0,
            resetTime: Date.now() + 10000,
            maxRequestsPer10Sec: 40
        };
        this.apiKey = null;
    }
    
    async getApiKey() {
        if (this.apiKey) return this.apiKey;
        
        // Try to get from CONFIG first
        if (CONFIG.API_KEYS.TMDB) {
            this.apiKey = CONFIG.API_KEYS.TMDB;
            return this.apiKey;
        }
        
        // If not available, fetch from server
        try {
            const response = await fetch('/api/env');
            if (response.ok) {
                const data = await response.json();
                this.apiKey = data.VITE_TMDB_API_KEY;
                console.log('✅ TMDb API key loaded');
                return this.apiKey;
            }
        } catch (error) {
            console.error('❌ Failed to load API key:', error);
        }
        
        throw new Error('TMDb API key not available');
    }

    // Add the missing cleanTitle method that app.js expects
    cleanTitle(query) {
        if (!query || typeof query !== 'string') {
            return '';
        }
        
        return query
            .replace(/[^\w\s:-]/g, ' ')  // Remove special chars except letters, numbers, spaces, colons, hyphens
            .replace(/\s+/g, ' ')        // Replace multiple spaces with single space
            .trim()                      // Remove leading/trailing spaces
            .toUpperCase();              // Convert to uppercase for consistency
    }

    async searchMovie(query) {
        console.log('🎬 Searching for movie/TV:', `"${query}"`);
        
        const cleanQuery = this.cleanTitle(query);
        
        if (!cleanQuery) {
            console.log('❌ Empty query after cleaning');
            return null;
        }

        try {
            const apiKey = await this.getApiKey();
            await this.checkRateLimit();
            
            // Try movie search first
            console.log('🎭 Trying movie search...');
            let searchUrl = `${this.baseUrl}/search/movie?api_key=${apiKey}&query=${encodeURIComponent(cleanQuery)}`;
            let response = await fetch(searchUrl);
            
            if (!response.ok) {
                console.error('❌ TMDb API error:', response.status, response.statusText);
                throw new Error(`TMDb API error: ${response.status}`);
            }

            let data = await response.json();

            // If no movie results, try TV search
            if (!data.results || data.results.length === 0) {
                console.log('📺 No movies found, trying TV search...');
                await this.checkRateLimit();
                
                searchUrl = `${this.baseUrl}/search/tv?api_key=${apiKey}&query=${encodeURIComponent(cleanQuery)}`;
                response = await fetch(searchUrl);
                
                if (response.ok) {
                    data = await response.json();
                    
                    if (data.results && data.results.length > 0) {
                        const tvShow = data.results[0];
                        console.log('✅ Found TV show:', tvShow.name, `(${tvShow.first_air_date?.substring(0, 4) || 'Unknown year'})`);
                        
                        // Convert TV show to movie-like format
                        return this.formatTVShowAsMovie(tvShow);
                    }
                }
            } else {
                const movie = data.results[0];
                console.log('✅ Found movie:', movie.title, `(${movie.release_date?.substring(0, 4) || 'Unknown year'})`);
                
                // Get additional movie details
                const detailedMovie = await this.getMovieDetails(movie.id);
                return detailedMovie;
            }

            console.log('❌ No results found for:', `"${cleanQuery}"`);
            return null;
            
        } catch (error) {
            console.error('❌ TMDb search failed:', error.message);
            throw error;
        }
    }
    
    formatTVShowAsMovie(tvShow) {
        // Convert TV show data to movie-like format for display
        return {
            id: tvShow.id,
            title: tvShow.name,
            original_title: tvShow.original_name,
            overview: tvShow.overview || 'No synopsis available.',
            release_date: tvShow.first_air_date,
            poster_path: tvShow.poster_path ? `${this.imageBaseUrl}${tvShow.poster_path}` : null,
            backdrop_path: tvShow.backdrop_path ? `${this.imageBaseUrl}${tvShow.backdrop_path}` : null,
            vote_average: tvShow.vote_average || 0,
            vote_count: tvShow.vote_count || 0,
            runtime: null, // TV shows don't have runtime
            original_language: tvShow.original_language,
            genres: tvShow.genre_ids ? tvShow.genre_ids.map(id => this.getGenreName(id)).filter(Boolean) : [],
            genre_ids: tvShow.genre_ids || [],
            director: 'TV Series', // TV shows don't have directors
            cast: [], // Would need separate API call for TV credits
            popularity: tvShow.popularity,
            adult: tvShow.adult || false,
            budget: null,
            revenue: null,
            tagline: null,
            status: 'TV Series'
        };
    }
    
    async getMovieDetails(movieId) {
        try {
            const cacheKey = `details_${movieId}`;
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }
            
            const apiKey = await this.getApiKey();
            await this.checkRateLimit();
            
            const url = `${this.baseUrl}/movie/${movieId}?api_key=${apiKey}&language=en-US&append_to_response=credits,genres`;
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Failed to get movie details: ${response.status}`);
            }
            
            const movie = await response.json();
            
            // Process and format the movie data
            const processedMovie = this.processMovieData(movie);
            
            // Cache the result
            this.cache.set(cacheKey, processedMovie);
            
            return processedMovie;
            
        } catch (error) {
            console.error('❌ Failed to get movie details:', error.message);
            throw error;
        }
    }
    
    processMovieData(movie) {
        // Extract director from crew
        const director = movie.credits?.crew?.find(person => person.job === 'Director');
        
        // Get main cast (first 5 actors)
        const mainCast = movie.credits?.cast?.slice(0, 5) || [];
        
        // Process genres
        let genres = [];
        if (movie.genres && movie.genres.length > 0) {
            genres = movie.genres.map(genre => genre.name);
        } else if (movie.genre_ids && movie.genre_ids.length > 0) {
            genres = movie.genre_ids.map(id => this.getGenreName(id)).filter(Boolean);
        }
        
        return {
            id: movie.id,
            title: movie.title,
            original_title: movie.original_title,
            overview: movie.overview || 'No synopsis available.',
            release_date: movie.release_date,
            poster_path: movie.poster_path ? `${this.imageBaseUrl}${movie.poster_path}` : null,
            backdrop_path: movie.backdrop_path ? `${this.imageBaseUrl}${movie.backdrop_path}` : null,
            vote_average: movie.vote_average || 0,
            vote_count: movie.vote_count || 0,
            runtime: movie.runtime,
            original_language: movie.original_language,
            genres: genres,
            genre_ids: movie.genre_ids || [],
            director: director ? director.name : 'Unknown',
            cast: mainCast.map(actor => actor.name),
            popularity: movie.popularity,
            adult: movie.adult,
            budget: movie.budget,
            revenue: movie.revenue,
            tagline: movie.tagline,
            status: movie.status
        };
    }
    
    getGenreName(genreId) {
        return CONFIG.GENRES[genreId] || null;
    }
    
    // Keep the original method name for backward compatibility
    cleanSearchTitle(title) {
        return this.cleanTitle(title);
    }
    
    findBestMatch(results, searchTitle) {
        if (results.length === 0) return null;
        
        const scoredResults = results.map(movie => {
            const titleScore = this.calculateSimilarity(searchTitle.toLowerCase(), movie.title.toLowerCase());
            const originalTitleScore = movie.original_title ? 
                this.calculateSimilarity(searchTitle.toLowerCase(), movie.original_title.toLowerCase()) : 0;
            
            const popularityScore = Math.min(movie.popularity / 100, 1);
            const voteScore = Math.min(movie.vote_count / 1000, 1);
            
            const totalScore = Math.max(titleScore, originalTitleScore) * 0.7 + 
                             popularityScore * 0.2 + 
                             voteScore * 0.1;
            
            return {
                ...movie,
                score: totalScore
            };
        });
        
        scoredResults.sort((a, b) => b.score - a.score);
        console.log(`🎯 Best match: "${scoredResults[0].title}" (score: ${scoredResults[0].score.toFixed(2)})`);
        
        return scoredResults[0];
    }
    
    calculateSimilarity(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        const maxLength = Math.max(str1.length, str2.length);
        return maxLength === 0 ? 1 : (maxLength - matrix[str2.length][str1.length]) / maxLength;
    }
    
    async checkRateLimit() {
        const now = Date.now();
        
        if (now > this.rateLimiter.resetTime) {
            this.rateLimiter.requests = 0;
            this.rateLimiter.resetTime = now + 10000;
        }
        
        if (this.rateLimiter.requests >= this.rateLimiter.maxRequestsPer10Sec) {
            const waitTime = this.rateLimiter.resetTime - now;
            console.log(`⏳ Rate limit reached, waiting ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            this.rateLimiter.requests = 0;
            this.rateLimiter.resetTime = Date.now() + 10000;
        }
        
        this.rateLimiter.requests++;
    }
    
    clearCache() {
        this.cache.clear();
        console.log('🗑️ TMDb cache cleared');
    }
    
    async testConnection() {
        try {
            console.log('🔗 Testing TMDb API connection...');
            const apiKey = await this.getApiKey();
            const url = `${this.baseUrl}/configuration?api_key=${apiKey}`;
            const response = await fetch(url);
            
            if (response.ok) {
                console.log('✅ TMDb API connection successful');
                return true;
            } else {
                console.error('❌ TMDb API connection failed:', response.status);
                return false;
            }
        } catch (error) {
            console.error('❌ TMDb API test failed:', error.message);
            return false;
        }
    }
}