import { createLogger } from './logger.js';

const planStepLogger = createLogger('PlanStep');
const planLogger = createLogger('Plan');

/**
 * A step in the plan
 * @param {string} action - can be "delete_file" (where "target" will be deleted), 
 *    "delete_directory" (where "target" will be deleted),
 *    "create_directory" (where "target" will be created),
 *    "copy" (where "source" will be copied to "target")
 * @param {string} source
 * @param {string} target
 * @param {FileSystem} sourceFs
 * @param {FileSystem} targetFs
 */
export class PlanStep {
    action;
    source;
    target;
    sourceFs;
    targetFs;

    constructor(action, source, target, sourceFs, targetFs) {
        this.action = action;
        this.source = source;
        this.target = target;
        this.sourceFs = sourceFs;
        this.targetFs = targetFs;
    }

    /**
     * Execute this plan step
     * @returns {Promise<void>}
     */
    async execute() {
        switch (this.action) {
            case 'create_directory':
                planStepLogger.debug(`Creating directory: ${this.target}`);
                await this.targetFs.createDirectory(this.target);
                break;
                
            case 'copy':
                planStepLogger.debug(`Copying file: ${this.source} -> ${this.target}`);
                const content = await this.sourceFs.readFile(this.source);
                await this.targetFs.writeFile(this.target, content);
                break;
                
            case 'delete_file':
                planStepLogger.debug(`Deleting file: ${this.target}`);
                await this.targetFs.deleteFile(this.target);
                break;
                
            case 'delete_directory':
                planStepLogger.debug(`Deleting directory: ${this.target}`);
                await this.targetFs.deleteDirectory(this.target);
                break;
                
            default:
                throw new Error(`Unknown action: ${this.action}`);
        }
    }
}

/**
 * The plan to sync the source file system to the target file system
 * @param {PlanStep[]} stepCreateMissingDirectories - first step to create missing directories on the target file system
 * @param {PlanStep[]} stepUploadAssets - second step to upload assets to the target file system
 * @param {PlanStep[]} stepUploadLogic - third step to upload logic to the target file system (e.g. html, php, etc.)
 * @param {PlanStep[]} stepRemoveOldLogic - fourth step to remove old logic from the target file system
 * @param {PlanStep[]} stepRemoveOldAssets - fifth step to remove old assets from the target file system
 * @param {PlanStep[]} stepDeleteOldDirectories - sixth step to delete old directories from the target file system
 */
export class Plan {
    stepCreateMissingDirectories;
    stepUploadAssets;
    stepUploadLogic;
    stepRemoveOldLogic;
    stepRemoveOldAssets;
    stepDeleteOldDirectories;

    constructor() {
        this.stepCreateMissingDirectories = [];
        this.stepUploadAssets = [];
        this.stepUploadLogic = [];
        this.stepRemoveOldLogic = [];
        this.stepRemoveOldAssets = [];
        this.stepDeleteOldDirectories = [];
    }

    /**
     * Execute the plan
     * @returns {Promise<void>}
     */
    async execute() {
        planLogger.debug('Executing plan');

        planLogger.debug('Executing stepCreateMissingDirectories');
        var promiseQueue = [];
        for (const step of this.stepCreateMissingDirectories) {
            promiseQueue.push(step.execute());
        }
        await Promise.all(promiseQueue);

        planLogger.debug('Executing stepUploadAssets');
        promiseQueue = [];
        for (const step of this.stepUploadAssets) {
            promiseQueue.push(step.execute());
        }
        await Promise.all(promiseQueue);

        planLogger.debug('Executing stepUploadLogic');
        promiseQueue = [];
        for (const step of this.stepUploadLogic) {
            promiseQueue.push(step.execute());
        }
        await Promise.all(promiseQueue);

        planLogger.debug('Executing stepRemoveOldLogic');
        promiseQueue = [];
        for (const step of this.stepRemoveOldLogic) {
            promiseQueue.push(step.execute());
        }
        await Promise.all(promiseQueue);

        planLogger.debug('Executing stepRemoveOldAssets');
        promiseQueue = [];
        for (const step of this.stepRemoveOldAssets) {
            promiseQueue.push(step.execute());
        }
        await Promise.all(promiseQueue);

        planLogger.debug('Executing stepDeleteOldDirectories');
        promiseQueue = [];
        for (const step of this.stepDeleteOldDirectories) {
            promiseQueue.push(step.execute());
        }
        await Promise.all(promiseQueue);

        planLogger.debug('Plan executed');
    }
}