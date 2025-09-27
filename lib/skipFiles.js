import { createLogger } from './logger.js';

const logger = createLogger('skipFiles');

/**
 * Check if a pattern is valid
 * @param {string} pattern - Pattern to validate
 * @returns {boolean} - True if pattern is valid
 */
const isValidPattern = (pattern) => {
    // Check for invalid characters or multiple wildcards in wrong positions
    if (pattern.includes('***') || pattern.includes('//')) {
        return false;
    }
    
    // Check if pattern uses both * and ** in the same segment (invalid according to README)
    // But **/.env is valid because ** and * are in different segments
    
    // Check for patterns like **/*.env which are invalid (mixing ** and * in same path)
    const segments = pattern.split('/');
    let hasDoubleStar = false;
    let hasSingleStar = false;
    
    for (const segment of segments) {
        if (segment === '**') {
            hasDoubleStar = true;
        } else if (segment.includes('*') && !segment.includes('**')) {
            hasSingleStar = true;
        }
    }
    
    if (hasDoubleStar && hasSingleStar) {
        return false;
    }
    
    // Check for multiple * or ** in the same segment
    for (const segment of segments) {
        // Check if segment contains both * and ** (which is invalid)
        // But **.keep is valid (like **.env)
        if (segment.includes('**') && segment !== '**' && !segment.startsWith('**')) {
            return false;
        }
        
        // Check for multiple single * wildcards in the same segment
        // Replace ** with placeholder first, then count single *
        const tempSegment = segment.replace(/\*\*/g, 'DOUBLE_STAR');
        const singleStarCount = (tempSegment.match(/\*/g) || []).length;
        if (singleStarCount > 1) {
            return false;
        }
    }
    
    return true;
};

/**
 * Check if a file path matches a pattern
 * @param {string} filePath - File path to check
 * @param {string} pattern - Pattern to match against
 * @returns {boolean} - True if file matches pattern
 */
const matchesPattern = (filePath, pattern) => {
    // Normalize paths - remove leading slash and ensure consistent separators
    const normalizedPath = filePath.replace(/^\/+/, '').replace(/\\/g, '/');
    const normalizedPattern = pattern.replace(/^\/+/, '').replace(/\\/g, '/');
    
    // Handle special case: ** matches everything
    if (normalizedPattern === '**') {
        return true;
    }
    
    // Simple pattern matching without complex regex
    return matchSimplePattern(normalizedPath, normalizedPattern);
};

/**
 * Simple pattern matching implementation
 * @param {string} path - Normalized file path
 * @param {string} pattern - Normalized pattern
 * @returns {boolean} - True if matches
 */
const matchSimplePattern = (path, pattern) => {
    // Split into segments
    const pathSegments = path.split('/');
    const patternSegments = pattern.split('/');
    
    let pathIndex = 0;
    let patternIndex = 0;
    
    while (patternIndex < patternSegments.length && pathIndex < pathSegments.length) {
        const patternSegment = patternSegments[patternIndex];
        const pathSegment = pathSegments[pathIndex];
        
        if (patternSegment === '**') {
            // ** matches zero or more segments
            patternIndex++;
            if (patternIndex >= patternSegments.length) {
                // ** at the end matches everything
                return true;
            }
            
            // Try to match the remaining pattern from current position onwards
            for (let i = pathIndex; i <= pathSegments.length; i++) {
                if (matchSimplePattern(pathSegments.slice(i).join('/'), patternSegments.slice(patternIndex).join('/'))) {
                    return true;
                }
            }
            return false;
        } else if (patternSegment === '*') {
            // * matches exactly one segment (but not empty)
            if (pathSegment === '') {
                return false;
            }
            pathIndex++;
            patternIndex++;
        } else if (patternSegment.includes('*')) {
            // Handle patterns like *.env, **.env, etc.
            if (matchSegmentPattern(pathSegment, patternSegment)) {
                pathIndex++;
                patternIndex++;
            } else if (patternSegment.startsWith('**') && patternSegment.length > 2) {
                // Handle **.env patterns - they should match files in any directory
                const suffix = patternSegment.substring(2);
                if (pathSegment.endsWith(suffix)) {
                    pathIndex++;
                    patternIndex++;
                } else {
                    // For **.env patterns, we can skip directories to find matching files
                    // But we need to be careful about the depth
                    // If this is the last segment and we have more than 2 path segments left,
                    // it means we're going too deep (but only for patterns with directory prefixes)
                    if (patternIndex === patternSegments.length - 1 && patternSegments.length > 1) {
                        const remainingSegments = pathSegments.length - pathIndex;
                        if (remainingSegments > 2) {
                            return false;
                        }
                    }
                    pathIndex++;
                }
            } else {
                return false;
            }
        } else {
            // Exact match required
            if (pathSegment === patternSegment) {
                pathIndex++;
                patternIndex++;
            } else {
                return false;
            }
        }
    }
    
    // Check if we've consumed all segments
    return pathIndex === pathSegments.length && patternIndex === patternSegments.length;
};

/**
 * Match a single segment against a pattern segment
 * @param {string} segment - Path segment
 * @param {string} patternSegment - Pattern segment
 * @returns {boolean} - True if matches
 */
const matchSegmentPattern = (segment, patternSegment) => {
    if (patternSegment === '*') {
        return segment !== '';
    }
    
    if (patternSegment === '**') {
        return true;
    }
    
    // Handle patterns like *.env, **.env
    if (patternSegment.startsWith('**')) {
        const suffix = patternSegment.substring(2);
        return segment.endsWith(suffix);
    }
    
    if (patternSegment.startsWith('*')) {
        const suffix = patternSegment.substring(1);
        return segment.endsWith(suffix);
    }
    
    if (patternSegment.endsWith('*')) {
        const prefix = patternSegment.substring(0, patternSegment.length - 1);
        return segment.startsWith(prefix);
    }
    
    // No wildcards, exact match
    return segment === patternSegment;
};

/**
 * Check if any pattern in a comma-separated list matches a file path
 * @param {string} filePath - File path to check
 * @param {string} patternsString - Comma-separated patterns
 * @returns {boolean} - True if any pattern matches
 */
const matchesAnyPattern = (filePath, patternsString) => {
    if (!patternsString) {
        return false;
    }
    
    const patterns = patternsString.split(',').map(p => p.trim()).filter(p => p);
    
    for (const pattern of patterns) {
        if (matchesPattern(filePath, pattern)) {
            return true;
        }
    }
    
    return false;
};

/**
 * Validate patterns in environment variable
 * @param {string} envVarName - Name of environment variable
 * @param {string} envVarValue - Value of environment variable
 * @returns {boolean} - True if all patterns are valid
 */
const validatePatterns = (envVarName, envVarValue) => {
    if (!envVarValue) {
        return true;
    }
    
    const patterns = envVarValue.split(',').map(p => p.trim()).filter(p => p);
    
    for (const pattern of patterns) {
        if (!isValidPattern(pattern)) {
            logger.error(`Invalid pattern in ${envVarName}: ${pattern}`);
            return false;
        }
    }
    
    return true;
};

/**
 * Check for invalid patterns in DONT_DELETE_TARGET_FILES
 * @returns {boolean} - True if all patterns are valid
 */
export const checkForInvalidDontDelete = () => {
    const envValue = process.env.DONT_DELETE_TARGET_FILES;
    return validatePatterns('DONT_DELETE_TARGET_FILES', envValue);
};

/**
 * Check for invalid patterns in DONT_OVERRIDE_TARGET_FILES
 * @returns {boolean} - True if all patterns are valid
 */
export const checkForInvalidDontOverride = () => {
    const envValue = process.env.DONT_OVERRIDE_TARGET_FILES;
    return validatePatterns('DONT_OVERRIDE_TARGET_FILES', envValue);
};

/**
 * Check if a file should be skipped for replacement (upload)
 * @param {string} localRelativePath - Relative path of the local file
 * @returns {boolean} - True if file should be skipped
 */
export const checkForSkipFileReplace = (localRelativePath) => {
    return matchesAnyPattern(localRelativePath, process.env.DONT_OVERRIDE_TARGET_FILES);
};

/**
 * Check if a file should be skipped for deletion
 * @param {string} localRelativePath - Relative path of the local file
 * @returns {boolean} - True if file should be skipped
 */
export const checkForSkipFileDelete = (localRelativePath) => {
    return matchesAnyPattern(localRelativePath, process.env.DONT_DELETE_TARGET_FILES);
};
