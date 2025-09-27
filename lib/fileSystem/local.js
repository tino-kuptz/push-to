import fs from 'fs/promises';

import { createLogger } from '../logger.js';

/**
 * Class to handle a local file system
 */
export class LocalFileSystem {
    logger;

    files;

    /**
     * Constructor
     * The config object is unused, it's just here to make the interface consistent with the other file systems
     * @param {string} path
     * @param {Object} _config
     */
    constructor(path, _config = {}) {
        this.logger = createLogger('LocalFileSystem');
        this.path = path;
    }

    /**
     * Connect to the file system (no-op for local file system)
     * @returns {Promise<void>}
     */
    async connect() {
        this.logger.trace('Local file system - no connection needed');
    }

    /**
     * Disconnect from the file system (no-op for local file system)
     * @returns {Promise<void>}
     */
    async disconnect() {
        this.logger.trace('Local file system - no disconnection needed');
    }

    /**
     * Get relative path from absolute path based on this file system's base path
     * @param {string} absolutePath - Absolute file path
     * @returns {string} - Relative path from base path
     */
    getAsRelativePath(absolutePath) {
        if (!this.path) {
            return absolutePath;
        }
        
        // Ensure base path ends with /
        const normalizedBase = this.path.endsWith('/') ? this.path : this.path + '/';
        
        if (absolutePath.startsWith(normalizedBase)) {
            return absolutePath.substring(normalizedBase.length);
        }
        
        return absolutePath;
    }

    /**
     * Scan the directory and all sub directories
     * @returns {Promise<void>}
     */
    async scanDirectory() {
        const readDirRecursive = async (dir) => {
            this.logger.trace(`Read recursive ${dir}`);
            const entries = await fs.readdir(dir, { withFileTypes: true });
            var promises = [];
            for (const entry of entries) {
                const fullPath = `${dir}/${entry.name}`;
                if (entry.isDirectory()) {
                    this.logger.trace(`Found directory ${fullPath}`);
                    promises.push(readDirRecursive(fullPath));
                } else {
                    this.logger.trace(`Found file ${fullPath}`);
                    this.files.push(fullPath);
                }
            }
            if(promises.length > 0) {
                this.logger.trace(`Waiting for ${promises.length} found sub directories`);
                await Promise.all(promises);
            }
        };

        this.logger.debug(`Scanning local directory ${this.path}`);
        this.files = [];

        await readDirRecursive(this.path);
    }

    /**
     * Get the files
     * @returns {Array<string>}
     */
    async getFiles() {
        return this.files;
    }

    /**
     * Writes a file
     * @param {string} path
     * @param {Buffer} content
     * @returns {Promise<void>}
     */
    async writeFile(path, content) {
        this.logger.debug(`Writing file ${path}`);
        if (process.env.PLUGIN_DRY_RUN === "true") {
            return;
        }
        await fs.writeFile(path, content);
    }

    /**
     * Reads a file
     * @param {string} path
     * @returns {Promise<Buffer>}
     */
    async readFile(path) {
        this.logger.debug(`Reading file ${path}`);
        return await fs.readFile(path);
    }

    /**
     * Deletes a file
     * @param {string} path
     * @returns {Promise<void>}
     */
    async deleteFile(path) {
        this.logger.debug(`Deleting file ${path}`);
        if (process.env.PLUGIN_DRY_RUN === "true") {
            return;
        }
        await fs.unlink(path);
    }

    /**
     * Creates a directory
     * @param {string} path
     * @returns {Promise<void>}
     */
    async createDirectory(path) {
        this.logger.debug(`Creating directory ${path}`);
        if (process.env.PLUGIN_DRY_RUN === "true") {
            return;
        }
        await fs.mkdir(path, { recursive: true });
    }

    /**
     * Deletes a directory
     * @param {string} path
     * @returns {Promise<void>}
     */
    async deleteDirectory(path) {
        this.logger.debug(`Deleting directory ${path}`);
        if (process.env.PLUGIN_DRY_RUN === "true") {
            return;
        }
        await fs.rmdir(path, { recursive: true });
    }
}