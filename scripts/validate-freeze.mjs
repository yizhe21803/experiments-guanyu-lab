import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let failures=0;
for(const rel of ['experiments/motion-surface/ms-01-jelly-motion','experiments/motion-surface/ms-02-jelly-switch']){const dir=path.join(root,rel);const man=JSON.parse(fs.readFileSync(path.join(dir,'FREEZE_MANIFEST.json'),'utf8'));for(const [file,expected] of Object.entries(man.files)){const p=path.join(dir,file);if(!fs.existsSync(p)){console.error(`missing ${rel}/${file}`);failures++;continue;}const actual=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');if(actual!==expected){console.error(`changed ${rel}/${file}`);failures++;}}}
if(failures) process.exit(1); console.log('Freeze manifests OK');
