"""Compare the original robot and adapted Tommy using the same original animation data."""
import sys,io,math,json
sys.path.insert(0,'.tools/gpu')
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation as R
from PIL import Image,ImageDraw
import moderngl
from inspect_characters import load,acc
ctx=moderngl.create_standalone_context();fbo=ctx.simple_framebuffer((500,650));fbo.use();ctx.enable(moderngl.DEPTH_TEST)
program=ctx.program(vertex_shader='''#version 330
in vec3 in_position;in vec2 in_uv;out vec2 uv;out vec3 pos;void main(){uv=in_uv;pos=in_position;gl_Position=vec4(in_position.x/.8,(in_position.y-.9)/1.05,-in_position.z*.2,1.0);}''',fragment_shader='''#version 330
uniform sampler2D diffuse;in vec2 uv;in vec3 pos;out vec4 color;void main(){vec3 n=normalize(cross(dFdx(pos),dFdy(pos)));float l=.65+.35*abs(dot(n,normalize(vec3(.3,.8,1.0))));color=vec4(texture(diffuse,uv).rgb*l,1.0);}''')
models=[]
for path in [Path('public/models/player.glb'),Path('public/models/characters/tommy-original-rig.glb')]:
 j,b=load(path);parents={c:i for i,n in enumerate(j['nodes']) for c in n.get('children',[])};meshes=[]
 for ni,node in enumerate(j['nodes']):
  if 'mesh' not in node:continue
  for pr in j['meshes'][node['mesh']]['primitives']:
   at=pr['attributes'];v=acc(j,b,at['POSITION']);uv=acc(j,b,at['TEXCOORD_0']);weights=acc(j,b,at['WEIGHTS_0']);joints=acc(j,b,at['JOINTS_0']);skin=j['skins'][node['skin']];inverse=acc(j,b,skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
   material=j['materials'][pr.get('material',0)];pbr=material.get('pbrMetallicRoughness',{})
   if 'baseColorTexture' in pbr:
    textureId=pbr['baseColorTexture']['index'];im=j['images'][j['textures'][textureId]['source']];bv=j['bufferViews'][im['bufferView']];texImage=Image.open(io.BytesIO(b[bv['byteOffset']:bv['byteOffset']+bv['byteLength']])).convert('RGB')
   else:texImage=Image.new('RGB',(1,1),tuple(int(x*255) for x in pbr.get('baseColorFactor',[1,1,1,1])[:3]))
   tex=ctx.texture(texImage.size,3,texImage.tobytes());tex.build_mipmaps();vertices=ctx.buffer(v.astype('f4').tobytes());uvbuf=ctx.buffer(uv.astype('f4').tobytes());indices=acc(j,b,pr['indices']).astype('uint32').ravel();ib=ctx.buffer(indices.tobytes());vao=ctx.vertex_array(program,[(vertices,'3f','in_position'),(uvbuf,'2f','in_uv')],ib);meshes.append((v,weights,joints,skin['joints'],inverse,vertices,tex,vao))
 clips={}
 for clip in j['animations']:
  channels=[]
  for ch in clip['channels']:
   sampler=clip['samplers'][ch['sampler']];channels.append((ch['target']['node'],ch['target']['path'],acc(j,b,sampler['input']).ravel(),acc(j,b,sampler['output'])))
  clips[clip['name']]=channels
 models.append((j,parents,meshes,clips))

def quaternion(a,b,t):
 dot=a@b
 if dot<0:b=-b;dot=-dot
 if dot>.9995:q=a*(1-t)+b*t;return q/np.linalg.norm(q)
 theta=math.acos(np.clip(dot,-1,1));return (a*math.sin((1-t)*theta)+b*math.sin(t*theta))/math.sin(theta)

def pose(model,clip,t):
 j,parents,meshes,clips=model;overrides={}
 for node,path,times,values in clips[clip]:
  index=min(len(times)-1,np.searchsorted(times,t,side='right'));before=max(0,index-1);alpha=np.clip((t-times[before])/max(1e-8,times[index]-times[before]),0,1)
  overrides[(node,path)]=quaternion(values[before],values[index],alpha) if path=='rotation' else values[before]*(1-alpha)+values[index]*alpha
 mats={}
 def world(i):
  if i in mats:return mats[i]
  n=j['nodes'][i];m=np.eye(4);q=overrides.get((i,'rotation'),n.get('rotation',[0,0,0,1]));s=overrides.get((i,'scale'),n.get('scale',[1,1,1]));pos=overrides.get((i,'translation'),n.get('translation',[0,0,0]));m[:3,:3]=R.from_quat(q).as_matrix()@np.diag(s);m[:3,3]=pos
  if i in parents:m=world(parents[i])@m
  mats[i]=m;return m
 return world

folder=Path('artifacts/characters/original-rig-frames');folder.mkdir(exist_ok=True);frame=0;stats=[]
for clip in (['Walk'] if '--snapshot' in sys.argv else ['Idle','Walk','Run']):
 print('Rendering original',clip,flush=True)
 dur=max(c[2][-1] for c in models[0][-1][clip]);mins=[[],[]]
 for f in ([13] if '--snapshot' in sys.argv else range(72)):
  t=((f%36)/24)%dur;side=f>=36;canvas=Image.new('RGB',(1000,700),'#21192e');draw=ImageDraw.Draw(canvas)
  for mi,model in enumerate(models):
   world=pose(model,clip,t);fbo.clear(33/255,25/255,46/255,1)
   for v,weights,joints,bones,inverse,vertices,tex,vao in model[2]:
    matrices=np.array([world(i) for i in bones])@inverse;out=np.zeros_like(v,dtype=float);vh=np.column_stack([v,np.ones(len(v))])
    for k in range(4):out+=np.einsum('nij,nj->ni',matrices[joints[:,k]],vh)[:,:3]*weights[:,k,None]
    mins[mi].append(float(out[:,1].min()))
    # Original rig faces -Z. Show its front, then its side.
    out=R.from_rotvec([0,math.pi if not side else math.pi/2,0]).apply(out);vertices.write(out.astype('f4').tobytes());tex.use(0);vao.render()
   img=Image.frombytes('RGB',(500,650),fbo.read(components=3,alignment=1)).transpose(Image.Transpose.FLIP_TOP_BOTTOM);canvas.paste(img,(mi*500,35));draw.text((mi*500+20,12),('Original robot' if mi==0 else 'Tommy on original rig')+' / '+clip+' / '+('side' if side else 'front'),fill='#ffe1f3')
  canvas.save(folder/(str(frame).zfill(5)+'.jpg'),quality=88);frame+=1
 stats.append({'clip':clip,'originalMinY':min(mins[0]),'adaptedMinY':min(mins[1])})
Path('artifacts/characters/original-rig-visual-checks.json').write_text(json.dumps(stats,indent=2),encoding='utf-8');print(stats,flush=True)
