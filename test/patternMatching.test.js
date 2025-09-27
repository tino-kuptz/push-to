import { expect } from 'chai';
import { 
    checkForSkipFileReplace, 
    checkForSkipFileDelete, 
    checkForInvalidDontDelete, 
    checkForInvalidDontOverride 
} from '../lib/skipFiles.js';

describe('Pattern Matching', () => {
    beforeEach(() => {
        // Clear environment variables
        delete process.env.DONT_DELETE_TARGET_FILES;
        delete process.env.DONT_OVERRIDE_TARGET_FILES;
    });

    describe('checkForSkipFileReplace', () => {
        it('should not skip files when DONT_OVERRIDE_TARGET_FILES is not set', () => {
            const result = checkForSkipFileReplace('/test/file.txt');
            expect(result).to.be.false;
        });

        it('should not skip files when DONT_OVERRIDE_TARGET_FILES is empty', () => {
            process.env.DONT_OVERRIDE_TARGET_FILES = '';
            const result = checkForSkipFileReplace('/test/file.txt');
            expect(result).to.be.false;
        });

        it('should skip files matching single pattern', () => {
            process.env.DONT_OVERRIDE_TARGET_FILES = '*.env';
            expect(checkForSkipFileReplace('/.env')).to.be.true;
            expect(checkForSkipFileReplace('/test.env')).to.be.true;
            expect(checkForSkipFileReplace('/sub/.env')).to.be.false;
            expect(checkForSkipFileReplace('/index.html')).to.be.false;
        });

        it('should skip files matching **.env pattern', () => {
            process.env.DONT_OVERRIDE_TARGET_FILES = '**.env';
            expect(checkForSkipFileReplace('/.env')).to.be.true;
            expect(checkForSkipFileReplace('/test.env')).to.be.true;
            expect(checkForSkipFileReplace('/sub/.env')).to.be.true;
            expect(checkForSkipFileReplace('/deep/nested/.env')).to.be.true;
            expect(checkForSkipFileReplace('/index.html')).to.be.false;
        });

        it('should skip files matching **/.env pattern', () => {
            process.env.DONT_OVERRIDE_TARGET_FILES = '**/.env';
            expect(checkForSkipFileReplace('/.env')).to.be.true;
            expect(checkForSkipFileReplace('/sub/.env')).to.be.true;
            expect(checkForSkipFileReplace('/deep/nested/.env')).to.be.true;
            expect(checkForSkipFileReplace('/test.env')).to.be.false;
            expect(checkForSkipFileReplace('/index.html')).to.be.false;
        });

        it('should skip files matching worker/*.env pattern', () => {
            process.env.DONT_OVERRIDE_TARGET_FILES = 'worker/*.env';
            expect(checkForSkipFileReplace('/worker/.env')).to.be.true;
            expect(checkForSkipFileReplace('/worker/test.env')).to.be.true;
            expect(checkForSkipFileReplace('/.env')).to.be.false;
            expect(checkForSkipFileReplace('/worker/sub/.env')).to.be.false;
            expect(checkForSkipFileReplace('/index.html')).to.be.false;
        });

        it('should skip files matching worker/**/.env pattern', () => {
            process.env.DONT_OVERRIDE_TARGET_FILES = 'worker/**/.env';
            expect(checkForSkipFileReplace('/worker/.env')).to.be.true;
            expect(checkForSkipFileReplace('/worker/sub/.env')).to.be.true;
            expect(checkForSkipFileReplace('/worker/deep/nested/.env')).to.be.true;
            expect(checkForSkipFileReplace('/worker/test.env')).to.be.false;
            expect(checkForSkipFileReplace('/.env')).to.be.false;
        });

        it('should skip files matching worker/**.env pattern', () => {
            process.env.DONT_OVERRIDE_TARGET_FILES = 'worker/**.env';
            expect(checkForSkipFileReplace('/worker/.env')).to.be.true;
            expect(checkForSkipFileReplace('/worker/test.env')).to.be.true;
            expect(checkForSkipFileReplace('/worker/sub/.env')).to.be.true;
            expect(checkForSkipFileReplace('/worker/sub/test.env')).to.be.true;
            expect(checkForSkipFileReplace('/worker/sub/sub/.env')).to.be.false; // too deep
            expect(checkForSkipFileReplace('/.env')).to.be.false;
        });

        it('should handle multiple patterns', () => {
            process.env.DONT_OVERRIDE_TARGET_FILES = '**/.env,**.config,**.ini';
            expect(checkForSkipFileReplace('/.env')).to.be.true;
            expect(checkForSkipFileReplace('/test.config')).to.be.true;
            expect(checkForSkipFileReplace('/settings.ini')).to.be.true;
            expect(checkForSkipFileReplace('/sub/.env')).to.be.true;
            expect(checkForSkipFileReplace('/sub/app.config')).to.be.true;
            expect(checkForSkipFileReplace('/index.html')).to.be.false;
        });

        it('should handle ** pattern (matches everything)', () => {
            process.env.DONT_OVERRIDE_TARGET_FILES = '**';
            expect(checkForSkipFileReplace('/.env')).to.be.true;
            expect(checkForSkipFileReplace('/index.html')).to.be.true;
            expect(checkForSkipFileReplace('/sub/file.txt')).to.be.true;
            expect(checkForSkipFileReplace('/deep/nested/file.js')).to.be.true;
        });

        it('should handle * pattern (matches root files only)', () => {
            process.env.DONT_OVERRIDE_TARGET_FILES = '*';
            expect(checkForSkipFileReplace('/index.html')).to.be.true;
            expect(checkForSkipFileReplace('/.env')).to.be.true;
            expect(checkForSkipFileReplace('/sub/file.txt')).to.be.false;
            expect(checkForSkipFileReplace('/deep/nested/file.js')).to.be.false;
        });
    });

    describe('checkForSkipFileDelete', () => {
        it('should not skip files when DONT_DELETE_TARGET_FILES is not set', () => {
            const result = checkForSkipFileDelete('/test/file.txt');
            expect(result).to.be.false;
        });

        it('should skip files matching backup/** pattern', () => {
            process.env.DONT_DELETE_TARGET_FILES = 'backup/**';
            expect(checkForSkipFileDelete('/backup/old.txt')).to.be.true;
            expect(checkForSkipFileDelete('/backup/sub/file.txt')).to.be.true;
            expect(checkForSkipFileDelete('/backup/deep/nested/file.txt')).to.be.true;
            expect(checkForSkipFileDelete('/index.html')).to.be.false;
            expect(checkForSkipFileDelete('/other/file.txt')).to.be.false;
        });

        it('should skip files matching **/.env pattern', () => {
            process.env.DONT_DELETE_TARGET_FILES = '**/.env';
            expect(checkForSkipFileDelete('/.env')).to.be.true;
            expect(checkForSkipFileDelete('/sub/.env')).to.be.true;
            expect(checkForSkipFileDelete('/deep/nested/.env')).to.be.true;
            expect(checkForSkipFileDelete('/test.env')).to.be.false;
            expect(checkForSkipFileDelete('/index.html')).to.be.false;
        });

        it('should handle multiple patterns for deletion', () => {
            process.env.DONT_DELETE_TARGET_FILES = '**/.env,backup/**,*.config';
            expect(checkForSkipFileDelete('/.env')).to.be.true;
            expect(checkForSkipFileDelete('/backup/old.txt')).to.be.true;
            expect(checkForSkipFileDelete('/app.config')).to.be.true;
            expect(checkForSkipFileDelete('/sub/.env')).to.be.true;
            expect(checkForSkipFileDelete('/backup/sub/file.txt')).to.be.true;
            expect(checkForSkipFileDelete('/index.html')).to.be.false;
        });
    });

    describe('Pattern Validation', () => {
        describe('checkForInvalidDontDelete', () => {
            it('should return true for valid patterns', () => {
                process.env.DONT_DELETE_TARGET_FILES = '**/.env,*.config';
                expect(checkForInvalidDontDelete()).to.be.true;
            });

            it('should return true when DONT_DELETE_TARGET_FILES is not set', () => {
                expect(checkForInvalidDontDelete()).to.be.true;
            });

            it('should return true when DONT_DELETE_TARGET_FILES is empty', () => {
                process.env.DONT_DELETE_TARGET_FILES = '';
                expect(checkForInvalidDontDelete()).to.be.true;
            });

            it('should return false for invalid patterns', () => {
                process.env.DONT_DELETE_TARGET_FILES = '***/.env';
                expect(checkForInvalidDontDelete()).to.be.false;
            });

            it('should return false for mixed wildcard patterns', () => {
                process.env.DONT_DELETE_TARGET_FILES = '**/*.env';
                expect(checkForInvalidDontDelete()).to.be.false;
            });

            it('should return true for **.keep pattern', () => {
                process.env.DONT_DELETE_TARGET_FILES = '**.keep';
                expect(checkForInvalidDontDelete()).to.be.true;
            });
        });

        describe('checkForInvalidDontOverride', () => {
            it('should return true for valid patterns', () => {
                process.env.DONT_OVERRIDE_TARGET_FILES = 'worker/*.js';
                expect(checkForInvalidDontOverride()).to.be.true;
            });

            it('should return true when DONT_OVERRIDE_TARGET_FILES is not set', () => {
                expect(checkForInvalidDontOverride()).to.be.true;
            });

            it('should return true when DONT_OVERRIDE_TARGET_FILES is empty', () => {
                process.env.DONT_OVERRIDE_TARGET_FILES = '';
                expect(checkForInvalidDontOverride()).to.be.true;
            });

            it('should return false for invalid patterns', () => {
                process.env.DONT_OVERRIDE_TARGET_FILES = '***/.env';
                expect(checkForInvalidDontOverride()).to.be.false;
            });

            it('should return false for mixed wildcard patterns', () => {
                process.env.DONT_OVERRIDE_TARGET_FILES = '**/*.env';
                expect(checkForInvalidDontOverride()).to.be.false;
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty file paths', () => {
            process.env.DONT_OVERRIDE_TARGET_FILES = '**';
            expect(checkForSkipFileReplace('')).to.be.true;
        });

        it('should handle root path', () => {
            process.env.DONT_OVERRIDE_TARGET_FILES = '**';
            expect(checkForSkipFileReplace('/')).to.be.true;
        });

        it('should handle paths without leading slash', () => {
            process.env.DONT_OVERRIDE_TARGET_FILES = '*.html';
            expect(checkForSkipFileReplace('index.html')).to.be.true;
            expect(checkForSkipFileReplace('/index.html')).to.be.true;
        });

        it('should handle paths with multiple slashes', () => {
            process.env.DONT_OVERRIDE_TARGET_FILES = '**/.env';
            expect(checkForSkipFileReplace('//.env')).to.be.true;
            expect(checkForSkipFileReplace('///.env')).to.be.true;
        });

        it('should handle patterns with spaces', () => {
            process.env.DONT_OVERRIDE_TARGET_FILES = ' *.env, **.config ';
            expect(checkForSkipFileReplace('/.env')).to.be.true;
            expect(checkForSkipFileReplace('/app.config')).to.be.true;
        });

        it('should handle patterns with empty segments', () => {
            process.env.DONT_OVERRIDE_TARGET_FILES = '**/.env,,*.config';
            expect(checkForSkipFileReplace('/.env')).to.be.true;
            expect(checkForSkipFileReplace('/app.config')).to.be.true;
        });
    });

    describe('Complex Pattern Combinations', () => {
        it('should handle complex real-world patterns', () => {
            process.env.DONT_OVERRIDE_TARGET_FILES = '**/.env,**.config,**.ini,backup/**,*.log';
            
            // Should skip
            expect(checkForSkipFileReplace('/.env')).to.be.true;
            expect(checkForSkipFileReplace('/app.config')).to.be.true;
            expect(checkForSkipFileReplace('/settings.ini')).to.be.true;
            expect(checkForSkipFileReplace('/backup/old.txt')).to.be.true;
            expect(checkForSkipFileReplace('/error.log')).to.be.true;
            expect(checkForSkipFileReplace('/sub/.env')).to.be.true;
            expect(checkForSkipFileReplace('/sub/app.config')).to.be.true;
            expect(checkForSkipFileReplace('/backup/sub/file.txt')).to.be.true;
            
            // Should not skip
            expect(checkForSkipFileReplace('/index.html')).to.be.false;
            expect(checkForSkipFileReplace('/style.css')).to.be.false;
            expect(checkForSkipFileReplace('/script.js')).to.be.false;
        });

        it('should handle patterns with different directory depths', () => {
            process.env.DONT_OVERRIDE_TARGET_FILES = '*.env,worker/*.env,worker/**/.env,worker/**.env';
            
            // Root level
            expect(checkForSkipFileReplace('/.env')).to.be.true;
            expect(checkForSkipFileReplace('/test.env')).to.be.true;
            
            // Worker directory
            expect(checkForSkipFileReplace('/worker/.env')).to.be.true;
            expect(checkForSkipFileReplace('/worker/test.env')).to.be.true;
            expect(checkForSkipFileReplace('/worker/sub/.env')).to.be.true;
            expect(checkForSkipFileReplace('/worker/sub/test.env')).to.be.true;
            
            // Should not skip
            expect(checkForSkipFileReplace('/sub/.env')).to.be.false;
            expect(checkForSkipFileReplace('/index.html')).to.be.false;
        });
    });
});
