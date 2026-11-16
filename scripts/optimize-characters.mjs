import fs from 'node:fs';
import { MeshoptSimplifier } from '../.tools/mesh/node_modules/meshoptimizer/meshopt_simplifier.js';
await MeshoptSimplifier.ready;
for (const name of fs.readdirSync('artifacts/characters/work')) {
 if (!name.endsWith('.input.json')) continue;
 const stem='artifacts/characters/work/'+name.replace('.input.json','');
 const meta=JSON.parse(fs.readFileSync(stem+'.input.json','utf8'));
 const bytes=fs.readFileSync(stem+'.positions.bin');
 const pos=new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 const ib=fs.readFileSync(stem+'.indices.bin'); const indices=new Uint32Array(ib.buffer.slice(ib.byteOffset,ib.byteOffset+ib.byteLength));
 const ab=fs.readFileSync(stem+'.uv.bin');const uv=new Float32Array(ab.buffer.slice(ab.byteOffset,ab.byteOffset+ab.byteLength));
 const [result,error]=MeshoptSimplifier.simplifyWithAttributes(indices,pos,3,uv,2,[.25,.25],null,meta.target*3,.006,['RegularizeLight']);
 fs.writeFileSync(stem+'.simplified.bin',Buffer.from(result.buffer));
 console.log(name,result.length/3,'triangles',error);
}
