import { createLogger } from './logger.js';
const logger = createLogger('createPlan');

import { Plan, PlanStep } from './Plan.js';
import { checkForSkipFileReplace, checkForSkipFileDelete } from './skipFiles.js';

/**
 * Get the asset extensions
 * @returns {string[]}
 */
const getAssetExtensions = () => {
    if (process.env.ASSETS_EXTENSIONS) {
        return process.env.ASSETS_EXTENSIONS.split(',').map(extension => extension.toLowerCase().trim());
    }
    return [
        // Web assets
        'css', 'js',
        // Images
        'png', 'jpg', 'jpeg', 'svg', 'gif',
        'ico', 'webp',
        // Videos
        'mp4', 'webm',
        // Fonts
        'woff', 'woff2', 'ttf', 'eot', 'otf',
        // Misc
        'xml', 'json', 'txt', 'log',
        'md', 'markdown', 'yml'
    ];
};

/**
 * Check if a path is an asset
 * @param {string} path
 * @returns {boolean}
 */
const isAsset = (path) => {
    const assetExtensions = getAssetExtensions();
    return assetExtensions.some(extension => path.toLowerCase().endsWith(`.${extension}`));
};

/**
 * Get directory path from file path
 * @param {string} filePath
 * @returns {string}
 */
const getDirectoryPath = (filePath) => {
    const lastSlash = filePath.lastIndexOf('/');
    return lastSlash === -1 ? '' : filePath.substring(0, lastSlash);
};

/**
 * Get all directories from a list of files
 * @param {string[]} files
 * @returns {Set<string>}
 */
const getDirectories = (files) => {
    const directories = new Set();
    for (const file of files) {
        const dir = getDirectoryPath(file);
        if (dir) {
            directories.add(dir);
        }
    }
    return directories;
};

/**
 * Check if a path is a logic file (not an asset)
 * @param {string} path
 * @returns {boolean}
 */
const isLogicFile = (path) => {
    return !isAsset(path);
};

/**
 * Get relative path from base path
 * @param {string} fullPath - Full file path
 * @param {string} basePath - Base directory path
 * @returns {string} - Relative path from base
 */
const getRelativePath = (fullPath, basePath) => {
    if (!basePath) {
        return fullPath;
    }

    // If the full path is exactly the same as the base path, return empty string
    if (fullPath === basePath) {
        return '';
    }

    // Ensure base path ends with /
    const normalizedBase = basePath.endsWith('/') ? basePath : basePath + '/';

    if (fullPath.startsWith(normalizedBase)) {
        return fullPath.substring(normalizedBase.length);
    }

    return fullPath;
};

/**
 * Join base path with relative path
 * @param {string} basePath - Base directory path
 * @param {string} relativePath - Relative path
 * @returns {string} - Full path
 */
const joinPath = (basePath, relativePath) => {
    if (!basePath) {
        return relativePath;
    }

    // Ensure base path ends with /
    const normalizedBase = basePath.endsWith('/') ? basePath : basePath + '/';

    // Remove leading / from relative path if present
    const normalizedRelative = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;

    return normalizedBase + normalizedRelative;
};

/**
 * Create a plan for copying files from the source file system to the target file system
 * @param {FileSystem} sourceFs
 * @param {FileSystem} targetFs
 * @returns {Plan}
 */
export const createPlan = async (sourceFs, targetFs) => {
    // Scan the directories to get the files
    logger.debug('Scanning directories to get the files');
    await Promise.all([
        sourceFs.scanDirectory(),
        targetFs.scanDirectory(),
    ]);

    // Read all files on both sides
    logger.debug('Reading all files on both sides');
    const [sourceFiles, targetFiles] = await Promise.all([
        sourceFs.getFiles(),
        targetFs.getFiles(),
    ]);

    logger.debug(`Found ${sourceFiles.length} source files and ${targetFiles.length} target files`);

    // Get base paths from file systems
    const sourceBasePath = sourceFs.path || sourceFs.directory || '';
    const targetBasePath = targetFs.path || targetFs.directory || '';

    logger.debug(`Source base path: ${sourceBasePath}`);
    logger.debug(`Target base path: ${targetBasePath}`);

    // Create the plan
    const plan = new Plan();

    // Get all directories from source files
    const sourceDirectories = getDirectories(sourceFiles);
    const targetDirectories = getDirectories(targetFiles);

    for (const dir of sourceDirectories) {
        const relativeDir = getRelativePath(dir, sourceBasePath);

        // Skip if the relative directory is empty (means it's the base directory itself)
        if (!relativeDir || relativeDir === '' || relativeDir === '.') {
            continue;
        }

        const targetDir = joinPath(targetBasePath, relativeDir);

        // Step 1: Create missing directories
        if (!targetDirectories.has(targetDir)) {
            logger.trace(`Will create directory: ${targetDir}`);
            plan.stepCreateMissingDirectories.push(new PlanStep('create_directory', null, targetDir, sourceFs, targetFs));
        }
    }

    for (const sourceFile of sourceFiles) {
        const relativePath = getRelativePath(sourceFile, sourceBasePath);
        
        // Skip file if it matches DONT_OVERRIDE_TARGET_FILES pattern
        if (checkForSkipFileReplace(relativePath)) {
            logger.info(`Skipping file replacement due to DONT_OVERRIDE_TARGET_FILES: ${relativePath}`);
            continue;
        }
        
        // Step 2: Upload assets (upload all source assets to target, replacing existing ones)
        if (isAsset(sourceFile)) {
            const targetFile = joinPath(targetBasePath, relativePath);

            logger.trace(`Will upload asset: ${sourceFile} -> ${targetFile}`);
            plan.stepUploadAssets.push(new PlanStep('copy', sourceFile, targetFile, sourceFs, targetFs));
        }

        // Step 3: Upload logic files (upload all source logic files to target, replacing existing ones)
        if (isLogicFile(sourceFile)) {
            const targetFile = joinPath(targetBasePath, relativePath);

            logger.trace(`Will upload logic file: ${sourceFile} -> ${targetFile}`);
            plan.stepUploadLogic.push(new PlanStep('copy', sourceFile, targetFile, sourceFs, targetFs));
        }
    }

    for (const targetFile of targetFiles) {
        const relativePath = getRelativePath(targetFile, targetBasePath);
        
        // Skip file deletion if it matches DONT_DELETE_TARGET_FILES pattern
        if (checkForSkipFileDelete(relativePath)) {
            logger.info(`Skipping file deletion due to DONT_DELETE_TARGET_FILES: ${relativePath}`);
            continue;
        }
        if (checkForSkipFileReplace(relativePath)) {
            logger.info(`Skipping file replacement due to DONT_OVERRIDE_TARGET_FILES: ${relativePath}`);
            continue;
        }
        
        // Step 4: Remove old logic files (files that exist in target but not in source)
        if (isLogicFile(targetFile)) {
            const sourceFile = joinPath(sourceBasePath, relativePath);

            if (!sourceFiles.includes(sourceFile)) {
                logger.trace(`Will remove old logic file: ${targetFile}`);
                plan.stepRemoveOldLogic.push(new PlanStep('delete_file', null, targetFile, sourceFs, targetFs));
            }
        }
        
        // Step 5: Remove old assets (files that exist in target but not in source)
        if (isAsset(targetFile)) {
            const sourceFile = joinPath(sourceBasePath, relativePath);

            if (!sourceFiles.includes(sourceFile)) {
                logger.trace(`Will remove old asset: ${targetFile}`);
                plan.stepRemoveOldAssets.push(new PlanStep('delete_file', null, targetFile, sourceFs, targetFs));
            }
        }
    }

    // Step 6: Delete old directories (directories that exist in target but not in source)
    for (const targetDir of targetDirectories) {
        // Skip the target base directory itself - we never want to delete that
        if (targetDir === targetBasePath) {
            continue;
        }

        const relativeDir = getRelativePath(targetDir, targetBasePath);
        const sourceDir = joinPath(sourceBasePath, relativeDir);

        if (!sourceDirectories.has(sourceDir)) {
            logger.trace(`Will delete old directory: ${targetDir}`);
            plan.stepDeleteOldDirectories.push(new PlanStep('delete_directory', null, targetDir, sourceFs, targetFs));
        }
    }

    logger.info(`Plan created with ${plan.stepCreateMissingDirectories.length} directories to create, ` +
        `${plan.stepUploadAssets.length} assets to upload, ` +
        `${plan.stepUploadLogic.length} logic files to upload, ` +
        `${plan.stepRemoveOldLogic.length} old logic files to remove, ` +
        `${plan.stepRemoveOldAssets.length} old assets to remove, ` +
        `${plan.stepDeleteOldDirectories.length} old directories to delete`);

    return plan;
};