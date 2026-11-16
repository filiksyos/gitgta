"""Numerical animation checks, plus sampled skin/ground bounds for every exported clip."""
import json, math
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation as R
from inspect_characters import load,acc
report=[];failures=[]
for path in sorted(Path('public/models/characters').glob('*.glb')):
 j,b=load(path);p=j['meshes'][0]['primitives'][0];attrs=p['attributes'];v=acc(j,b,attrs['POSITION']);weights=acc(j,b,attrs['WEIGHTS_0']);joints=acc(j,b,attrs['JOINTS_0']);jointnodes=j['skins'][0]['joints'];bind=np.array([n['translation'] for n in j['nodes'][2:]])
 inv=acc(j,b,j['skins'][0]['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
 parents={child:parent for parent,n in enumerate(j['nodes']) for child in n.get('children',[])}
 checks=[]
 for clip in j['animations']:
  channels={(c['target']['node'],c['target']['path']):acc(j,b,clip['samplers'][c['sampler']]['output']) for c in clip['channels']};times=acc(j,b,clip['samplers'][0]['input']).ravel();lowest=100;maxmotion=0
  for frame in np.linspace(0,len(times)-1,7).astype(int):
   mats=[]
   for i,nodeid in enumerate(jointnodes):
    t=channels[(nodeid,'translation')][frame];q=channels[(nodeid,'rotation')][frame];mat=np.eye(4);mat[:3,:3]=R.from_quat(q).as_matrix();mat[:3,3]=t;parent=parents.get(nodeid,0)-2
    if parent>=0:mat=mats[parent]@mat
    mats.append(mat)
   matrices=np.array(mats)@inv;vh=np.column_stack([v,np.ones(len(v))]);deformed=np.zeros_like(v,dtype=float)
   for k in range(4):deformed+=(np.einsum('nij,nj->ni',matrices[joints[:,k]],vh)[:,:3])*weights[:,k,None]
   if not np.isfinite(deformed).all():failures.append(f'{path.stem}/{clip["name"]}: nonfinite skin')
   lowest=min(lowest,float(deformed[:,1].min()));maxmotion=max(maxmotion,float(np.linalg.norm(deformed-v,axis=1).max()))
  looping=clip['name'].endswith('Loop');loopError=max(float(abs(a[-1]-a[0]).max()) for (node,prop),a in channels.items() if prop!='weights') if looping else 0
  checks.append({'clip':clip['name'],'loopSeamMax':loopError,'minFootHeight':round(lowest,4),'maxVertexTravel':round(maxmotion,4)})
  if looping and loopError>.025:failures.append(f'{path.stem}/{clip["name"]}: loop seam {loopError}')
  if lowest<-.13 and clip['name']!='Death01':failures.append(f'{path.stem}/{clip["name"]}: ground penetration {lowest:.3f}')
 if abs(weights.sum(1)-1).max()>1e-5:failures.append(path.stem+': weights do not sum to one')
 report.append({'name':path.stem,'checks':checks})
Path('artifacts/characters/animation-validation.json').write_text(json.dumps({'models':report,'failures':failures},indent=2));print('\n'.join(failures) or 'PASS: normalized weights, finite skins, loop continuity and ground checks');print(len(report),'models,',sum(len(m['checks']) for m in report),'clips')
