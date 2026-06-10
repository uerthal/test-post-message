import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '..', 'types', 'auth-sync.d.ts');
const dest = resolve(here, '..', 'dist', 'auth-sync.d.ts');

await mkdir(dirname(dest), { recursive: true });
await copyFile(src, dest);
console.log(`Copied ${src} → ${dest}`);
