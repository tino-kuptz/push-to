import Client from 'ftp';
import { URL } from 'url';

import { createLogger } from '../logger.js';

/**
 * Class to handle FTP file system operations
 */
export class FtpFileSystem {
    logger;
    client;
    config;
    url;
    host;
    port;
    directory;
    files;

    /**
     * Constructor
     * @param {string} url - FTP URL (e.g., "ftp://host[:port]/directory")
     * @param {Object} config - Configuration object
     * @param {string} config.USERNAME - FTP username
     * @param {string} config.PASSWORD - FTP password
     * @param {boolean} [config.IGNORE_SSL_TRUST] - Ignore SSL certificate trust (not applicable for FTP)
     */
    constructor(url, config = {}) {
        this.logger = createLogger('FtpFileSystem');
        this.url = url;
        this.config = config;
        this.files = [];
        
        // Parse the URL
        const parsedUrl = new URL(url);
        this.host = parsedUrl.hostname;
        this.port = parsedUrl.port ? parseInt(parsedUrl.port) : 21;
        this.directory = parsedUrl.pathname || '/';
        
        this.logger.debug(`Initialized FTP client for ${this.host}:${this.port}${this.directory}`);
    }

    /**
     * Connect to FTP server
     * @returns {Promise<void>}
     */
    async connect() {
        return new Promise((resolve, reject) => {
            this.client = new Client();
            
            this.client.on('ready', () => {
                this.logger.debug('FTP connection established');
                resolve();
            });
            
            this.client.on('error', (err) => {
                this.logger.error('FTP connection error:', err);
                reject(err);
            });
            
            this.client.connect({
                host: this.host,
                port: this.port,
                user: this.config.USERNAME,
                password: this.config.PASSWORD
            });
        });
    }

    /**
     * Disconnect from FTP server
     * @returns {Promise<void>}
     */
    async disconnect() {
        return new Promise((resolve) => {
            if (this.client) {
                this.client.end();
                this.client = null;
            }
            resolve();
        });
    }

    /**
     * Get relative path from absolute path based on this file system's base path
     * @param {string} absolutePath - Absolute file path
     * @returns {string} - Relative path from base path
     */
    getAsRelativePath(absolutePath) {
        if (!this.directory) {
            return absolutePath;
        }
        
        // Ensure base path ends with /
        const normalizedBase = this.directory.endsWith('/') ? this.directory : this.directory + '/';
        
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
        this.logger.debug(`Scanning FTP directory ${this.directory}`);
        this.files = [];
        
        await this._scanDirectoryRecursive(this.directory);
    }

    /**
     * Recursively scan directory
     * @param {string} dir - Directory path
     * @returns {Promise<void>}
     */
    async _scanDirectoryRecursive(dir) {
        return new Promise((resolve, reject) => {
            this.client.list(dir, (err, list) => {
                if (err) {
                    this.logger.error(`Error listing directory ${dir}:`, err);
                    reject(err);
                    return;
                }
                
                const promises = [];
                
                for (const item of list) {
                    const fullPath = `${dir}/${item.name}`.replace(/\/+/g, '/');
                    
                    if (item.type === 'd') {
                        // Directory
                        this.logger.trace(`Found directory ${fullPath}`);
                        promises.push(this._scanDirectoryRecursive(fullPath));
                    } else {
                        // File
                        this.logger.trace(`Found file ${fullPath}`);
                        this.files.push(fullPath);
                    }
                }
                
                if (promises.length > 0) {
                    this.logger.trace(`Waiting for ${promises.length} found sub directories`);
                    Promise.all(promises).then(resolve).catch(reject);
                } else {
                    resolve();
                }
            });
        });
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
        
        if (process.env.DRY_RUN === "true") {
            return;
        }
        
        return new Promise((resolve, reject) => {
            this.client.put(content, path, (err) => {
                if (err) {
                    this.logger.error(`Error writing file ${path}:`, err);
                    reject(err);
                } else {
                    this.logger.debug(`Successfully wrote file ${path}`);
                    resolve();
                }
            });
        });
    }

    /**
     * Reads a file
     * @param {string} path
     * @returns {Promise<Buffer>}
     */
    async readFile(path) {
        this.logger.debug(`Reading file ${path}`);
        
        return new Promise((resolve, reject) => {
            this.client.get(path, (err, stream) => {
                if (err) {
                    this.logger.error(`Error reading file ${path}:`, err);
                    reject(err);
                    return;
                }
                
                const chunks = [];
                stream.on('data', (chunk) => {
                    chunks.push(chunk);
                });
                
                stream.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    this.logger.debug(`Successfully read file ${path}`);
                    resolve(buffer);
                });
                
                stream.on('error', (err) => {
                    this.logger.error(`Stream error reading file ${path}:`, err);
                    reject(err);
                });
            });
        });
    }

    /**
     * Deletes a file
     * @param {string} path
     * @returns {Promise<void>}
     */
    async deleteFile(path) {
        this.logger.debug(`Deleting file ${path}`);
        
        if (process.env.DRY_RUN === "true") {
            return;
        }
        
        return new Promise((resolve, reject) => {
            this.client.delete(path, (err) => {
                if (err) {
                    this.logger.warn(`Error deleting file ${path}:`, err);
                    resolve();
                } else {
                    this.logger.debug(`Successfully deleted file ${path}`);
                    resolve();
                }
            });
        });
    }

    /**
     * Creates a directory
     * @param {string} path
     * @returns {Promise<void>}
     */
    async createDirectory(path) {
        this.logger.debug(`Creating directory ${path}`);
        
        if (process.env.DRY_RUN === "true") {
            return;
        }
        
        return new Promise((resolve, reject) => {
            this.client.mkdir(path, true, (err) => {
                if (err) {
                    this.logger.error(`Error creating directory ${path}:`, err);
                    reject(err);
                } else {
                    this.logger.debug(`Successfully created directory ${path}`);
                    resolve();
                }
            });
        });
    }

    /**
     * Deletes a directory
     * @param {string} path
     * @returns {Promise<void>}
     */
    async deleteDirectory(path) {
        this.logger.debug(`Deleting directory ${path}`);
        
        if (process.env.DRY_RUN === "true") {
            return;
        }
        
        return new Promise((resolve, reject) => {
            this.client.rmdir(path, true, (err) => {
                if (err) {
                    this.logger.warn(`Error deleting directory ${path}:`, err);
                    resolve();
                } else {
                    this.logger.debug(`Successfully deleted directory ${path}`);
                    resolve();
                }
            });
        });
    }
}
