import path from 'path';
import fs from 'fs';

const keepModules = [
    'ssh2'
];

const fullPath = path.resolve(import.meta.dirname, 'dist');
const targetPackageJsonPath = path.resolve(fullPath, 'package.json');

const packageJsonPath = path.resolve(import.meta.dirname, 'package.json');
const entryPath = path.resolve(import.meta.dirname, 'index.js');

console.log('packing application');
console.log('target path:', fullPath);


console.log('deleting dist directory (if present)');
if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { recursive: true });
}

console.log('creating dist directory');
fs.mkdirSync(fullPath, { recursive: true });

console.log('creating strippted package.json');
const currentPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
currentPackageJson.main = 'index.js';
console.log(' - deleting old metadata');
delete currentPackageJson.scripts;
delete currentPackageJson.devDependencies;
delete currentPackageJson.type;
console.log(' - cleaning up dependencies');
const dependencies = {};
for (const module of keepModules) {
    dependencies[module] = currentPackageJson.dependencies[module];
    console.log(' - keeping: '+ module +' '+ currentPackageJson.dependencies[module]);
}
currentPackageJson.dependencies = dependencies;
console.log(' - writing');
fs.writeFileSync(targetPackageJsonPath, JSON.stringify(currentPackageJson, null, 2));

console.log('directory set up for webpack');

const externals = keepModules.map(module => `${module}`);

export default {
    entry: entryPath,
    target: 'node',
    mode: 'production',
    externals: {
        ...externals,
        'pino-pretty': 'pino-pretty',
    },
    externalsPresets: {
        node: true,
    },
    output: {
        filename: 'index.js',
        path: fullPath,
    },
    plugins: [
        {
            apply: (compiler) => {
                // No idea why webpack is not including it by itself, so I'll do so
                compiler.hooks.emit.tapAsync('InjectSSH2', (compilation, callback) => {
                    const source = compilation.assets['index.js'].source();
                    const injectedSource = `const ssh2 = require('ssh2');\n${source}`;
                    
                    compilation.assets['index.js'] = {
                        source: () => injectedSource,
                        size: () => injectedSource.length
                    };
                    
                    callback();
                });
            }
        }
    ],
};
