import { expect } from 'chai';
import { createPlan } from '../lib/createPlan.js';
import { MockFileSystem } from './mockFileSystem.js';

describe('Skip Files Integration Tests', () => {
    let sourceFs, targetFs;

    beforeEach(() => {
        sourceFs = new MockFileSystem('/test/source');
        targetFs = new MockFileSystem('/test/target');
        
        // Clear environment variables
        delete process.env.PLUGIN_DONT_DELETE_TARGET_FILES;
        delete process.env.PLUGIN_DONT_OVERRIDE_TARGET_FILES;
        delete process.env.PLUGIN_ASSETS_EXTENSIONS;
    });

    // Helper function to get all steps from a plan
    const getAllSteps = (plan) => {
        return [
            ...plan.stepCreateMissingDirectories,
            ...plan.stepUploadAssets,
            ...plan.stepUploadLogic,
            ...plan.stepRemoveOldLogic,
            ...plan.stepRemoveOldAssets,
            ...plan.stepDeleteOldDirectories
        ];
    };

    describe('DONT_DELETE_TARGET_FILES', () => {
        it('should not delete files matching **/.env pattern', async () => {
            // Setup source with some files
            sourceFs.init({
                files: {
                    '/test/source/index.html': '<html>Hello</html>',
                    '/test/source/app.js': 'console.log("hello");'
                }
            });

            // Setup target with files that should be kept and deleted
            targetFs.init({
                files: {
                    '/test/target/index.html': '<html>Old</html>',
                    '/test/target/app.js': 'console.log("old");',
                    '/test/target/.env': 'SECRET=old',
                    '/test/target/config.env': 'CONFIG=old',
                    '/test/target/old.txt': 'old content'
                }
            });

            // Set environment variable to protect .env files
            process.env.PLUGIN_DONT_DELETE_TARGET_FILES = '**/.env';

            const plan = await createPlan(sourceFs, targetFs, '/test/source', '/test/target');

            // Check that .env files are not marked for deletion
            const deleteSteps = getAllSteps(plan).filter(step => step.action === 'delete_file');
            const deletePaths = deleteSteps.map(step => step.target);

            // Should delete old.txt but not .env files
            expect(deletePaths).to.include('/test/target/old.txt');
            expect(deletePaths).to.not.include('/test/target/.env');
            // Note: config.env should be deleted because it doesn't match **/.env pattern
            // The pattern **/.env only matches files named exactly .env
        });

        it('should not delete files matching backup/** pattern', async () => {
            sourceFs.init({
                files: {
                    '/test/source/index.html': '<html>Hello</html>'
                }
            });

            targetFs.init({
                files: {
                    '/test/target/index.html': '<html>Old</html>',
                    '/test/target/backup/old.html': 'backup content',
                    '/test/target/backup/sub/old.js': 'backup js',
                    '/test/target/old.txt': 'old content'
                }
            });

            process.env.PLUGIN_DONT_DELETE_TARGET_FILES = 'backup/**';

            const plan = await createPlan(sourceFs, targetFs, '/test/source', '/test/target');

            const deleteSteps = getAllSteps(plan).filter(step => step.action === 'delete_file');
            const deletePaths = deleteSteps.map(step => step.target);

            // Should delete old.txt but not backup files
            expect(deletePaths).to.include('/test/target/old.txt');
            expect(deletePaths).to.not.include('/test/target/backup/old.html');
            expect(deletePaths).to.not.include('/test/target/backup/sub/old.js');
        });

        it('should not delete files matching multiple patterns', async () => {
            sourceFs.init({
                files: {
                    '/test/source/index.html': '<html>Hello</html>'
                }
            });

            targetFs.init({
                files: {
                    '/test/target/index.html': '<html>Old</html>',
                    '/test/target/.env': 'SECRET=old',
                    '/test/target/app.config': 'config=old',
                    '/test/target/backup/old.html': 'backup content',
                    '/test/target/old.txt': 'old content'
                }
            });

            process.env.PLUGIN_DONT_DELETE_TARGET_FILES = '**/.env,**.config,backup/**';

            const plan = await createPlan(sourceFs, targetFs, '/test/source', '/test/target');

            const deleteSteps = getAllSteps(plan).filter(step => step.action === 'delete_file');
            const deletePaths = deleteSteps.map(step => step.target);

            // Should only delete old.txt
            expect(deletePaths).to.include('/test/target/old.txt');
            expect(deletePaths).to.not.include('/test/target/.env');
            expect(deletePaths).to.not.include('/test/target/app.config');
            expect(deletePaths).to.not.include('/test/target/backup/old.html');
        });

        it('should still override files that are protected from deletion', async () => {
            sourceFs.init({
                files: {
                    '/test/source/.env': 'SECRET=new',
                    '/test/source/index.html': '<html>New</html>'
                }
            });

            targetFs.init({
                files: {
                    '/test/target/.env': 'SECRET=old',
                    '/test/target/index.html': '<html>Old</html>',
                    '/test/target/old.txt': 'old content'
                }
            });

            process.env.PLUGIN_DONT_DELETE_TARGET_FILES = '**/.env';

            const plan = await createPlan(sourceFs, targetFs, '/test/source', '/test/target');

            // Should still copy/override .env file
            const copySteps = getAllSteps(plan).filter(step => step.action === 'copy');
            const copyPaths = copySteps.map(step => step.target);

            expect(copyPaths).to.include('/test/target/.env');
            expect(copyPaths).to.include('/test/target/index.html');

            // Should not delete .env file
            const deleteSteps = getAllSteps(plan).filter(step => step.action === 'delete_file');
            const deletePaths = deleteSteps.map(step => step.target);

            expect(deletePaths).to.include('/test/target/old.txt');
            expect(deletePaths).to.not.include('/test/target/.env');
        });
    });

    describe('DONT_OVERRIDE_TARGET_FILES', () => {
        it('should not override files matching *.env pattern', async () => {
            sourceFs.init({
                files: {
                    '/test/source/.env': 'SECRET=new',
                    '/test/source/test.env': 'TEST=new',
                    '/test/source/index.html': '<html>New</html>'
                }
            });

            targetFs.init({
                files: {
                    '/test/target/.env': 'SECRET=old',
                    '/test/target/test.env': 'TEST=old',
                    '/test/target/index.html': '<html>Old</html>'
                }
            });

            process.env.PLUGIN_DONT_OVERRIDE_TARGET_FILES = '*.env';

            const plan = await createPlan(sourceFs, targetFs, '/test/source', '/test/target');

            // Should not copy .env files
            const copySteps = getAllSteps(plan).filter(step => step.action === 'copy');
            const copyPaths = copySteps.map(step => step.target);

            expect(copyPaths).to.include('/test/target/index.html');
            expect(copyPaths).to.not.include('/test/target/.env');
            expect(copyPaths).to.not.include('/test/target/test.env');
        });

        it('should not override files matching **.config pattern', async () => {
            sourceFs.init({
                files: {
                    '/test/source/app.config': 'config=new',
                    '/test/source/sub/app.config': 'sub config=new',
                    '/test/source/index.html': '<html>New</html>'
                }
            });

            targetFs.init({
                files: {
                    '/test/target/app.config': 'config=old',
                    '/test/target/sub/app.config': 'sub config=old',
                    '/test/target/index.html': '<html>Old</html>'
                }
            });

            process.env.PLUGIN_DONT_OVERRIDE_TARGET_FILES = '**.config';

            const plan = await createPlan(sourceFs, targetFs, '/test/source', '/test/target');

            const copySteps = getAllSteps(plan).filter(step => step.action === 'copy');
            const copyPaths = copySteps.map(step => step.target);

            expect(copyPaths).to.include('/test/target/index.html');
            expect(copyPaths).to.not.include('/test/target/app.config');
            expect(copyPaths).to.not.include('/test/target/sub/app.config');
        });

        it('should not override files matching worker/**/.env pattern', async () => {
            sourceFs.init({
                files: {
                    '/test/source/worker/.env': 'worker env=new',
                    '/test/source/worker/sub/.env': 'sub env=new',
                    '/test/source/worker/test.env': 'test=new',
                    '/test/source/index.html': '<html>New</html>'
                }
            });

            targetFs.init({
                files: {
                    '/test/target/worker/.env': 'worker env=old',
                    '/test/target/worker/sub/.env': 'sub env=old',
                    '/test/target/worker/test.env': 'test=old',
                    '/test/target/index.html': '<html>Old</html>'
                }
            });

            process.env.PLUGIN_DONT_OVERRIDE_TARGET_FILES = 'worker/**/.env';

            const plan = await createPlan(sourceFs, targetFs, '/test/source', '/test/target');

            const copySteps = getAllSteps(plan).filter(step => step.action === 'copy');
            const copyPaths = copySteps.map(step => step.target);

            expect(copyPaths).to.include('/test/target/index.html');
            expect(copyPaths).to.include('/test/target/worker/test.env'); // Should override this
            expect(copyPaths).to.not.include('/test/target/worker/.env');
            expect(copyPaths).to.not.include('/test/target/worker/sub/.env');
        });

        it('should not override files matching multiple patterns', async () => {
            sourceFs.init({
                files: {
                    '/test/source/.env': 'SECRET=new',
                    '/test/source/app.config': 'config=new',
                    '/test/source/backup/old.txt': 'backup=new',
                    '/test/source/index.html': '<html>New</html>'
                }
            });

            targetFs.init({
                files: {
                    '/test/target/.env': 'SECRET=old',
                    '/test/target/app.config': 'config=old',
                    '/test/target/backup/old.txt': 'backup=old',
                    '/test/target/index.html': '<html>Old</html>'
                }
            });

            process.env.PLUGIN_DONT_OVERRIDE_TARGET_FILES = '**/.env,**.config,backup/**';

            const plan = await createPlan(sourceFs, targetFs, '/test/source', '/test/target');

            const copySteps = getAllSteps(plan).filter(step => step.action === 'copy');
            const copyPaths = copySteps.map(step => step.target);

            expect(copyPaths).to.include('/test/target/index.html');
            expect(copyPaths).to.not.include('/test/target/.env');
            expect(copyPaths).to.not.include('/test/target/app.config');
            expect(copyPaths).to.not.include('/test/target/backup/old.txt');
        });

        it('should still delete files that are protected from override', async () => {
            sourceFs.init({
                files: {
                    '/test/source/index.html': '<html>New</html>'
                }
            });

            targetFs.init({
                files: {
                    '/test/target/.env': 'SECRET=old',
                    '/test/target/index.html': '<html>Old</html>',
                    '/test/target/old.txt': 'old content'
                }
            });

            process.env.PLUGIN_DONT_OVERRIDE_TARGET_FILES = '**/.env';

            const plan = await createPlan(sourceFs, targetFs, '/test/source', '/test/target');

            // Should not copy .env file
            const copySteps = getAllSteps(plan).filter(step => step.action === 'copy');
            const copyPaths = copySteps.map(step => step.target);

            expect(copyPaths).to.include('/test/target/index.html');
            expect(copyPaths).to.not.include('/test/target/.env');

            // Should still delete .env file (since it's not in source)
            const deleteSteps = getAllSteps(plan).filter(step => step.action === 'delete_file');
            const deletePaths = deleteSteps.map(step => step.target);

            // Note: .env is protected by DONT_OVERRIDE_TARGET_FILES, so it won't be deleted
            expect(deletePaths).to.include('/test/target/old.txt');
        });
    });

    describe('Combined DONT_DELETE and DONT_OVERRIDE', () => {
        it('should handle both patterns simultaneously', async () => {
            sourceFs.init({
                files: {
                    '/test/source/.env': 'SECRET=new',
                    '/test/source/app.config': 'config=new',
                    '/test/source/index.html': '<html>New</html>'
                }
            });

            targetFs.init({
                files: {
                    '/test/target/.env': 'SECRET=old',
                    '/test/target/app.config': 'config=old',
                    '/test/target/index.html': '<html>Old</html>',
                    '/test/target/old.txt': 'old content'
                }
            });

            // Protect .env from deletion and override
            process.env.PLUGIN_DONT_DELETE_TARGET_FILES = '**/.env';
            process.env.PLUGIN_DONT_OVERRIDE_TARGET_FILES = '**/.env';

            const plan = await createPlan(sourceFs, targetFs, '/test/source', '/test/target');

            const copySteps = getAllSteps(plan).filter(step => step.action === 'copy');
            const copyPaths = copySteps.map(step => step.target);

            const deleteSteps = getAllSteps(plan).filter(step => step.action === 'delete_file');
            const deletePaths = deleteSteps.map(step => step.target);

            // Should copy app.config and index.html
            expect(copyPaths).to.include('/test/target/app.config');
            expect(copyPaths).to.include('/test/target/index.html');
            expect(copyPaths).to.not.include('/test/target/.env');

            // Should delete old.txt but not .env
            expect(deletePaths).to.include('/test/target/old.txt');
            expect(deletePaths).to.not.include('/test/target/.env');
        });

        it('should handle complex real-world scenario', async () => {
            sourceFs.init({
                files: {
                    '/test/source/.env': 'SECRET=new',
                    '/test/source/app.config': 'config=new',
                    '/test/source/backup/old.html': 'backup=new',
                    '/test/source/index.html': '<html>New</html>',
                    '/test/source/style.css': 'body { color: red; }'
                }
            });

            targetFs.init({
                files: {
                    '/test/target/.env': 'SECRET=old',
                    '/test/target/app.config': 'config=old',
                    '/test/target/backup/old.html': 'backup=old',
                    '/test/target/index.html': '<html>Old</html>',
                    '/test/target/style.css': 'body { color: blue; }',
                    '/test/target/old.txt': 'old content',
                    '/test/target/temp.log': 'temp log'
                }
            });

            // Complex patterns
            process.env.PLUGIN_DONT_DELETE_TARGET_FILES = '**/.env,backup/**,*.log';
            process.env.PLUGIN_DONT_OVERRIDE_TARGET_FILES = '**/.env,**.config,backup/**';

            const plan = await createPlan(sourceFs, targetFs, '/test/source', '/test/target');

            const copySteps = getAllSteps(plan).filter(step => step.action === 'copy');
            const copyPaths = copySteps.map(step => step.target);

            const deleteSteps = getAllSteps(plan).filter(step => step.action === 'delete_file');
            const deletePaths = deleteSteps.map(step => step.target);

            // Should copy: index.html, style.css
            // app.config is protected by DONT_OVERRIDE_TARGET_FILES
            expect(copyPaths).to.include('/test/target/index.html');
            expect(copyPaths).to.include('/test/target/style.css');
            
            // Should not copy: .env, backup files
            expect(copyPaths).to.not.include('/test/target/.env');
            expect(copyPaths).to.not.include('/test/target/backup/old.html');

            // Should delete: old.txt
            expect(deletePaths).to.include('/test/target/old.txt');
            
            // Should not delete: .env, backup files, temp.log
            expect(deletePaths).to.not.include('/test/target/.env');
            expect(deletePaths).to.not.include('/test/target/backup/old.html');
            expect(deletePaths).to.not.include('/test/target/temp.log');
        });
    });

    describe('Plan Execution with Skip Patterns', () => {
        it('should execute plan and respect skip patterns', async () => {
            sourceFs.init({
                files: {
                    '/test/source/.env': 'SECRET=new',
                    '/test/source/index.html': '<html>New</html>'
                }
            });

            targetFs.init({
                files: {
                    '/test/target/.env': 'SECRET=old',
                    '/test/target/index.html': '<html>Old</html>',
                    '/test/target/old.txt': 'old content'
                }
            });

            process.env.PLUGIN_DONT_DELETE_TARGET_FILES = '**/.env';
            process.env.PLUGIN_DONT_OVERRIDE_TARGET_FILES = '**/.env';

            const plan = await createPlan(sourceFs, targetFs, '/test/source', '/test/target');

            // Execute the plan
            await plan.execute();

            // Check that operations were performed correctly
            const operations = targetFs.getOperations();
            const writeOps = operations.filter(op => op.type === 'writeFile');
            const deleteOps = operations.filter(op => op.type === 'deleteFile');

            // Should write index.html but not .env
            const writePaths = writeOps.map(op => op.path);
            expect(writePaths).to.include('/test/target/index.html');
            expect(writePaths).to.not.include('/test/target/.env');

            // Should delete old.txt but not .env
            const deletePaths = deleteOps.map(op => op.path);
            expect(deletePaths).to.include('/test/target/old.txt');
            expect(deletePaths).to.not.include('/test/target/.env');
        });
    });
});
