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
  
// Update the main handler
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
        const imageBuffer = Buffer.from(image, 'base64');

        // Detect poster area first
        const posterArea = await detectPosterArea(imageBuffer);
        
        // Configure Vision API request with crop hints if poster area found
        const options = {
            imageContext: {
                languageHints: ['en'],
                textDetectionParams: {
                    enableTextDetectionConfidenceScore: true
                }
            }
        };

        if (posterArea) {
            options.imageContext.cropHints = [{
                boundingPoly: {
                    vertices: [
                        { x: posterArea.left, y: posterArea.top },
                        { x: posterArea.right, y: posterArea.top },
                        { x: posterArea.right, y: posterArea.bottom },
                        { x: posterArea.left, y: posterArea.bottom }
                    ]
                }
            }];
        }

        // Process with focused area
        const [result] = await visionClient.documentTextDetection(imageBuffer, options);
        
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
        console.error('❌ Vision API error:', error);
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
    // Get image dimensions from first block's bounding box  
    const imageBounds = calculateImageBounds(blocks);  
    
    // Score blocks based on enhanced spatial characteristics  
    const scoredBlocks = blocks.map(block => {  
        const text = block.description.trim();  
        const vertices = block.boundingPoly?.vertices || [];  
        
        // Calculate block metrics  
        const metrics = calculateBlockMetrics(vertices, imageBounds);  
        let score = 0;  
  
        // Position scoring - prefer upper third and center alignment  
        score += scorePosition(metrics, imageBounds);  
        
        // Size and aspect ratio scoring  
        score += scoreSizeAndRatio(metrics, imageBounds);  
        
        // Proximity scoring - group nearby blocks  
        score += scoreProximity(vertices, blocks);  
        
        // Text characteristics scoring  
        score += scoreTextCharacteristics(text);  
  
        return { block, text, metrics, score };  
    });  
  
    // Group adjacent blocks by proximity and alignment  
    const groups = groupAdjacentBlocks(scoredBlocks, imageBounds);  
    
    // Score groups and select best candidate  
    const bestGroup = selectBestGroup(groups);  
    
    console.log('📊 Spatial Analysis Results:');  
    console.log('Image bounds:', imageBounds);  
    console.log('Block groups found:', groups.length);  
    console.log('Best group score:', bestGroup?.score);  
    
    return bestGroup ? bestGroup.text : null;  
}  
  
function calculateImageBounds(blocks) {  
    let minX = Infinity, minY = Infinity;  
    let maxX = -Infinity, maxY = -Infinity;  
    
    blocks.forEach(block => {  
        const vertices = block.boundingPoly?.vertices || [];  
        vertices.forEach(v => {  
            minX = Math.min(minX, v.x);  
            minY = Math.min(minY, v.y);  
            maxX = Math.max(maxX, v.x);  
            maxY = Math.max(maxY, v.y);  
        });  
    });  
    
    return {  
        width: maxX - minX,  
        height: maxY - minY,  
        centerX: (maxX + minX) / 2,  
        centerY: (maxY + minY) / 2  
    };  
}  
  
function calculateBlockMetrics(vertices, imageBounds) {  
    if (vertices.length < 4) return null;  
    
    // Calculate block dimensions and position  
    const left = Math.min(...vertices.map(v => v.x));  
    const right = Math.max(...vertices.map(v => v.x));  
    const top = Math.min(...vertices.map(v => v.y));  
    const bottom = Math.max(...vertices.map(v => v.y));  // Fixed line
    
    const width = right - left;  
    const height = bottom - top;  
    const centerX = (left + right) / 2;  
    const centerY = (top + bottom) / 2;  
    
    // Calculate relative positions (0-1 range)  
    const relativeX = centerX / imageBounds.width;  
    const relativeY = centerY / imageBounds.height;  
    
    // Calculate aspect ratio and area  
    const aspectRatio = width / height;  
    const area = width * height;  
    const relativeArea = area / (imageBounds.width * imageBounds.height);  
    
    return {  
        bounds: { left, right, top, bottom },  
        center: { x: centerX, y: centerY },  
        relative: { x: relativeX, y: relativeY },  
        dimensions: { width, height },  
        aspectRatio,  
        area,  
        relativeArea  
    };  
}  
  
function scorePosition(metrics, imageBounds) {  
    let score = 0;  
    
    // Vertical position scoring (prefer upper third)  
    const relativeY = metrics.relative.y;  
    if (relativeY < 0.33) score += 40;  
    else if (relativeY < 0.5) score += 20;  
    else score -= 10;  
    
    // Horizontal center alignment  
    const relativeX = metrics.relative.x;  
    const centerOffset = Math.abs(0.5 - relativeX);  
    score += (1 - centerOffset) * 30; // Max 30 points for perfect centering  
    
    return score;  
}  
  
function scoreSizeAndRatio(metrics, imageBounds) {  
    let score = 0;  
    
    // Size scoring - prefer larger text but not too large  
    const optimalRelativeArea = 0.05; // 5% of image area  
    const areaDiff = Math.abs(metrics.relativeArea - optimalRelativeArea);  
    score += (1 - areaDiff) * 40;  
    
    // Aspect ratio scoring - prefer wider than tall blocks  
    const optimalRatio = 3; // Prefer text ~3 times wider than tall  
    const ratioDiff = Math.abs(metrics.aspectRatio - optimalRatio);  
    score += (1 - Math.min(ratioDiff, 1)) * 30;  
    
    return score;  
}  
  
function scoreProximity(vertices, allBlocks) {  
    let score = 0;  
    const centerY = vertices.reduce((sum, v) => sum + v.y, 0) / vertices.length;  
    
    // Find blocks with similar vertical position  
    const nearbyBlocks = allBlocks.filter(other => {  
        if (other.boundingPoly === vertices) return false;  
        const otherCenterY = other.boundingPoly.vertices.reduce((sum, v) => sum + v.y, 0) / 
            other.boundingPoly.vertices.length;  
        return Math.abs(centerY - otherCenterY) < 20;  
    });  
    
    score += nearbyBlocks.length * 10; // Bonus for aligned blocks  
    return score;  
}  
  
function scoreTextCharacteristics(text) {  
    let score = 0;  
    
    // Length scoring  
    const words = text.split(/\s+/).length;  
    if (words >= 1 && words <= 4) score += 25;  
    else if (words <= 6) score += 10;  
    
    // Character ratio scoring  
    const letters = (text.match(/[A-Za-z]/g) || []).length;  
    const letterRatio = letters / text.length;  
    score += letterRatio * 30;  
    
    return score;  
}  

function isKeyboardRelatedText(text) {
    // Common keyboard-related patterns
    const keyboardPatterns = [
        // Function keys
        /^F\d{1,2}$/i,
        
        // Common keyboard keys
        /^(Home|End|Insert|Del|Delete|Esc|Tab|Enter|Return|Space|Backspace)$/i,
        
        // Keyboard rows
        /^[QWERTYUIOP]$/i,
        /^[ASDFGHJKL]$/i,
        /^[ZXCVBNM]$/i,
        
        // Modifier keys
        /^(Ctrl|Alt|Shift|Win|Cmd|Fn)$/i,
        /^(Num|Scroll|Caps)\s*Lock$/i,
        
        // Special keys
        /^(PrtSc|SysRq|Pause|Break|PgUp|PgDn|PriSc|ScrLk)$/i,
        
        // Navigation keys
        /^(Up|Down|Left|Right|Nav)$/i,
        
        // Common abbreviated keys
        /^(KB|BR|DB|DIB)$/i,
        
        // Single characters that are likely keyboard keys
        /^[A-Z]$/,
        
        // Common keyboard labels
        /^(OK|Cancel|Menu)$/i
    ];

    // Check if text matches any keyboard pattern
    const isKeyboard = keyboardPatterns.some(pattern => pattern.test(text));

    // Additional checks for keyboard-like patterns
    const hasKeyboardIndicators = (
        text.length <= 3 && /^[A-Z][0-9-]*$/.test(text) || // Like F1, A-, B2
        /^[A-Z]{1,3}$/.test(text) || // 1-3 capital letters
        text.includes('key') ||
        text.includes('btn') ||
        text.includes('button')
    );

    return isKeyboard || hasKeyboardIndicators;
}

// Add after scoreTextCharacteristics function
function groupAdjacentBlocks(scoredBlocks, imageBounds) {
    console.log('🔍 Grouping adjacent blocks...');
    
    const groups = [];
    const processed = new Set();
    
    // Sort blocks by vertical position first
    const sortedBlocks = [...scoredBlocks].sort((a, b) => 
        a.metrics.center.y - b.metrics.center.y
    );
    
    for (const block of sortedBlocks) {
        if (processed.has(block)) continue;
        
        const group = {
            blocks: [block],
            text: block.text,
            score: block.score,
            metrics: block.metrics
        };
        
        // Find adjacent blocks
        for (const other of sortedBlocks) {
            if (other === block || processed.has(other)) continue;
            
            if (areBlocksAdjacent(block.metrics, other.metrics, imageBounds)) {
                group.blocks.push(other);
                group.text += ' ' + other.text;
                group.score += other.score;
                processed.add(other);
            }
        }
        
        groups.push(group);
        processed.add(block);
    }
    
    console.log(`📚 Found ${groups.length} text groups`);
    groups.forEach((g, i) => console.log(`   Group ${i + 1}: "${g.text}" (score: ${g.score})`));
    
    return groups;
}

function areBlocksAdjacent(metrics1, metrics2, imageBounds) {
    // Vertical proximity threshold (adjusted for image height)
    const verticalThreshold = imageBounds.height * 0.02; // 2% of image height
    
    // Horizontal overlap threshold
    const horizontalThreshold = Math.min(
        metrics1.dimensions.width,
        metrics2.dimensions.width
    ) * 0.5; // 50% of smaller width
    
    // Check vertical proximity
    const verticalGap = Math.abs(
        metrics1.center.y - metrics2.center.y
    );
    
    // Check horizontal overlap
    const horizontalGap = Math.abs(
        metrics1.center.x - metrics2.center.x
    );
    
    // Blocks must be close vertically and have some horizontal overlap
    return verticalGap < verticalThreshold && 
           horizontalGap < horizontalThreshold;
}

function selectBestGroup(groups) {
    if (!groups || groups.length === 0) {
        console.log('⚠️ No groups to select from');
        return null;
    }

    // First pass: Try to find and combine title parts
    const combinedGroups = combineRelatedTitleParts(groups);
    
    // Enhanced scoring for final group selection
    const scoredGroups = combinedGroups.map(group => {
        let finalScore = group.blocks.reduce((sum, block) => sum + block.score, 0);
        const text = group.text;
        
        // Core scoring factors
        const metrics = {
            wordCount: text.split(/\s+/).length,
            charCount: text.length,
            isUpperCase: text === text.toUpperCase(),
            hasArticle: /^(THE|A|AN)\s/i.test(text),
            hasColon: text.includes(':'),
            verticalPosition: group.blocks[0].metrics.relative.y,
            horizontalCenter: Math.abs(0.5 - group.blocks[0].metrics.relative.x),
            isKeyboardLike: isKeyboardRelatedText(text),
            isTitleFormat: /^[A-Z][a-zA-Z]+([\s:-][A-Z][a-zA-Z]+)*$/.test(text)
        };

        // Enhanced scoring rules
        if (metrics.isKeyboardLike) {
            finalScore *= 0.01; // Severe penalty for keyboard text
        } else {
            // Strengthen vertical position importance
            if (metrics.verticalPosition < 0.4) finalScore *= 4.0;  // Increased from 3.0
            else if (metrics.verticalPosition < 0.6) finalScore *= 2.5;
            
            // Strengthen horizontal center importance
            if (metrics.horizontalCenter < 0.15) finalScore *= 2.5; // Increased from 2.0
            
            // Title format scoring
            if (metrics.isUpperCase) finalScore *= 1.8;            // Increased from 1.5
            if (metrics.hasArticle) finalScore *= 1.4;            // Increased from 1.3
            if (metrics.isTitleFormat) finalScore *= 2.2;         // Increased from 2.0
            
            // Word count scoring for two-word titles
            if (metrics.wordCount === 2) finalScore *= 3.0;       // New specific bonus
            else if (metrics.wordCount <= 4) finalScore *= 2.0;
        }

        return {
            ...group,
            finalScore,
            metrics,
            originalText: text
        };
    });

    // Sort by final score
    scoredGroups.sort((a, b) => b.finalScore - a.finalScore);
    
    // Get top candidates and check for related titles
    const topCandidates = scoredGroups.slice(0, 2);
    
    // Log results
    console.log('\n📊 Detailed Scoring Analysis:');
    scoredGroups.forEach(group => {
        console.log(`\nText: "${group.originalText}"`);
        console.log(`Base score: ${group.score}`);
        console.log(`Final score: ${group.finalScore}`);
        console.log('Metrics:', group.metrics);
    });

    return topCandidates[0];
}

function combineRelatedTitleParts(groups) {
    console.log('🔍 Analyzing title combinations...');
    const combined = [...groups];
    let changes;

    do {
        changes = false;
        for (let i = 0; i < combined.length; i++) {
            for (let j = i + 1; j < combined.length; j++) {
                const group1 = combined[i];
                const group2 = combined[j];

                if (shouldCombineGroups(group1, group2)) {
                    console.log(`✨ Combining "${group1.text}" with "${group2.text}"`);
                    
                    // Create combined group with enhanced metrics
                    const combinedGroup = {
                        blocks: [...group1.blocks, ...group2.blocks],
                        text: `${group1.text} ${group2.text}`.replace(/\s*:\s*/g, ': '),
                        score: group1.score + group2.score,
                        metrics: {
                            ...group1.metrics,
                            center: {
                                x: (group1.metrics.center.x + group2.metrics.center.x) / 2,
                                y: (group1.metrics.center.y + group2.metrics.center.y) / 2
                            },
                            dimensions: {
                                width: Math.max(
                                    group2.metrics.bounds.right - group1.metrics.bounds.left,
                                    group1.metrics.dimensions.width,
                                    group2.metrics.dimensions.width
                                ),
                                height: Math.abs(
                                    group2.metrics.bounds.bottom - group1.metrics.bounds.top
                                )
                            }
                        }
                    };

                    // Replace first group with combined group and remove second
                    combined[i] = combinedGroup;
                    combined.splice(j, 1);
                    changes = true;
                    j--;
                }
            }
        }
    } while (changes);

    return combined;
}

function shouldCombineGroups(group1, group2) {
    // Get metrics for both groups
    const verticalGap = Math.abs(group1.metrics.center.y - group2.metrics.center.y);
    const horizontalAlignment = Math.abs(group1.metrics.center.x - group2.metrics.center.x);
    
    // Adjusted thresholds
    const verticalThreshold = Math.min(
        group1.metrics.dimensions.height * 2,
        group2.metrics.dimensions.height * 2,
        50 // Maximum threshold
    );
    
    const horizontalThreshold = Math.max(
        group1.metrics.dimensions.width,
        group2.metrics.dimensions.width
    ) * 0.5;

    // Position checks
    const isCloseVertically = verticalGap < verticalThreshold;
    const isAlignedHorizontally = horizontalAlignment < horizontalThreshold;
    
    // Enhanced title pattern checks
    return (
        isCloseVertically &&
        isAlignedHorizontally &&
        (
            // Both are uppercase single words that form a title
            (group1.text.toUpperCase() === group1.text &&
             group2.text.toUpperCase() === group2.text &&
             group1.text.length > 1 &&
             group2.text.length > 1 &&
             !isKeyboardRelatedText(group1.text) &&
             !isKeyboardRelatedText(group2.text)) ||
            
            // Title with subtitle (colon-separated)
            (group1.text.endsWith(':') &&
             !isKeyboardRelatedText(group2.text)) ||
            
            // Multi-word title starting with article
            (/^(THE|A|AN)$/i.test(group1.text) &&
             group2.text.toUpperCase() === group2.text)
        )
    );
}

function applyGenericCleanup(titleCandidate) {
    if (!titleCandidate) return null;

    // Filter and join adjacent uppercase words
    const cleanedText = titleCandidate
        .split(/\s+/)
        .filter(word => {
            // Keep words that:
            // 1. Are longer than 1 character
            // 2. Contain at least one letter
            // 3. Are not keyboard-related
            return word.length > 1 && 
                   /[A-Za-z]/.test(word) && 
                   !isKeyboardRelatedText(word);
        })
        .join(' ');

    if (!cleanedText) return null;

    // Additional title-specific cleanup
    return cleanedText
        .replace(/[^\w\s:'-]/g, '') // Remove special chars except :'-
        .replace(/\s+/g, ' ')       // Normalize spaces
        .trim();
}

// Add after vision client initialization
async function detectPosterArea(imageBuffer) {
    // Get full image dimensions
    const [result] = await visionClient.imageProperties(imageBuffer);
    const { width, height } = result.imagePropertiesAnnotation;

    // First try to detect using text layout
    const [textResult] = await visionClient.textDetection(imageBuffer);
    if (!textResult.textAnnotations || textResult.textAnnotations.length === 0) {
        console.log('⚠️ No text detected for poster area');
        return null;
    }

    // Get all text blocks
    const blocks = textResult.textAnnotations.slice(1);
    
    // Find densest text area
    const clusters = findTextClusters(blocks);
    const posterArea = selectBestPosterArea(clusters, { width, height });

    console.log('📏 Detected poster area:', posterArea);
    return posterArea;
}

function findTextClusters(blocks) {
    const clusters = [];
    const processed = new Set();

    blocks.forEach(block => {
        if (processed.has(block)) return;

        const cluster = {
            blocks: [block],
            bounds: { ...getBounds(block) }
        };

        blocks.forEach(other => {
            if (other === block || processed.has(other)) return;
            if (areBlocksInSameCluster(block, other)) {
                cluster.blocks.push(other);
                processed.add(other);
                expandBounds(cluster.bounds, getBounds(other));
            }
        });

        clusters.push(cluster);
        processed.add(block);
    });

    return clusters;
}

function selectBestPosterArea(clusters, imageDims) {
    if (clusters.length === 0) return null;

    // Score clusters based on poster-like characteristics
    const scoredClusters = clusters.map(cluster => {
        const bounds = cluster.bounds;
        const width = bounds.right - bounds.left;
        const height = bounds.bottom - bounds.top;
        const area = width * height;
        const aspectRatio = width / height;
        
        // Typical movie poster aspect ratios are around 0.66 (2:3)
        const aspectScore = 1 - Math.abs(0.66 - aspectRatio);
        
        // Prefer clusters that take up reasonable amount of image
        const relativeArea = area / (imageDims.width * imageDims.height);
        const areaScore = relativeArea > 0.1 && relativeArea < 0.8 ? 1 : 0.2;
        
        // Prefer vertically oriented clusters
        const orientationScore = height > width ? 1 : 0.3;
        
        // Text density score
        const density = cluster.blocks.length / area;
        const densityScore = Math.min(density * 10000, 1);

        const totalScore = (
            aspectScore * 0.3 +
            areaScore * 0.3 +
            orientationScore * 0.2 +
            densityScore * 0.2
        );

        return {
            ...cluster,
            score: totalScore
        };
    });

    // Select highest scoring cluster
    scoredClusters.sort((a, b) => b.score - a.score);
    return scoredClusters[0].bounds;
}

function areBlocksInSameCluster(block1, block2) {
    const bounds1 = getBounds(block1);
    const bounds2 = getBounds(block2);
    
    // Calculate distances
    const verticalGap = Math.abs(
        (bounds1.top + bounds1.bottom) / 2 -
        (bounds2.top + bounds2.bottom) / 2
    );
    
    const horizontalGap = Math.abs(
        (bounds1.left + bounds1.right) / 2 -
        (bounds2.left + bounds2.right) / 2
    );

    // Blocks should be relatively close to be in same cluster
    const maxVerticalGap = Math.max(
        bounds1.bottom - bounds1.top,
        bounds2.bottom - bounds2.top
    ) * 3;
    
    const maxHorizontalGap = Math.max(
        bounds1.right - bounds1.left,
        bounds2.right - bounds2.left
    ) * 2;

    return verticalGap < maxVerticalGap && horizontalGap < maxHorizontalGap;
}