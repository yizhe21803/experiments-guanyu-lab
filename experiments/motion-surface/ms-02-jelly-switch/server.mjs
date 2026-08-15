import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||4179);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
  try{
    let pathname=decodeURIComponent(new URL(req.url||'/',`http://${req.headers.host||'localhost'}`).pathname);
    if(pathname==='/'||pathname==='') pathname='/index.html';
    const fp=path.resolve(root,'.'+pathname);
    if(!fp.startsWith(root)) throw new Error('bad path');
    const st=await stat(fp); if(!st.isFile()) throw new Error('not file');
    const data=await readFile(fp);res.writeHead(200,{'Content-Type':types[path.extname(fp)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});res.end('404');}
}).listen(port,'127.0.0.1',()=>console.log(`GUANYU LAB Jelly Switch: http://127.0.0.1:${port}`));
