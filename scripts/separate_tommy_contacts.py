"""Separate touching hand/garment surfaces in a sculpt before binding a humanoid rig."""
import numpy as np
from collections import defaultdict
from scipy.spatial import ConvexHull

def separate_contacts(v,normal,uv,tri,full,texture,nodeByName,skinIndex):
 face_uv=uv[tri].mean(1);c=texture[(np.clip(face_uv[:,1],0,1)*(texture.shape[0]-1)).astype(int),(np.clip(face_uv[:,0],0,1)*(texture.shape[1]-1)).astype(int)].astype(float)
 centers=v[tri].mean(1);contact=(centers[:,1]>.76)&(centers[:,1]<1.10)&(np.abs(centers[:,0])>.18)
 flesh=(c[:,0]>c[:,2]*1.06)&(c[:,0]>c[:,1]*.96)
 groups=np.zeros(len(tri),dtype=int);groups[contact]=3;groups[contact&flesh&(centers[:,0]<0)]=1;groups[contact&flesh&(centers[:,0]>=0)]=2
 # Expand the skin classification onto neutral-colored watch/knuckle triangles
 # using adjacent skin faces, while leaving blue denim and teal fabric separate.
 vertexSkin=np.zeros(len(v));np.maximum.at(vertexSkin,tri.ravel(),np.repeat((groups==1)|(groups==2),3))
 neutral=(abs(c[:,0]-c[:,2])<18)&(c[:,0]>60)
 watch=contact&neutral&(vertexSkin[tri].sum(1)>=2)
 groups[watch&(centers[:,0]<0)]=1;groups[watch&(centers[:,0]>=0)]=2
 positions=[];normals=[];texcoords=[];weightRows=[];sources=[];lookup={};newTri=[]
 def weight(index,group):
  row=full[index].copy();y=v[index,1];side='Left' if v[index,0]<0 else 'Right'
  if group in [1,2]:
   row[:]=0;name='Left' if group==1 else 'Right';palm=float(y<.99);row[skinIndex[nodeByName[name+'Hand']]]=palm;row[skinIndex[nodeByName[name+'ForeArm']]]=1-palm
  elif group==3:
   row[:]=0;hip=np.clip((y-.80)/.13,0,1);row[skinIndex[nodeByName['Hips']]]=hip;row[skinIndex[nodeByName[side+'UpLeg']]]=1-hip
  return row
 for face,group in zip(tri,groups):
  output=[]
  for index in face:
   key=(int(index),int(group))
   if key not in lookup:
    lookup[key]=len(positions);positions.append(v[index]);normals.append(normal[index]);texcoords.append(uv[index]);weightRows.append(weight(index,group));sources.append(index)
   output.append(lookup[key])
  newTri.append(output)
 # Recover topology across UV seams, then cap only the new contact boundaries.
 _,weld=np.unique(np.round(v,5),axis=0,return_inverse=True);edges=defaultdict(list)
 for fi,face in enumerate(tri):
  for a,b in [(0,1),(1,2),(2,0)]:
   key=tuple(sorted((int(weld[face[a]]),int(weld[face[b]]))))
   if key[0]!=key[1]:edges[key].append((fi,a,b))
 boundaries=defaultdict(list)
 for records in edges.values():
  if len(records)!=2:continue
  if groups[records[0][0]]==groups[records[1][0]]:continue
  for fi,a,b in records:
   boundaries[int(groups[fi])].append((int(weld[tri[fi,a]]),int(weld[tri[fi,b]]),newTri[fi][a],newTri[fi][b]))
 faceMaterials=[0]*len(newTri)
 caps=0
 for group,segments in boundaries.items():
  adjacency=defaultdict(set);representative={}
  for a,b,ia,ib in segments:adjacency[a].add(b);adjacency[b].add(a);representative[a]=ia;representative[b]=ib
  remaining=set(adjacency)
  while remaining:
   stack=[remaining.pop()];component=[]
   while stack:
    key=stack.pop();component.append(key)
    for other in adjacency[key]:
     if other in remaining:remaining.remove(other);stack.append(other)
   if len(component)<3:continue
   ids=[representative[k] for k in component];points=np.array([positions[i] for i in ids]);center=points.mean(0)
   _,_,axes=np.linalg.svd(points-center,full_matrices=False);flat=(points-center)@axes[:2].T
   try:order=ConvexHull(flat).vertices.tolist()
   except Exception:continue
   # A tiny closed patch replaces the source's welded contact; it follows its
   # own side of the seam rather than bridging the hand back to the trousers.
   centerIndex=len(positions);nrm=np.cross(axes[0],axes[1]);nrm/=np.linalg.norm(nrm)
   positions.append(center);normals.append(nrm);weightRows.append(np.mean([weightRows[i] for i in ids],axis=0));sources.append(-1)
   uvCandidates=np.array([texcoords[i] for i in ids]);palette=texture[(np.clip(uvCandidates[:,1],0,1)*(texture.shape[0]-1)).astype(int),(np.clip(uvCandidates[:,0],0,1)*(texture.shape[1]-1)).astype(int)].astype(float)
   skinScore=palette[:,0]-palette[:,2];pick=int(np.argmax(skinScore) if group in [1,2] else np.argmin(skinScore));texcoords.append(uvCandidates[pick])
   for a,b in zip(order,order[1:]+order[:1]):
    newTri.append([ids[a],ids[b],centerIndex]);faceMaterials.append(1 if group in [1,2] else 2 if center[1]>1.0 else 3);caps+=1
 full=np.array(weightRows);full/=full.sum(1,keepdims=True)
 print('Separated contact surfaces:',int(contact.sum()),'faces; cap triangles:',caps,flush=True)
 return np.array(positions),np.array(normals),np.array(texcoords),np.array(newTri,dtype=np.uint32).reshape(-1,1),full,np.array(sources),np.array(faceMaterials)
