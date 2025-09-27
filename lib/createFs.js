import { LocalFileSystem } from './fileSystem/local.js';
import { FtpFileSystem } from './fileSystem/ftp.js';
import { FtpsFileSystem } from './fileSystem/ftps.js';
import { SftpFileSystem } from './fileSystem/sftp.js';

/**
 * Create a file system object from a URL
 * @param {string} url
 * @param {Object} config
 * @returns {FileSystem}
 */
export const createFs = (url, config) => {
    if (url.toLowerCase().startsWith('ftp://')) {
        return new FtpFileSystem(url, config);
    }
    if (url.toLowerCase().startsWith('ftps://')) {
        return new FtpsFileSystem(url, config);
    }
    if (url.toLowerCase().startsWith('sftp://')) {
        return new SftpFileSystem(url, config);
    }
    return new LocalFileSystem(url, config);
};