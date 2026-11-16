import fs from 'node:fs';import assert from 'node:assert/strict';import ts from 'typescript';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import * as THREE from 'three';
fs.mkdirSync('artifacts/characters',{recursive:true});
const source=fs.readFileSync('game/render/heroes.ts','utf8');fs.writeFileSync('artifacts/characters/heroes-original-rig.mjs',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText);const {HeroClips}=await import('../artifacts/characters/heroes-original-rig.mjs');
function read(path){const b=fs.readFileSync(path),n=b.readUInt32LE(12);return {j:JSON.parse(b.subarray(20,20+n)),bin:b.subarray(28+n)}}
const old=read('public/models/player.glb'),asset=read('public/models/characters/tommy-original-rig.glb');assert.deepEqual(asset.j.animations,old.j.animations);assert.deepEqual(asset.j.skins,old.j.skins);assert.deepEqual(asset.j.nodes.slice(3),old.j.nodes.slice(3));assert.ok(asset.bin.subarray(0,old.bin.length).equals(old.bin),'Original animation/bind buffers changed');
for(const m of asset.j.materials)delete m.pbrMetallicRoughness.baseColorTexture;delete asset.j.images;delete asset.j.textures;
let json=Buffer.from(JSON.stringify(asset.j));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const head=Buffer.alloc(20),tail=Buffer.alloc(8);head.writeUInt32LE(0x46546c67,0);head.writeUInt32LE(2,4);head.writeUInt32LE(28+json.length+asset.bin.length,8);head.writeUInt32LE(json.length,12);head.writeUInt32LE(0x4e4f534a,16);tail.writeUInt32LE(asset.bin.length,0);tail.writeUInt32LE(0x004e4942,4);const bytes=Buffer.concat([head,json,tail,asset.bin]);const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const clips=new HeroClips(gltf.scene,gltf.animations);assert.ok(clips.has('Idle_Loop')&&clips.has('Walk_Loop')&&clips.has('Sprint_Loop'));
let mesh;gltf.scene.traverse(o=>{if(o.isSkinnedMesh&&!mesh)mesh=o});assert.ok(mesh);
const checks=[];
for(const name of ['Idle_Loop','Walk_Loop','Sprint_Loop']){
 clips.play(name,0);clips.update(.1);gltf.scene.updateMatrixWorld(true);const start=mesh.getVertexPosition(50,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);const action=clips.mixer.existingAction(gltf.animations.find(a=>a.name===({Idle_Loop:'Idle',Walk_Loop:'Walk',Sprint_Loop:'Run'}[name])));const before=action.time;
 for(let i=0;i<12;i++){clips.play(name);clips.update(1/60)}assert.ok(action.time>before+.15,'Original animation resets every frame');gltf.scene.updateMatrixWorld(true);let minY=Infinity,maxY=-Infinity;
 for(let i=0;i<mesh.geometry.attributes.position.count;i+=23){const vertex=mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);assert.ok(vertex.toArray().every(Number.isFinite));minY=Math.min(minY,vertex.y);maxY=Math.max(maxY,vertex.y)}assert.ok(maxY-minY<2.8,'Unbounded deformation');checks.push({name,timeAdvances:true,height:maxY-minY});
}
clips.play('Jump_Loop');clips.update(.1);clips.play('Jump_Loop');clips.update(.1);assert.equal(clips.current,'Idle_Loop');clips.dispose();
fs.writeFileSync('artifacts/characters/original-rig-runtime-checks.json',JSON.stringify({originalSkeletonUnchanged:true,originalAnimationBuffersUnchanged:true,checks},null,2));console.log('PASS: original skeleton and animation buffers unchanged; original clips play continuously on adapted Tommy; finite deformations and stable fallbacks');
