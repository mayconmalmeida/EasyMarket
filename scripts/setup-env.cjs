const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function ensureEnv(appDir) {
  const env = path.join(root, appDir, '.env');
  const example = path.join(root, appDir, '.env.example');
  if (fs.existsSync(env)) return { env, created: false };
  if (!fs.existsSync(example)) throw new Error(`Arquivo não encontrado: ${example}`);
  fs.copyFileSync(example, env);
  return { env, created: true };
}

const results = [ensureEnv('apps/api'), ensureEnv('apps/web')];
for (const r of results) {
  process.stdout.write(`${r.created ? 'Criado' : 'Já existe'}: ${r.env}\n`);
}
