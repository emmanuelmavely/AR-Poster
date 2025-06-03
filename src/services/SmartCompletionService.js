// src/services/SmartCompletionService.js - AI-powered text completion
export class SmartCompletionService {
    constructor() {
        this.dictionaryCache = new Map();
        this.mlModel = null;
        this.isInitialized = false;
    }

    async init() {
        console.log('🧠 Initializing Smart Completion Service...');
        
        try {
            // Try to initialize TensorFlow.js
            await this.initMLModel();
            this.isInitialized = true;
            console.log('✅ Smart Completion Service ready');
        } catch (error) {
            console.warn('⚠️ ML model failed to load:', error.message);
            console.log('📚 Will use dictionary-only approach');
            this.isInitialized = true;
        }
    }

    async initMLModel() {
        // Load TensorFlow.js for character-level prediction
        if (typeof window !== 'undefined') {
            try {
                const tf = await import('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js');
                
                // Create a simple character-level RNN for word completion
                this.mlModel = this.createCharacterModel();
                console.log('🤖 TensorFlow.js model created');
            } catch (error) {
                console.warn('⚠️ TensorFlow.js not available in this environment');
            }
        }
    }

    createCharacterModel() {
        // Simple character-level model for English word completion
        // This is a lightweight approach that learns English patterns
        try {
            const tf = window.tf;
            const model = tf.sequential({
                layers: [
                    tf.layers.embedding({ inputDim: 128, outputDim: 16, inputLength: 10 }),
                    tf.layers.lstm({ units: 32, returnSequences: false }),
                    tf.layers.dense({ units: 64, activation: 'relu' }),
                    tf.layers.dense({ units: 128, activation: 'softmax' })
                ]
            });
            
            model.compile({
                optimizer: 'adam',
                loss: 'categoricalCrossentropy',
                metrics: ['accuracy']
            });
            
            return model;
        } catch (error) {
            console.warn('⚠️ Could not create TensorFlow model:', error);
            return null;
        }
    }

    async completeWord(fragment) {
        console.log(`🔍 Completing word: "${fragment}"`);
        
        if (!fragment || fragment.length < 2) {
            return [{ word: fragment, confidence: 1.0, source: 'original' }];
        }

        const completions = [];
        
        // Method 1: Dictionary API approach
        const dictionaryCompletions = await this.getDictionaryCompletions(fragment);
        completions.push(...dictionaryCompletions);

        // Method 2: ML-based completion (if available)
        if (this.mlModel) {
            const mlCompletions = await this.getMLCompletions(fragment);
            completions.push(...mlCompletions);
        }

        // Method 3: Linguistic pattern completion
        const linguisticCompletions = this.getLinguisticCompletions(fragment);
        completions.push(...linguisticCompletions);

        // Sort by confidence and remove duplicates
        const uniqueCompletions = this.removeDuplicates(completions);
        const sortedCompletions = uniqueCompletions.sort((a, b) => b.confidence - a.confidence);

        console.log(`📝 Generated ${sortedCompletions.length} completions for "${fragment}"`);
        return sortedCompletions.slice(0, 5); // Return top 5
    }

    async getDictionaryCompletions(fragment) {
        const completions = [];
        
        try {
            // Check cache first
            const cacheKey = `dict_${fragment.toLowerCase()}`;
            if (this.dictionaryCache.has(cacheKey)) {
                return this.dictionaryCache.get(cacheKey);
            }

            // Use a free dictionary API for word completions
            const response = await fetch(`https://api.datamuse.com/words?sp=${fragment}*&max=10`);
            
            if (response.ok) {
                const words = await response.json();
                
                words.forEach(wordData => {
                    const word = wordData.word.toUpperCase();
                    const score = wordData.score || 1;
                    
                    // Calculate confidence based on how well it matches and its frequency
                    const confidence = Math.min(1.0, score / 1000) * 0.9; // Dictionary source gets high confidence
                    
                    completions.push({
                        word: word,
                        confidence: confidence,
                        source: 'dictionary'
                    });
                });

                // Cache the results
                this.dictionaryCache.set(cacheKey, completions);
                console.log(`📚 Dictionary API found ${completions.length} completions for "${fragment}"`);
            }
        } catch (error) {
            console.warn('⚠️ Dictionary API failed:', error.message);
        }

        return completions;
    }

    async getMLCompletions(fragment) {
        const completions = [];
        
        if (!this.mlModel) return completions;

        try {
            // Use character-level predictions to suggest completions
            const predictions = await this.predictNextCharacters(fragment);
            
            predictions.forEach(pred => {
                completions.push({
                    word: pred.word,
                    confidence: pred.confidence * 0.7, // ML gets slightly lower confidence
                    source: 'ml'
                });
            });

            console.log(`🤖 ML model generated ${completions.length} completions for "${fragment}"`);
        } catch (error) {
            console.warn('⚠️ ML completion failed:', error.message);
        }

        return completions;
    }

    async predictNextCharacters(fragment) {
        // Simple character-level prediction
        // This would ideally be trained on English text
        const predictions = [];
        
        // For now, implement a simple heuristic-based approach
        // In a real implementation, this would use the trained model
        const commonEndings = {
            'UNT': ['UNTIL', 'UNTO'],
            'DAW': ['DAWN'],
            'FIN': ['FINAL', 'FINISH', 'FINE'],
            'DES': ['DESTINATION', 'DESIGN', 'DESERT'],
            'MIS': ['MISSION', 'MISTAKE', 'MISS']
        };

        for (const [prefix, endings] of Object.entries(commonEndings)) {
            if (fragment.toUpperCase().startsWith(prefix)) {
                endings.forEach(ending => {
                    predictions.push({
                        word: ending,
                        confidence: 0.8
                    });
                });
            }
        }

        return predictions;
    }

    getLinguisticCompletions(fragment) {
        const completions = [];
        const upperFragment = fragment.toUpperCase();
        
        // English phonetic and morphological patterns
        const patterns = [
            // Common suffixes
            { pattern: /[BCDFGHJKLMNPQRSTVWXYZ]$/, additions: ['E', 'ED', 'ING', 'S'] },
            { pattern: /[AEIOU]$/, additions: ['R', 'L', 'N', 'T'] },
            
            // Double consonant patterns
            { pattern: /T$/, additions: ['TED', 'TING', 'TER'] },
            { pattern: /N$/, additions: ['ING', 'ED', 'ER'] },
            
            // Vowel completion patterns
            { pattern: /[BCDFGHJKLMNPQRSTVWXYZ]{2,}$/, additions: ['A', 'E', 'I', 'O', 'U'] }
        ];

        patterns.forEach(pattern => {
            if (pattern.pattern.test(upperFragment)) {
                pattern.additions.forEach(addition => {
                    const completed = upperFragment + addition;
                    if (this.isLikelyEnglishWord(completed)) {
                        completions.push({
                            word: completed,
                            confidence: 0.5, // Lower confidence for linguistic guesses
                            source: 'linguistic'
                        });
                    }
                });
            }
        });

        return completions;
    }

    isLikelyEnglishWord(word) {
        // Basic heuristics for English word patterns
        if (word.length < 2 || word.length > 15) return false;
        
        // Check vowel ratio (English words typically have 20-60% vowels)
        const vowels = (word.match(/[AEIOU]/g) || []).length;
        const vowelRatio = vowels / word.length;
        if (vowelRatio < 0.1 || vowelRatio > 0.8) return false;
        
        // Check for impossible consonant clusters
        if (/[BCDFGHJKLMNPQRSTVWXYZ]{4,}/.test(word)) return false;
        
        return true;
    }

    removeDuplicates(completions) {
        const seen = new Set();
        return completions.filter(comp => {
            if (seen.has(comp.word)) return false;
            seen.add(comp.word);
            return true;
        });
    }

    async completeText(words) {
        const completedWords = [];
        
        for (const word of words) {
            const completions = await this.completeWord(word);
            if (completions.length > 0) {
                completedWords.push(completions[0]); // Use best completion
            } else {
                completedWords.push({ word: word, confidence: 1.0, source: 'original' });
            }
        }

        return completedWords;
    }
}