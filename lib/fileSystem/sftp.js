import SftpClient from 'ssh2-sftp-client';
import { URL } from 'url';

import { createLogger } from '../logger.js';

/**
 * Class to handle SFTP file system operations
 */
export class SftpFileSystem {
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
     * @param {string} url - SFTP URL (e.g., "sftp://host[:port]/directory")
     * @param {Object} config - Configuration object
     * @param {string} config.USERNAME - SFTP username
     * @param {string} config.PASSWORD - SFTP password
     * @param {boolean} [config.IGNORE_SSL_TRUST] - Ignore SSL certificate trust
     */
    constructor(url, config = {}) {
        this.logger = createLogger('SftpFileSystem');
        this.url = url;
        this.config = config;
        this.files = [];
        
        // Parse the URL
        const parsedUrl = new URL(url);
        this.host = parsedUrl.hostname;
        this.port = parsedUrl.port ? parseInt(parsedUrl.port) : 22;
        this.directory = parsedUrl.pathname || '/';
        
        this.logger.debug(`Initialized SFTP client for ${this.host}:${this.port}${this.directory}`);
    }

    /**
     * Connect to SFTP server
     * @returns {Promise<void>}
     */
    async connect() {
        this.client = new SftpClient();

        this.logger.trace('Connecting to SFTP server '+  this.config.USERNAME + '@' + this.host + ':' + this.port + this.directory);
        
        const connectionConfig = {
            host: this.host,
            port: this.port,
            username: this.config.USERNAME,
            password: this.config.PASSWORD
        };
        
        // Add SSL trust configuration if specified
        if (this.config.IGNORE_SSL_TRUST) {
            connectionConfig.algorithms = {
                serverHostKey: ['ssh-rsa', 'ssh-dss']
            };
            connectionConfig.hostVerifier = () => true;
        }
        
        try {
            await this.client.connect(connectionConfig);
            this.logger.debug('SFTP connection established');
        } catch (err) {
            this.logger.error('SFTP connection error: '+ err.message);
            throw err;
        }
    }

    /**
     * Disconnect from SFTP server
     * @returns {Promise<void>}
     */
    async disconnect() {
        if (this.client) {
            await this.client.end();
            this.client = null;
        }
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
        this.logger.debug(`Scanning SFTP directory ${this.directory}`);
        this.files = [];
        
        await this._scanDirectoryRecursive(this.directory);
    }

    /**
     * Recursively scan directory
     * @param {string} dir - Directory path
     * @returns {Promise<void>}
     */
    async _scanDirectoryRecursive(dir) {
        try {
            const list = await this.client.list(dir);
            
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
                await Promise.all(promises);
            }
        } catch (err) {
            this.logger.error(`Error listing directory ${dir}: ${err.message}`);
            throw err;
        }
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
        
        try {
            await this.client.put(content, path);
            this.logger.debug(`Successfully wrote file ${path}`);
        } catch (err) {
            this.logger.error(`Error writing file ${path}: ${err.message}`);
            throw err;
        }
    }

    /**
     * Reads a file
     * @param {string} path
     * @returns {Promise<Buffer>}
     */
    async readFile(path) {
        this.logger.debug(`Reading file ${path}`);
        
        try {
            const buffer = await this.client.get(path);
            this.logger.debug(`Successfully read file ${path}`);
            return buffer;
        } catch (err) {
            this.logger.error(`Error reading file ${path}: ${err.message}`);
            throw err;
        }
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
        
        try {
            await this.client.delete(path);
            this.logger.debug(`Successfully deleted file ${path}`);
        } catch (err) {
            this.logger.warn(`Error deleting file ${path}: ${err.message}`);
        }
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
        
        try {
            await this.client.mkdir(path, true);
            this.logger.debug(`Successfully created directory ${path}`);
        } catch (err) {
            this.logger.error(`Error creating directory ${path}: ${err.message}`);
            throw err;
        }
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
        
        try {
            await this.client.rmdir(path, true);
            this.logger.debug(`Successfully deleted directory ${path}`);
        } catch (err) {
            this.logger.warn(`Error deleting directory ${path}: ${err.message}`);
        }
    }
}
