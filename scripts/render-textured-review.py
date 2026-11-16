"""Render the exported GLB skins directly to a deterministic, textured QA movie."""

import json,io,math,sys

sys.path.insert(0,".tools/gpu")

import moderngl

from pathlib import Path

import numpy as np

from PIL import Image,ImageDraw

from scipy.spatial.transform import Rotation as R

import cv2

from inspect_characters import load,acc

ctx=moderngl.create_standalone_context()

print(ctx.info['GL_RENDERER'],flush=True)

fbo=ctx.simple_framebuffer((400,450));fbo.use();ctx.enable(moderngl.DEPTH_TEST)

program=ctx.program(vertex_shader='''#version 330

in vec3 in_position;in vec2 in_uv;out vec2 uv;out vec3 pos;void main(){uv=in_uv;pos=in_position;gl_Position=vec4(in_position.x/.95,(in_position.y-.95)/1.05,-in_position.z*.2,1.0);}''',fragment_shader='''#version 330

uniform sampler2D diffuse;in vec2 uv;in vec3 pos;out vec4 color;void main(){vec3 n=normalize(cross(dFdx(pos),dFdy(pos)));float l=.65+.35*abs(dot(n,normalize(vec3(.3,.8,1.0))));color=vec4(texture(diffuse,uv).rgb*l,1.0);}''')

resources=[]

NAMES=['tommy','nightlife','casual','executive','floral','weathered'];models=[]

for name in NAMES:

 asset=Path('public/models/characters')/(name+'.glb')
 if not asset.exists():asset=Path('artifacts/characters/drafts')/(name+'.glb')
 j,b=load(asset);prim=j['meshes'][0]['primitives'][0];at=prim['attributes'];v=acc(j,b,at['POSITION']);uv=acc(j,b,at['TEXCOORD_0']);weights=acc(j,b,at['WEIGHTS_0']);joints=acc(j,b,at['JOINTS_0']);inv=acc(j,b,j['skins'][0]['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1);parents={c:p for p,n in enumerate(j['nodes']) for c in n.get('children',[])}

 bv=j['bufferViews'][j['images'][0]['bufferView']];texture=np.array(Image.open(io.BytesIO(b[bv['byteOffset']:bv['byteOffset']+bv['byteLength']])).convert('RGB'));colors=texture[(np.clip(uv[:,1],0,1)*(texture.shape[0]-1)).astype(int),(np.clip(uv[:,0],0,1)*(texture.shape[1]-1)).astype(int)]

 indices=acc(j,b,prim['indices']).astype('uint32').ravel();vertices=ctx.buffer(v.astype('f4').tobytes());texcoords=ctx.buffer(uv.astype('f4').tobytes());indexbuffer=ctx.buffer(indices.tobytes());tex=ctx.texture((texture.shape[1],texture.shape[0]),3,texture.tobytes());tex.build_mipmaps();vao=ctx.vertex_array(program,[(vertices,'3f','in_position'),(texcoords,'2f','in_uv')],indexbuffer);resources.append((vertices,tex,vao))

 clips={}

 for clip in j['animations']:

  channels={(c['target']['node'],c['target']['path']):acc(j,b,clip['samplers'][c['sampler']]['output']) for c in clip['channels'] if c['target']['path']!='weights'};times=acc(j,b,clip['samplers'][0]['input']).ravel();clips[clip['name']]=(channels,times)

 models.append((name,j,v,colors,weights,joints,inv,parents,clips))

folder=Path('artifacts/characters/textured-frames');folder.mkdir(exist_ok=True)

frame=0;labels=list(models[0][-1]);snapshots=[]

for anim in labels:

 print('Rendering',anim,flush=True)

 for fi in range(36):

  canvas=Image.new('RGB',(1200,1000),'#21192e');draw=ImageDraw.Draw(canvas);draw.text((20,14),f'{anim} | '+('Front' if fi<24 else 'Back')+' | exported GLB skin review',fill='#ffe1f3')

  for mi,(name,j,v,colors,weights,joints,inv,parents,clips) in enumerate(models):

   channels,times=clips[anim];t=(fi%24)/24;dur=times[-1];t=t%dur if anim.endswith('Loop') else min(t,dur);idx=min(len(times)-1,int(np.searchsorted(times,t)));mats=[]

   for i in range(len(inv)):

    nid=i+2;mat=np.eye(4);mat[:3,:3]=R.from_quat(channels[(nid,'rotation')][idx]).as_matrix();mat[:3,3]=channels[(nid,'translation')][idx];parent=parents[nid]-2

    if parent>=0:mat=mats[parent]@mat

    mats.append(mat)

   matrices=np.array(mats)@inv;vh=np.column_stack([v,np.ones(len(v))]);posed=np.zeros_like(v,dtype=float)

   for k in range(4):posed+=np.einsum('nij,nj->ni',matrices[joints[:,k]],vh)[:,:3]*weights[:,k,None]

   if fi>=24:posed[:,[0,2]]*=-1

   vertices,tex,vao=resources[mi];vertices.write(posed.astype('f4').tobytes());fbo.clear(33/255,25/255,46/255,1);tex.use(0);vao.render();img=np.frombuffer(fbo.read(components=3,alignment=1),dtype=np.uint8).reshape(450,400,3)[::-1].copy()

   x=(mi%3)*400;y=(mi//3)*475+40;canvas.paste(Image.fromarray(img),(x,y));draw.text((x+15,y+435),name,fill='#efacd2')

  dest=folder/(str(frame).zfill(5)+'.jpg');canvas.save(dest,quality=88)

  if fi==8:snapshots.append(canvas.copy())

  frame+=1

sheet=Image.new('RGB',(1800,math.ceil(len(snapshots)/3)*500),'#21192e')

for i,im in enumerate(snapshots):im.thumbnail((600,500));sheet.paste(im,((i%3)*600,(i//3)*500))

sheet.save('artifacts/characters/textured-movement-contact-sheet.jpg')

print('Saved',frame,'frames',flush=True)

