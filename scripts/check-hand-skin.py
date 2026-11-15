import io,json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.spatial.transform import Rotation as R
from inspect_characters import load,acc
results=[];fail=[]
for file in Path('public/models/characters').glob('*.glb'):
 j,b=load(file);pr=j['meshes'][0]['primitives'][0];v=acc(j,b,pr['attributes']['POSITION']);uv=acc(j,b,pr['attributes']['TEXCOORD_0']);w=acc(j,b,pr['attributes']['WEIGHTS_0']);joint=acc(j,b,pr['attributes']['JOINTS_0']);inv=acc(j,b,j['skins'][0]['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1);parents={c:p for p,n in enumerate(j['nodes']) for c in n.get('children',[])}
 bv=j['bufferViews'][j['images'][0]['bufferView']];tex=np.array(Image.open(io.BytesIO(b[bv['byteOffset']:bv['byteOffset']+bv['byteLength']])).convert('RGB'));colors=tex[(np.clip(uv[:,1],0,1)*(tex.shape[0]-1)).astype(int),(np.clip(uv[:,0],0,1)*(tex.shape[1]-1)).astype(int)];flesh=(colors[:,0]>colors[:,1]*1.08)&(colors[:,0]>colors[:,2]*1.12)&(colors[:,0]>85)
 def posed(clip,t):
  channels={(c['target']['node'],c['target']['path']):acc(j,b,clip['samplers'][c['sampler']]['output']) for c in clip['channels'] if c['target']['path']!='weights'};times=acc(j,b,clip['samplers'][0]['input']).ravel();frame=min(len(times)-1,np.searchsorted(times,t));mats=[]
  for i in range(len(inv)):
   nid=i+2;m=np.eye(4);m[:3,:3]=R.from_quat(channels[(nid,'rotation')][frame]).as_matrix();m[:3,3]=channels[(nid,'translation')][frame];parent=parents[nid]-2
   if parent>=0:m=mats[parent]@m
   mats.append(m)
  matrices=np.array(mats)@inv;out=np.zeros_like(v);vh=np.column_stack([v,np.ones(len(v))])
  for k in range(4):out+=np.einsum('nij,nj->ni',matrices[joint[:,k]],vh)[:,:3]*w[:,k,None]
  return out
 for clipname,side in [('Walk_Loop','Left'),('Walk_Loop','Right'),('Punch_Jab','Left'),('Punch_Cross','Right')]:
  clip=next(c for c in j['animations'] if c['name']==clipname);bn=next(i for i,n in enumerate(j['nodes'][2:]) if n['name']==side+'Hand');wrist=-inv[bn,:3,3];dist=np.linalg.norm(v-wrist,axis=1);candidates=np.flatnonzero(flesh&(dist<.12));indices=candidates[np.argsort(dist[candidates])[:40]]
  if not len(indices):fail.append(file.stem+' missing hand sample');continue
  a=posed(clip,.24 if clipname=='Walk_Loop' else 0);z=posed(clip,.72 if clipname=='Walk_Loop' else .20);travel=float(np.median(np.linalg.norm(z[indices]-a[indices],axis=1)));results.append({'model':file.stem,'clip':clipname,'hand':side,'skinVertexMotion':travel})
  if travel<.025:fail.append(f'{file.stem}/{clipname}/{side}: frozen hand skin ({travel:.4f}m)')
Path('artifacts/characters/hand-skin-checks.json').write_text(json.dumps({'checks':results,'failures':fail},indent=2));print('\n'.join(fail) or 'PASS: actual left/right hand skin vertices move with walking and punches');print(json.dumps(results,indent=2))
