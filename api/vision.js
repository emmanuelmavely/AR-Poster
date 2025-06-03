// api/vision.js - Google Vision API Handler (Improved Version)
import vision from '@google-cloud/vision';
import { existsSync } from 'fs';

let visionClient = null;

// Initialize Vision client
try {
    if (existsSync('google-vision-credentials.json')) {
        visionClient = new vision.ImageAnnotatorClient({
            keyFilename: 'google-vision-credentials.json'
        });
        console.log('Google Vision client initialized');
    } else {
        console.log('Google Vision credentials not found');
    }
} catch (error) {
    console.error('Failed to initialize Vision client:', error);
}

export default async function visionHandler(req, res) {
    console.log('🔥 Vision API endpoint called');
    
    if (!visionClient) {
        console.log('❌ Vision client not available');
        return res.status(500).json({
            success: false,
            error: 'Google Vision API not configured'
        });
    }
    
    try {
        const { image } = req.body;
        console.log('📡 Received image data:', image ? `${image.length} bytes` : 'none');
        
        if (!image) {
            console.log('❌ No image in request body');
            return res.status(400).json({
                success: false,
                error: 'No image provided'
            });
        }
        
        // Decode base64 image
        console.log('🔄 Processing image...');
        const imageBuffer = Buffer.from(image, 'base64');
        console.log(`📏 Image size: ${imageBuffer.length} bytes`);
        
        // Detect text with enhanced parameters
        console.log('👁️ Calling Google Vision API...');
        const [result] = await visionClient.documentTextDetection(imageBuffer, {
            imageContext: {
                languageHints: ['en'],
                textDetectionParams: {
                    enableTextDetectionConfidenceScore: true
                }
            }
        });
        
        const detections = result.textAnnotations;
        const fullTextAnnotation = result.fullTextAnnotation;
        
        console.log(`📝 Vision API returned ${detections?.length || 0} text detections`);
        
        if (detections && detections.length > 0) {
            const fullText = detections[0].description;
            const textBlocks = detections.slice(1);
            
            console.log('📊 RAW VISION DATA:');
            console.log('   Full text:', JSON.stringify(fullText));
            console.log('   Text blocks found:', textBlocks.length);
            
            // Extract clean movie title
            const extractedTitle = extractCleanMovieTitle(textBlocks, fullText, fullTextAnnotation);
            
            console.log('✅ Vision API Result:');
            console.log('  - Raw text:', fullText.substring(0, 100) + '...');
            console.log('  - Extracted title:', extractedTitle);
            
            res.json({
                success: true,
                text: extractedTitle,
                fullText: fullText
            });
        } else {
            console.log('⚠️ No text detected by Vision API');
            res.json({
                success: true,
                text: null,
                fullText: null
            });
        }
        
    } catch (error) {
        console.error('❌ Vision API error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

function extractCleanMovieTitle(textBlocks, fullText, fullTextAnnotation) {
    console.log('🎯 Extracting clean movie title...');
    
    // Step 1: Filter out obvious junk and UI elements
    const cleanBlocks = textBlocks.filter(block => {
        const text = block.description.trim();
        
        // Filter out file names, URLs, and obvious junk
        if (text.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) {
            console.log(`❌ Filtered out image filename: "${text}"`);
            return false;
        }
        
        // Filter out random strings (20+ chars of random letters/numbers)
        if (text.match(/^[a-zA-Z0-9]{20,}$/)) {
            console.log(`❌ Filtered out random string: "${text}"`);
            return false;
        }
        
        // Filter out keyboard keys and UI elements
        const uiKeywords = [
            'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
            'Delete', 'Backspace', 'Enter', 'Space', 'Tab', 'Shift', 'Ctrl', 'Alt', 'Home', 'End',
            'Insert', 'PageUp', 'PageDown', 'PgUp', 'PgDn', 'Ins', 'Del', 'Esc', 'Menu',
            'Print', 'Scroll', 'Pause', 'Break', 'CapsLock', 'NumLock', 'ScrollLock',
            'Windows', 'Cmd', 'Option', 'Fn', 'Up', 'Down', 'Left', 'Right'
        ];
        
        if (uiKeywords.some(keyword => text.toUpperCase().includes(keyword.toUpperCase()))) {
            console.log(`❌ Filtered out UI element: "${text}"`);
            return false;
        }
        
        // Filter out single characters and numbers
        if (text.match(/^[^a-zA-Z]*$/)) {
            console.log(`❌ Filtered out non-letter text: "${text}"`);
            return false;
        }
        
        // Filter out very short text (less than 2 chars)
        if (text.length < 2) {
            console.log(`❌ Filtered out too short: "${text}"`);
            return false;
        }
        
        // Filter out common UI symbols and punctuation-only text
        if (text.match(/^[^\w\s]*$/)) {
            console.log(`❌ Filtered out symbols only: "${text}"`);
            return false;
        }
        
        // Filter out single letters that are clearly not part of titles
        if (text.length === 2 && !isLikelyMovieWord(text)) {
            console.log(`❌ Filtered out unlikely movie word: "${text}"`);
            return false;
        }
        
        return true;
    });
    
    console.log(`📋 Clean blocks: ${cleanBlocks.length}/${textBlocks.length}`);
    cleanBlocks.forEach((block, i) => {
        console.log(`   ${i + 1}. "${block.description}"`);
    });
    
    if (cleanBlocks.length === 0) {
        console.log('⚠️ No clean text blocks found');
        return null;
    }
    
    // Step 2: Try to identify the main movie title
    const movieTitle = identifyMovieTitle(cleanBlocks);
    
    // Step 3: Apply smart corrections
    const correctedTitle = applySmartCorrections(movieTitle);
    
    console.log(`🎬 Final title: "${correctedTitle}"`);
    return correctedTitle;
}

function isLikelyMovieWord(text) {
    // Common short words that appear in movie titles
    const commonMovieWords = [
        'OF', 'THE', 'AND', 'TO', 'IN', 'ON', 'AT', 'BY', 'FOR', 'UP', 'GO', 'NO', 'SO',
        'IT', 'IS', 'AS', 'OR', 'IF', 'WE', 'MY', 'HE', 'BE', 'DO', 'ME', 'AM', 'AN'
    ];
    
    return commonMovieWords.includes(text.toUpperCase());
}

function identifyMovieTitle(blocks) {
    if (blocks.length === 0) return null;
    
    // Strategy 1: Look for the largest contiguous group of movie-like words
    const movieWords = blocks.filter(block => {
        const text = block.description.trim().toUpperCase();
        
        // Must be primarily letters
        const letterCount = (text.match(/[A-Z]/g) || []).length;
        const totalLength = text.length;
        
        return letterCount / totalLength > 0.7; // At least 70% letters
    });
    
    if (movieWords.length === 0) {
        console.log('⚠️ No movie-like words found');
        return null;
    }
    
    // Strategy 2: Find the best sequence based on position and content
    const titleCandidates = findTitleCandidates(movieWords);
    
    if (titleCandidates.length > 0) {
        // Score each candidate
        const scoredCandidates = titleCandidates.map(candidate => ({
            text: candidate,
            score: scoreMovieTitle(candidate)
        }));
        
        // Sort by score and return the best
        scoredCandidates.sort((a, b) => b.score - a.score);
        console.log(`🏆 Best title candidate: "${scoredCandidates[0].text}" (score: ${scoredCandidates[0].score})`);
        
        return scoredCandidates[0].text;
    }
    
    // Fallback: combine all movie words
    const combined = movieWords.map(block => block.description.trim()).join(' ').toUpperCase();
    console.log(`🔗 Fallback combined text: "${combined}"`);
    return combined;
}

function findTitleCandidates(blocks) {
    const candidates = [];
    
    // Single word titles
    blocks.forEach(block => {
        const word = block.description.trim().toUpperCase();
        if (word.length >= 3) {
            candidates.push(word);
        }
    });
    
    // Two word combinations (most common for movie titles)
    for (let i = 0; i < blocks.length - 1; i++) {
        const word1 = blocks[i].description.trim().toUpperCase();
        const word2 = blocks[i + 1].description.trim().toUpperCase();
        
        if (word1.length >= 2 && word2.length >= 2) {
            candidates.push(`${word1} ${word2}`);
        }
    }
    
    // Three word combinations
    for (let i = 0; i < blocks.length - 2; i++) {
        const word1 = blocks[i].description.trim().toUpperCase();
        const word2 = blocks[i + 1].description.trim().toUpperCase();
        const word3 = blocks[i + 2].description.trim().toUpperCase();
        
        if (word1.length >= 2 && word2.length >= 2 && word3.length >= 2) {
            candidates.push(`${word1} ${word2} ${word3}`);
        }
    }
    
    return candidates;
}

function scoreMovieTitle(title) {
    let score = 0;
    
    // Length score (movie titles are usually 1-4 words)
    const wordCount = title.split(' ').length;
    if (wordCount >= 1 && wordCount <= 4) {
        score += 30;
    } else if (wordCount <= 6) {
        score += 15;
    }
    
    // Known movie word patterns
    const moviePatterns = [
        /THE\s+\w+/,           // "THE [WORD]"
        /\w+\s+OF\s+\w+/,      // "[WORD] OF [WORD]"
        /\w+\s+AND\s+\w+/,     // "[WORD] AND [WORD]"
        /\w+\s+THE\s+\w+/,     // "[WORD] THE [WORD]"
        /FINAL\s+DESTINATION/, // "FINAL DESTINATION"
        /UNTIL\s+DAWN/,        // "UNTIL DAWN"
    ];
    
    moviePatterns.forEach(pattern => {
        if (pattern.test(title)) {
            score += 25;
        }
    });
    
    // Bonus for recognized movie titles or patterns
    const knownTitles = [
        'UNTIL DAWN', 'FINAL DESTINATION', 'SPIDER MAN', 'IRON MAN', 'CAPTAIN AMERICA',
        'STAR WARS', 'LORD OF THE RINGS', 'HARRY POTTER', 'FAST AND FURIOUS',
        'MISSION IMPOSSIBLE', 'JOHN WICK', 'THE MATRIX', 'THE DARK KNIGHT'
    ];
    
    knownTitles.forEach(knownTitle => {
        if (title.includes(knownTitle)) {
            score += 50;
        }
    });
    
    // Penalty for likely UI elements that slipped through
    const badPatterns = [
        /\d{3,}/,              // Long numbers
        /^[A-Z]{1,2}$/,        // Single/double letters
        /BACKSPACE|DELETE|HOME|INSERT/, // UI elements
    ];
    
    badPatterns.forEach(pattern => {
        if (pattern.test(title)) {
            score -= 20;
        }
    });
    
    return score;
}

function combineTextBlocks(blocks) {
    if (blocks.length === 0) return null;
    if (blocks.length === 1) return blocks[0].description.trim().toUpperCase();
    
    // Sort blocks by position (top to bottom, left to right)
    const sortedBlocks = blocks.slice().sort((a, b) => {
        const aY = Math.min(...a.boundingPoly.vertices.map(v => v.y));
        const bY = Math.min(...b.boundingPoly.vertices.map(v => v.y));
        
        // If roughly same Y position (within 20 pixels), sort by X
        if (Math.abs(aY - bY) < 20) {
            const aX = Math.min(...a.boundingPoly.vertices.map(v => v.x));
            const bX = Math.min(...b.boundingPoly.vertices.map(v => v.x));
            return aX - bX;
        }
        
        return aY - bY;
    });
    
    // Combine consecutive text blocks
    const words = sortedBlocks.map(block => block.description.trim());
    const combined = words.join(' ').toUpperCase();
    
    console.log(`🔗 Combined text: "${combined}"`);
    return combined;
}

function applySmartCorrections(text) {
    if (!text) return null;
    
    let corrected = text;
    
    // Known movie title corrections
    const movieCorrections = [
        // Common OCR mistakes in movie titles
        ['THE LAST OF US', /THE\s+LAST\s+(OF\s+)?DE\s+US/i],
        ['THE LAST OF US', /THE\s+LAST\s+(OF\s+)?D[EO]\s+US/i],
        ['THE LAST OF US', /THE\s+AST\s+DE\s*US/i],
        ['AVATAR', /AV[A4]T[A4]R/i],
        ['MATRIX', /M[A4]TR[I1]X/i],
        ['BATMAN', /B[A4]TM[A4]N/i],
        ['SUPERMAN', /SUPER?M[A4]N/i],
        ['SPIDER-MAN', /SP[I1]DER[\s\-]?M[A4]N/i],
        ['STAR WARS', /ST[A4]R\s+W[A4]RS/i],
        ['IRON MAN', /[I1]RON\s+M[A4]N/i],
        ['X-MEN', /X[\s\-]?MEN/i],
        ['DEADPOOL', /DE[A4]DPOOL/i],
        ['GUARDIANS OF THE GALAXY', /GU[A4]RD[I1][A4]NS?\s+OF\s+THE\s+G[A4]L[A4]XY/i],
        ['AVENGERS', /[A4]VENGERS?/i],
        ['THOR', /THOR?/i],
        ['HULK', /HULK/i],
        ['CAPTAIN AMERICA', /C[A4]PT[A4][I1]N\s+[A4]MER[I1]C[A4]/i],
        ['BLACK WIDOW', /BL[A4]CK\s+W[I1]DOW/i],
        ['FANTASTIC FOUR', /F[A4]NT[A4]ST[I1]C\s+FOUR/i],
        ['JUSTICE LEAGUE', /JUST[I1]CE\s+LE[A4]GUE/i],
        ['WONDER WOMAN', /WONDER\s+WOM[A4]N/i],
        ['AQUAMAN', /[A4]QU[A4]M[A4]N/i],
        ['SHAZAM', /SH[A4]Z[A4]M/i],
        ['JOKER', /JOKER/i],
        ['DUNE', /DUNE/i],
        ['BLADE RUNNER', /BL[A4]DE\s+RUNNER/i],
        ['TERMINATOR', /TERM[I1]N[A4]TOR/i],
        ['ALIEN', /[A4]L[I1]EN/i],
        ['PREDATOR', /PRED[A4]TOR/i],
        ['TRANSFORMERS', /TR[A4]NSFORMERS?/i],
        ['FAST AND FURIOUS', /F[A4]ST\s+[A4]ND\s+FUR[I1]OUS/i],
        ['MISSION IMPOSSIBLE', /M[I1]SS[I1]ON[\s\:]\s*[I1]MPOSS[I1]BLE/i],
        ['JAMES BOND', /J[A4]MES\s+BOND/i],
        ['JOHN WICK', /JOHN\s+W[I1]CK/i],
        ['PIRATES OF THE CARIBBEAN', /P[I1]R[A4]TES\s+OF\s+THE\s+C[A4]R[I1]BBE[A4]N/i],
        ['HARRY POTTER', /H[A4]RRY\s+POTTER/i],
        ['LORD OF THE RINGS', /LORD\s+OF\s+THE\s+R[I1]NGS/i],
        ['HOBBIT', /HOBB[I1]T/i],
        ['STAR TREK', /ST[A4]R\s+TREK/i],
        ['INDIANA JONES', /[I1]ND[I1][A4]N[A4]\s+JONES/i],
        ['JURASSIC PARK', /JUR[A4]SS[I1]C\s+P[A4]RK/i],
        ['JURASSIC WORLD', /JUR[A4]SS[I1]C\s+WORLD/i],
        ['KING KONG', /K[I1]NG\s+KONG/i],
        ['GODZILLA', /GODZ[I1]LL[A4]/i],
        ['PACIFIC RIM', /P[A4]C[I1]F[I1]C\s+R[I1]M/i],
        ['TOP GUN', /TOP\s+GUN/i],
        ['ROCKY', /ROCKY/i],
        ['RAMBO', /R[A4]MBO/i],
        ['DIE HARD', /D[I1]E\s+H[A4]RD/i],
        ['LETHAL WEAPON', /LETH[A4]L\s+WE[A4]PON/i],
        ['MAD MAX', /M[A4]D\s+M[A4]X/i],
        ['BLADE', /BL[A4]DE/i],
        ['HELLBOY', /HELLBOY/i],
        ['SIN CITY', /S[I1]N\s+C[I1]TY/i],
        ['300', /300/i],
        ['WATCHMEN', /W[A4]TCHMEN/i],
        ['V FOR VENDETTA', /V\s+FOR\s+VENDETT[A4]/i]
    ];
    
    // Apply corrections
    for (const [correct, pattern] of movieCorrections) {
        if (pattern.test(corrected)) {
            console.log(`🔧 Movie correction: "${corrected}" → "${correct}"`);
            corrected = correct;
            break;
        }
    }
    
    // Clean up remaining text
    corrected = corrected
        .replace(/[^\w\s\-:]/g, ' ')  // Remove special chars except word chars, spaces, hyphens, colons
        .replace(/\s+/g, ' ')         // Multiple spaces to single space
        .trim();                      // Remove leading/trailing spaces
    
    // Remove common junk patterns that might remain
    corrected = corrected
        .replace(/^(THE\s+)?POSTER\s*/i, '')  // Remove "POSTER" or "THE POSTER"
        .replace(/\s*MOVIE\s*$/i, '')         // Remove trailing "MOVIE"
        .replace(/^OFFICIAL\s*/i, '')         // Remove "OFFICIAL"
        .replace(/\s*TRAILER\s*$/i, '')       // Remove trailing "TRAILER"
        .trim();
    
    if (corrected.length < 2) {
        console.log('⚠️ Corrected title too short, returning null');
        return null;
    }
    
    return corrected;
}