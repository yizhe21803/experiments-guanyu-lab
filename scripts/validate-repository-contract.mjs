const suffix='-guanyu-lab';
const name='experiments-guanyu-lab';
if(!name.toLowerCase().endsWith(suffix)) throw new Error(`repository must end with ${suffix}`);
console.log('Repository naming contract OK');
