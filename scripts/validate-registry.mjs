import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync(new URL('../registry/experiments.json',import.meta.url),'utf8'));
const ids=new Set(), slugs=new Set();
for(const item of data.experiments??[]){for(const key of ['id','slug','series','name','status','version','entry']) if(!item[key]) throw new Error(`${item.id||item.slug||'unknown'} missing ${key}`);if(ids.has(item.id)) throw new Error(`duplicate id: ${item.id}`);if(slugs.has(item.slug)) throw new Error(`duplicate slug: ${item.slug}`);ids.add(item.id);slugs.add(item.slug);}
console.log(`Registry OK: ${ids.size} experiments`);
