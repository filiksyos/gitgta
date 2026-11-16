import fs from 'node:fs';import assert from 'node:assert/strict';

import ts from 'typescript';import * as THREE from 'three';

import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {clone} from 'three/addons/utils/SkeletonUtils.js';

fs.mkdirSync('artifacts/characters',{recursive:true});

const source=fs.readFileSync('game/render/heroes.ts','utf8');const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;

fs.writeFileSync('artifacts/characters/heroes-runtime.mjs',compiled);

const {HeroClips,CIVILIAN_NAMES}=await import('../artifacts/characters/heroes-runtime.mjs');

const loader=new GLTFLoader();const report=[];

for(const name of ['tommy',...CIVILIAN_NAMES]){

 const data=fs.readFileSync('public/models/characters/'+name+'.glb');const jl=data.readUInt32LE(12);const j=JSON.parse(data.subarray(20,20+jl).toString());

 // Textures are visually reviewed in-browser. Test the identical binary rig without DOM image decoding.

 for(const material of j.materials)delete material.pbrMetallicRoughness.baseColorTexture;delete j.images;delete j.textures;

 let json=Buffer.from(JSON.stringify(j));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const bin=data.subarray(20+jl);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+json.length+bin.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);const bytes=Buffer.concat([header,json,bin]);

 const gltf=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');assert.equal(gltf.animations.length,14);

 const a=clone(gltf.scene),b=clone(gltf.scene);const ca=new HeroClips(a,gltf.animations),cb=new HeroClips(b,gltf.animations);

 ca.play('Walk_Loop',0);cb.play('Idle_Loop',0);ca.update(.1);cb.update(.1);a.updateMatrixWorld(true);b.updateMatrixWorld(true);

 const hand=a.getObjectByName('LeftHand'),other=b.getObjectByName('LeftHand');assert.notEqual(hand,other);

 const before=hand.getWorldPosition(new THREE.Vector3());const idle=other.getWorldPosition(new THREE.Vector3());ca.update(.3);a.updateMatrixWorld(true);b.updateMatrixWorld(true);assert.ok(before.distanceTo(hand.getWorldPosition(new THREE.Vector3()))>.015,name+' hand frozen');assert.ok(idle.distanceTo(other.getWorldPosition(new THREE.Vector3()))<1e-7,name+' shared skeleton');

 for(let i=0;i<60;i++){ca.play(i%2?'Idle_Loop':'Sprint_Loop',.18);ca.update(1/60);}for(let i=0;i<30;i++)ca.update(1/60);assert.ok(ca.mixer.stats.actions.inUse<=2,name+' leaked blended actions');

 ca.setTalking(.8);let mouth=false;a.traverse(o=>{if(o.isMesh&&o.morphTargetInfluences?.[0]===.8)mouth=true});assert.ok(mouth,name+' missing speech morph');ca.dispose();cb.dispose();report.push({name,handMotion:true,independentSkeletons:true,blendCleanup:true,speechMorph:true});

}

fs.writeFileSync('artifacts/characters/runtime-checks.json',JSON.stringify(report,null,2));console.log('PASS: all active character rigs — moving hands, independent skeletons, blend cleanup, speech morphs');

