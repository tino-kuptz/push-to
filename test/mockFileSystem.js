/**
 * Mock File System for testing
 * Allows setting up custom file structures and tracking operations
 */
export class MockFileSystem {
    constructor(path) {
        this.path = path;
        this.files = new Map(); // path -> content
        this.directories = new Set(); // directory paths
        this.operations = []; // track all operations for testing
    }

    /**
     * Initialize the file system with custom files and directories
     * @param {Object} structure - { files: { path: content }, directories: [path1, path2] }
     */
    init(structure = {}) {
        this.files.clear();
        this.directories.clear();
        this.operations = [];

        // Add directories
        if (structure.directories) {
            structure.directories.forEach(dir => {
                this.directories.add(dir);
            });
        }

        // Add files
        if (structure.files) {
            Object.entries(structure.files).forEach(([path, content]) => {
                this.files.set(path, content);
                // Ensure parent directories exist
                const parentDir = this.getDirectoryPath(path);
                if (parentDir && parentDir !== '') {
                    this.directories.add(parentDir);
                }
            });
        }
    }

    /**
     * Get all files in the file system
     * @returns {Array} Array of file paths
     */
    getFiles() {
        return Array.from(this.files.keys());
    }

    /**
     * Scan directory and return all files
     * @param {string} directory - Directory to scan
     * @returns {Array} Array of file paths
     */
    async scanDirectory(directory) {
        this.operations.push({ type: 'scanDirectory', path: directory });
        const files = [];
        
        for (const filePath of this.files.keys()) {
            if (filePath.startsWith(directory)) {
                files.push(filePath);
            }
        }
        
        return files;
    }

    /**
     * Read file content
     * @param {string} filePath - Path to file
     * @returns {string} File content
     */
    async readFile(filePath) {
        this.operations.push({ type: 'readFile', path: filePath });
        if (!this.files.has(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        return this.files.get(filePath);
    }

    /**
     * Write file content
     * @param {string} filePath - Path to file
     * @param {string} content - Content to write
     */
    async writeFile(filePath, content) {
        this.operations.push({ type: 'writeFile', path: filePath, content });
        this.files.set(filePath, content);
        
        // Ensure parent directory exists
        const parentDir = this.getDirectoryPath(filePath);
        if (parentDir && parentDir !== '') {
            this.directories.add(parentDir);
        }
    }

    /**
     * Delete file
     * @param {string} filePath - Path to file
     */
    async deleteFile(filePath) {
        this.operations.push({ type: 'deleteFile', path: filePath });
        this.files.delete(filePath);
    }

    /**
     * Create directory
     * @param {string} dirPath - Path to directory
     */
    async createDirectory(dirPath) {
        this.operations.push({ type: 'createDirectory', path: dirPath });
        this.directories.add(dirPath);
    }

    /**
     * Delete directory
     * @param {string} dirPath - Path to directory
     */
    async deleteDirectory(dirPath) {
        this.operations.push({ type: 'deleteDirectory', path: dirPath });
        this.directories.delete(dirPath);
    }

    /**
     * Connect (no-op for mock)
     */
    async connect() {
        this.operations.push({ type: 'connect' });
    }

    /**
     * Disconnect (no-op for mock)
     */
    async disconnect() {
        this.operations.push({ type: 'disconnect' });
    }

    /**
     * Get relative path from base path
     * @param {string} absolutePath - Absolute path
     * @returns {string} Relative path
     */
    getAsRelativePath(absolutePath) {
        if (absolutePath.startsWith(this.path)) {
            return absolutePath.substring(this.path.length).replace(/^\/+/, '');
        }
        return absolutePath;
    }

    /**
     * Get directory path from file path
     * @param {string} filePath - File path
     * @returns {string} Directory path
     */
    getDirectoryPath(filePath) {
        const lastSlash = filePath.lastIndexOf('/');
        if (lastSlash === -1) return '';
        return filePath.substring(0, lastSlash);
    }

    /**
     * Check if file exists
     * @param {string} filePath - File path
     * @returns {boolean} True if file exists
     */
    fileExists(filePath) {
        return this.files.has(filePath);
    }

    /**
     * Check if directory exists
     * @param {string} dirPath - Directory path
     * @returns {boolean} True if directory exists
     */
    directoryExists(dirPath) {
        return this.directories.has(dirPath);
    }

    /**
     * Get all operations performed
     * @returns {Array} Array of operations
     */
    getOperations() {
        return [...this.operations];
    }

    /**
     * Clear operations history
     */
    clearOperations() {
        this.operations = [];
    }

    /**
     * Get file structure for debugging
     * @returns {Object} File structure
     */
    getStructure() {
        return {
            files: Object.fromEntries(this.files),
            directories: Array.from(this.directories)
        };
    }
}
