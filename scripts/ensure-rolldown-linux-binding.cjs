'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

if (process.platform !== 'linux') {
  process.exit(0);
}

const root = path.join(__dirname, '..');
const rolldownPkg = path.join(root, 'client', 'node_modules', 'rolldown', 'package.json');
if (!fs.existsSync(rolldownPkg)) {
  console.error('ensure-rolldown-linux-binding: falta client/node_modules/rolldown');
  process.exit(1);
}

const { version } = require(rolldownPkg);
const binding =
  process.arch === 'x64'
    ? '@rolldown/binding-linux-x64-gnu'
    : process.arch === 'arm64'
      ? '@rolldown/binding-linux-arm64-gnu'
      : null;

if (!binding) {
  console.error('ensure-rolldown-linux-binding: arquitectura no soportada:', process.arch);
  process.exit(1);
}

console.log(`Instalando ${binding}@${version} (rolldown ${version})`);
execSync(`npm install ${binding}@${version} --prefix client --no-save`, {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, NPM_CONFIG_PRODUCTION: 'false' },
});
