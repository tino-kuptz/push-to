import { } from 'dotenv/config';

import { createLogger } from './lib/logger.js';
const logger = createLogger('index');

import { createFs } from './lib/createFs.js';
import { createPlan } from './lib/createPlan.js';
import { checkForInvalidDontDelete, checkForInvalidDontOverride } from './lib/skipFiles.js';

/**
 * Parse the filesystem from the environment variables
 * @param {string} prefix 
 * @returns {Object}
 */
const parseFilesystemFromEnv = (prefix) => {
    // Get the path from the environment variable
    const path = process.env[`${prefix}_PATH`];
    if (!path) {
        throw new Error(`${prefix} path is not set`);
    }
    // Get the parameters from the environment variables
    // The parameters are the environment variables that start with the prefix and an underscore
    const parameters = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (key.startsWith(`${prefix}_`)) {
            parameters[key.substring(`${prefix}_`.length)] = value;
        }
    }
    return {
        path,
        parameters,
    };
};

(async () => {
    try {
        if (process.env.PLUGIN_DRY_RUN) {
            logger.info('Dry run mode enabled. Changes will not be applied to the target.');
        }

        logger.info('Checking source and target file systems');
        const sourceFsConfig = parseFilesystemFromEnv('PLUGIN_SOURCE');
        const targetFsConfig = parseFilesystemFromEnv('PLUGIN_TARGET');

        // Validate skip file patterns before proceeding
        logger.info('Validating skip file patterns');
        if (!checkForInvalidDontDelete()) {
            logger.error('Invalid patterns in PLUGIN_DONT_DELETE_TARGET_FILES');
            process.exit(1);
        }
        if (!checkForInvalidDontOverride()) {
            logger.error('Invalid patterns in PLUGIN_DONT_OVERRIDE_TARGET_FILES');
            process.exit(1);
        }

        logger.info('Connecting to source and target file systems');
        const sourceFs = createFs(sourceFsConfig.path, sourceFsConfig.parameters);
        const targetFs = createFs(targetFsConfig.path, targetFsConfig.parameters);

        await Promise.all([
            sourceFs.connect(),
            targetFs.connect(),
        ]);

        logger.info('Creating plan');
        const plan = await createPlan(sourceFs, targetFs);

        logger.info('Executing plan');
        await plan.execute();

        logger.info('Plan executed');

        logger.info('Disconnecting from source and target file systems');
        await Promise.all([
            sourceFs.disconnect(),
            targetFs.disconnect(),
        ]);

        logger.info('Done');
        process.exit(0);
    } catch (error) {
        logger.error('Error: '+ error.message);
        process.exit(1);
    }
})();