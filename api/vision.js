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
              
            // Extract title using generic logic only  
            const extractedTitle = extractGenericTitle(textBlocks, fullText, fullTextAnnotation);  
              
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
  
function extractGenericTitle(textBlocks, fullText, fullTextAnnotation) {  
    console.log('🎯 Extracting title using generic logic...');  
      
    // Step 1: Filter out obvious junk (no movie-specific filtering)  
    const cleanBlocks = textBlocks.filter(block => {  
        const text = block.description.trim();  
          
        // Filter out file extensions  
        if (text.match(/\.(jpg|jpeg|png|gif|webp|bmp|pdf|doc|txt)$/i)) {  
            console.log(`❌ Filtered out filename: "${text}"`);  
            return false;  
        }  
          
        // Filter out very long random strings (likely OCR noise)  
        if (text.match(/^[a-zA-Z0-9]{25,}$/)) {  
            console.log(`❌ Filtered out long random string: "${text}"`);  
            return false;  
        }  
          
        // Filter out obvious UI elements  
        const uiElements = ['Delete', 'Backspace', 'Enter', 'Tab', 'Ctrl', 'Alt', 'Shift'];  
        if (uiElements.some(ui => text === ui)) {  
            console.log(`❌ Filtered out UI element: "${text}"`);  
            return false;  
        }  
          
        // Keep text that has at least some letters  
        if (!text.match(/[a-zA-Z]/)) {  
            console.log(`❌ Filtered out non-alphabetic: "${text}"`);  
            return false;  
        }  
          
        // Filter out very short noise  
        if (text.length < 1) {  
            console.log(`❌ Filtered out too short: "${text}"`);  
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
      
    // Step 2: Use spatial and size-based scoring  
    const titleCandidate = identifyTitleBySpatialLogic(cleanBlocks);  
      
    // Step 3: Apply generic text cleanup  
    const cleanedTitle = applyGenericCleanup(titleCandidate);  
      
    console.log(`🎬 Final title: "${cleanedTitle}"`);  
    return cleanedTitle;  
}  
  
function identifyTitleBySpatialLogic(blocks) {  
    if (blocks.length === 0) return null;  
      
    // Score blocks based on spatial characteristics  
    const scoredBlocks = blocks.map(block => {  
        const text = block.description.trim().toUpperCase();  
        const vertices = block.boundingPoly?.vertices || [];  
          
        let score = 0;  
          
        // Size scoring - larger text is more likely to be a title  
        if (vertices.length >= 4) {  
            const height = Math.max(...vertices.map(v => v.y)) - Math.min(...vertices.map(v => v.y));  
            const width = Math.max(...vertices.map(v => v.x)) - Math.min(...vertices.map(v => v.x));  
            const area = height * width;  
              
            // Normalize area score (rough heuristic)  
            if (area > 5000) score += 50;  
            else if (area > 2000) score += 30;  
            else if (area > 1000) score += 15;  
        }  
          
        // Position scoring - upper portion of image more likely to contain titles  
        if (vertices.length >= 4) {  
            const centerY = vertices.reduce((sum, v) => sum + v.y, 0) / vertices.length;  
            const centerX = vertices.reduce((sum, v) => sum + v.x, 0) / vertices.length;  
              
            // Assume image height around 500-1000px, prefer upper 40%  
            if (centerY < 400) score += 40;  
            else if (centerY < 600) score += 20;  
              
            // Slight preference for horizontally centered text  
            // This is rough - in real implementation you'd get actual image dimensions  
            if (centerX > 200 && centerX < 800) score += 10;  
        }  
          
        // Text characteristics scoring  
        const letterCount = (text.match(/[A-Z]/g) || []).length;  
        const letterRatio = letterCount / text.length;  
          
        // Prefer text that's mostly letters  
        if (letterRatio > 0.8) score += 30;  
        else if (letterRatio > 0.6) score += 15;  
          
        // Length scoring - titles are usually 1-6 words  
        const wordCount = text.split(/\s+/).length;  
        if (wordCount >= 1 && wordCount <= 4) score += 25;  
        else if (wordCount <= 6) score += 10;  
          
        // Avoid very short single characters unless they could be titles  
        if (text.length === 1 && !text.match(/[A-Z]/)) score -= 20;  
          
        return { block, text, score };  
    });  
      
    // Sort by score and try to combine adjacent high-scoring blocks  
    scoredBlocks.sort((a, b) => b.score - a.score);  
      
    console.log('🏆 Top scoring text blocks:');  
    scoredBlocks.slice(0, 5).forEach((item, i) => {  
        console.log(`   ${i + 1}. "${item.text}" (score: ${item.score})`);  
    });  
      
    // Try to find the best combination of adjacent blocks  
    const bestCombination = findBestTextCombination(scoredBlocks);  
      
    return bestCombination;  
}  
  
function findBestTextCombination(scoredBlocks) {  
    if (scoredBlocks.length === 0) return null;  
      
    // Start with highest scoring block  
    let bestText = scoredBlocks[0].text;  
    let bestScore = scoredBlocks[0].score;  
      
    // Try combinations of 2-4 adjacent blocks  
    for (let i = 0; i < Math.min(scoredBlocks.length, 5); i++) {  
        for (let j = i + 1; j < Math.min(scoredBlocks.length, i + 4); j++) {  
            const combinedText = scoredBlocks.slice(i, j + 1)  
                .map(item => item.text)  
                .join(' ');  
              
            const combinedScore = scoredBlocks.slice(i, j + 1)  
                .reduce((sum, item) => sum + item.score, 0) / (j - i + 1);  
              
            // Bonus for reasonable length combinations  
            const wordCount = combinedText.split(/\s+/).length;  
            let lengthBonus = 0;  
            if (wordCount >= 2 && wordCount <= 4) lengthBonus = 20;  
            else if (wordCount <= 6) lengthBonus = 10;  
              
            const finalScore = combinedScore + lengthBonus;  
              
            if (finalScore > bestScore) {  
                bestText = combinedText;  
                bestScore = finalScore;  
            }  
        }  
    }  
      
    console.log(`🔗 Best combination: "${bestText}" (score: ${bestScore})`);  
    return bestText;  
}  
  
function applyGenericCleanup(text) {  
    if (!text) return null;  
      
    let cleaned = text;  
      
    // Basic text cleanup without movie-specific knowledge  
    cleaned = cleaned  
        .replace(/[^\w\s\-']/g, ' ')  // Keep letters, numbers, spaces, hyphens, apostrophes  
        .replace(/\s+/g, ' ')         // Multiple spaces to single space  
        .trim();                      // Remove leading/trailing spaces  
      
    // Remove common poster junk that's not movie-specific  
    cleaned = cleaned  
        .replace(/^(THE\s+)?POSTER\s*/i, '')     // Remove "POSTER" prefix  
        .replace(/\s*MOVIE\s*$/i, '')            // Remove "MOVIE" suffix  
        .replace(/^OFFICIAL\s*/i, '')            // Remove "OFFICIAL" prefix  
        .replace(/\s*TRAILER\s*$/i, '')          // Remove "TRAILER" suffix  
        .replace(/\s*COMING\s+SOON\s*$/i, '')    // Remove "COMING SOON"  
        .replace(/\s*IN\s+THEATERS\s*$/i, '')    // Remove "IN THEATERS"  
        .trim();  
      
    // Final validation  
    if (cleaned.length < 1) {  
        console.log('⚠️ Cleaned title too short, returning null');  
        return null;  
    }  
      
    // Convert to title case for consistency  
    cleaned = cleaned.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());  
      
    return cleaned;  
}