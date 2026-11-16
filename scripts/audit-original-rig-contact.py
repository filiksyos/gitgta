"""Sample original animation clips and identify stretched bridges at sculpted hand/clothing contacts."""
import json,math
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation as R
from inspect_characters import load,acc
j,b=load(Path('public/models/characters/tommy-original-rig.glb'));tj,tb=load(Path('public/models/characters/tommy.glb'));v=acc(j,b,j['meshes'][0]['primitives'][0]['attributes']['POSITION']);ref=acc(tj,tb,tj['meshes'][0]['primitives'][0]['attributes']['POSITION'])*[-1,1,-1];pr=j['meshes'][0]['primitives'][0];weights=acc(j,b,pr['attributes']['WEIGHTS_0']);joints=acc(j,b,pr['attributes']['JOINTS_0']);tri=acc(j,b,pr['indices']).reshape(-1,3);skin=j['skins'][0];ibm=acc(j,b,skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1);parents={c:i for i,n in enumerate(j['nodes']) for c in n.get('children',[])};vh=np.column_stack([v,np.ones(len(v))]);bad=np.zeros(len(tri),dtype=bool)
ends=[(0,1),(1,2),(2,0)];centroid=ref[tri].mean(1);contact=(np.abs(centroid[:,0])>.16)&(centroid[:,1]>.77)&(centroid[:,1]<1.27)
report=[]
for clip in j['animations']:
 if clip['name'] not in ['Idle','Walk','Run']:continue
 channels=[(c['target']['node'],c['target']['path'],acc(j,b,clip['samplers'][c['sampler']]['input']).ravel(),acc(j,b,clip['samplers'][c['sampler']]['output'])) for c in clip['channels']];duration=max(c[2][-1] for c in channels)
 for time in np.linspace(0,duration,13)[:-1]:
  overrides={}
  for node,prop,times,values in channels:
   k=min(len(times)-1,np.searchsorted(times,time));overrides[(node,prop)]=values[k]
  cache={}
  def world(i):
   if i in cache:return cache[i]
   n=j['nodes'][i];m=np.eye(4);m[:3,:3]=R.from_quat(overrides.get((i,'rotation'),n.get('rotation',[0,0,0,1]))).as_matrix()@np.diag(overrides.get((i,'scale'),n.get('scale',[1,1,1])));m[:3,3]=overrides.get((i,'translation'),n.get('translation',[0,0,0]));m=world(parents[i])@m if i in parents else m;cache[i]=m;return m
  matrices=np.array([world(i) for i in skin['joints']])@ibm;posed=np.zeros_like(v,dtype=float)
  for k in range(4):posed+=np.einsum('nij,nj->ni',matrices[joints[:,k]],vh)[:,:3]*weights[:,k,None]
  for a,z in ends:
   before=np.linalg.norm(ref[tri[:,a]]-ref[tri[:,z]],axis=1);after=np.linalg.norm(posed[tri[:,a]]-posed[tri[:,z]],axis=1);bad|=contact&(after>.06)&(after>before*3)
np.save('artifacts/characters/contact-bridge-faces.npy',bad)
print('Contact bridge faces:',int(bad.sum()),'of',len(tri))
