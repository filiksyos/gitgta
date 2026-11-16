"""Fit Tommy's visible mesh to player.glb's existing skeleton; preserve all source clips."""
import copy,json,io,sys
from PIL import Image
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation as R
from inspect_characters import load,acc
from rig_characters import Writer,align
from separate_tommy_contacts import separate_contacts

original=Path('public/models/player.glb');tommy=Path('public/models/characters/tommy.glb')
j,b=load(original);tj,tb=load(tommy)
parents={child:i for i,n in enumerate(j['nodes']) for child in n.get('children',[])}
def world(i):
 n=j['nodes'][i]
 if 'matrix' in n:m=np.array(n['matrix']).reshape(4,4).T
 else:
  m=np.eye(4);m[:3,:3]=R.from_quat(n.get('rotation',[0,0,0,1])).as_matrix()@np.diag(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0])
 return world(parents[i])@m if i in parents else m
nodeByName={n.get('name','').replace('mixamorig:',''):i for i,n in enumerate(j['nodes'])}
sourceSkin=j['skins'][0];skinIndex={node:i for i,node in enumerate(sourceSkin['joints'])}
meshNode=next(i for i,n in enumerate(j['nodes']) if n.get('mesh')==0);meshWorld=world(meshNode);meshInverse=np.linalg.inv(meshWorld)
pr=tj['meshes'][0]['primitives'][0];at=pr['attributes'];v=acc(tj,tb,at['POSITION']);normal=acc(tj,tb,at['NORMAL']);uv=acc(tj,tb,at['TEXCOORD_0']);weights=acc(tj,tb,at['WEIGHTS_0']);joints=acc(tj,tb,at['JOINTS_0']);idx=acc(tj,tb,pr['indices'])
bind=np.linalg.inv(acc(tj,tb,tj['skins'][0]['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1));oldNodes=tj['skins'][0]['joints'];flip=np.diag([-1.,1.,-1.]);v=v@flip.T;normal=normal@flip.T
mapping={'Hips':'Hips','Spine':'Spine','Chest':'Spine2','Neck':'Neck','Head':'Head'}
for side in ['Left','Right']:
 for part in ['Arm','ForeArm','Hand','UpLeg','Leg','Foot']:mapping[side+part]=side+part
 mapping[side+'Toe']=side+'ToeBase'
# Use the original Idle reference pose to bind the mesh. Inverting the weighted
# skin matrices preserves Tommy's sculpt in that pose, including wrist roll.
# No animation is authored or retargeted: original channels run on original bones.
idle=next(a for a in j['animations'] if a['name']=='Idle');overrides={}
for channel in idle['channels']:
 sampler=idle['samplers'][channel['sampler']]
 overrides[(channel['target']['node'],channel['target']['path'])]=acc(j,b,sampler['output'])[0]
poseCache={}
def referenceWorld(i):
 if i in poseCache:return poseCache[i]
 n=j['nodes'][i];m=np.eye(4)
 q=overrides.get((i,'rotation'),n.get('rotation',[0,0,0,1]));scale=overrides.get((i,'scale'),n.get('scale',[1,1,1]));pos=overrides.get((i,'translation'),n.get('translation',[0,0,0]))
 m[:3,:3]=R.from_quat(q).as_matrix()@np.diag(scale);m[:3,3]=pos
 if i in parents:m=referenceWorld(parents[i])@m
 poseCache[i]=m;return m
inverseBinds=acc(j,b,sourceSkin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
newJointIds=[skinIndex[nodeByName[mapping[tj['nodes'][i]['name']]]] for i in oldNodes]
newJoints=np.array(newJointIds,dtype=np.uint16)[joints]
# Correct the sculpt's touching hand/trouser boundary before inverse binding.
# Blue/teal garment vertices cannot be weighted to the nearby swinging hands.
image=tj['images'][0];imageView=tj['bufferViews'][image['bufferView']]
texture=np.array(Image.open(io.BytesIO(tb[imageView['byteOffset']:imageView['byteOffset']+imageView['byteLength']])).convert('RGB'))
colors=texture[(np.clip(uv[:,1],0,1)*(texture.shape[0]-1)).astype(int),(np.clip(uv[:,0],0,1)*(texture.shape[1]-1)).astype(int)].astype(float)
fullWeights=np.zeros((len(v),len(sourceSkin['joints'])))
for k in range(4):np.add.at(fullWeights,(np.arange(len(v)),newJoints[:,k]),weights[:,k])
armSlots=[slot for slot,node in enumerate(sourceSkin['joints']) if any(part in j['nodes'][node]['name'] for part in ['Arm','Hand'])]
garment=(colors[:,2]>colors[:,0]*1.03)|(colors[:,1]>colors[:,0]*1.07)
notArm=garment&(v[:,1]<1.24)&~((v[:,1]>1.18)&(np.abs(v[:,0])>.245))
fullWeights[np.ix_(notArm,armSlots)]=0
for side,sign in [('Left',-1),('Right',1)]:
 flesh=(colors[:,0]>colors[:,2]*1.08)&(colors[:,0]>colors[:,1]*.98)&(v[:,1]>.77)&(v[:,1]<1.42)&(v[:,0]*sign>.19)
 arm=skinIndex[nodeByName[side+'Arm']];forearm=skinIndex[nodeByName[side+'ForeArm']];hand=skinIndex[nodeByName[side+'Hand']]
 fullWeights[flesh]=0
 upper=np.clip((v[flesh,1]-1.10)/.13,0,1);palm=(v[flesh,1]<.99).astype(float)
 fullWeights[flesh,arm]=upper;fullWeights[flesh,hand]=palm;fullWeights[flesh,forearm]=1-upper-palm
empty=fullWeights.sum(1)<1e-8
fullWeights[empty,skinIndex[nodeByName['Hips']]]=1
fullWeights/=fullWeights.sum(1,keepdims=True)
v,normal,uv,idx,fullWeights,sourceVertices,faceMaterials=separate_contacts(v,normal,uv,idx.reshape(-1,3),fullWeights,texture,nodeByName,skinIndex)
newJoints=np.argsort(fullWeights,axis=1)[:,-4:].astype(np.uint16)
weights=np.take_along_axis(fullWeights,newJoints,axis=1);weights/=weights.sum(1,keepdims=True)
# Fit limb landmarks to the existing posed skeleton so a wrist rotates about
# the mesh's wrist, rather than an offset point outside Tommy's sculpt.
fitBySkin={}
for oldIndex,oldNode in enumerate(oldNodes):
 name=tj['nodes'][oldNode]['name'];targetName=mapping[name];targetNode=nodeByName[targetName]
 origin=flip@bind[oldIndex,:3,3];children=tj['nodes'][oldNode].get('children',[])
 if children: endpoint=flip@bind[oldNodes.index(children[0]),:3,3]
 else:endpoint=origin+flip@np.array([0,.2,0] if name=='Head' else [0,-.08,.01] if name.endswith('Hand') else [0,-.02,.06])
 childName={'Hips':'Spine','Spine':'Spine1','Spine2':'Neck','Neck':'Head','Head':'HeadTop_End'}.get(targetName)
 for side in ['Left','Right']:
  childName={side+'Arm':side+'ForeArm',side+'ForeArm':side+'Hand',side+'Hand':side+'HandMiddle1',side+'UpLeg':side+'Leg',side+'Leg':side+'Foot',side+'Foot':side+'ToeBase',side+'ToeBase':side+'Toe_End'}.get(targetName,childName)
 destination=referenceWorld(targetNode)[:3,3];direction=endpoint-origin;targetDirection=referenceWorld(nodeByName[childName])[:3,3]-destination
 rotation=align(direction,targetDirection).as_matrix();lengthScale=np.clip(np.linalg.norm(targetDirection)/np.linalg.norm(direction),.65,1.3)
 if name=='Head' or name.endswith(('Hand','Foot','Toe')):lengthScale=1
 axis=direction/np.linalg.norm(direction);linear=rotation@(np.eye(3)+(lengthScale-1)*np.outer(axis,axis));m=np.eye(4);m[:3,:3]=linear;m[:3,3]=destination-linear@origin;fitBySkin[skinIndex[targetNode]]=m
fitted=np.zeros_like(v);fittedNormals=np.zeros_like(normal)
for slot,matrix in fitBySkin.items():
 influence=fullWeights[:,slot,None];fitted+=(v@matrix[:3,:3].T+matrix[:3,3])*influence;fittedNormals+=(normal@np.linalg.inv(matrix[:3,:3]))*influence
v=fitted;normal=fittedNormals/np.linalg.norm(fittedNormals,axis=1,keepdims=True)
referenceMatrices=np.array([referenceWorld(i) for i in sourceSkin['joints']])@inverseBinds
weighted=np.zeros((len(v),4,4))
for k in range(4):weighted+=referenceMatrices[newJoints[:,k]]*weights[:,k,None,None]
referenceInverse=np.linalg.inv(weighted)
local=np.einsum('nij,nj->ni',referenceInverse,np.column_stack([v,np.ones(len(v))]))[:,:3]
normals=np.einsum('nji,nj->ni',weighted[:,:3,:3],normal);normals/=np.linalg.norm(normals,axis=1,keepdims=True)
reconstructed=np.einsum('nij,nj->ni',weighted,np.column_stack([local,np.ones(len(local))]))[:,:3]
error=float(np.linalg.norm(reconstructed-v,axis=1).max());assert error<1e-6
posed=(np.column_stack([local,np.ones(len(local))])@meshWorld.T)[:,:3]
# Extend the source container so its skeleton and animation channel buffers remain byte-identical.
w=Writer();w.j=copy.deepcopy(j);w.bin=bytearray(b)
attrs={'POSITION':w.accessor(local.astype('<f4'),'VEC3',bounds=True),'NORMAL':w.accessor(normals.astype('<f4'),'VEC3'),'TEXCOORD_0':w.accessor(uv.astype('<f4'),'VEC2'),'JOINTS_0':w.accessor(newJoints.astype('<u2'),'VEC4',5123),'WEIGHTS_0':w.accessor(weights.astype('<f4'),'VEC4')}
# Preserve Tommy's original textures and material, embedding the image data in the new GLB.
material=copy.deepcopy(tj['materials'][0]);textureId=material['pbrMetallicRoughness']['baseColorTexture']['index'];image=tj['images'][tj['textures'][textureId]['source']];view=tj['bufferViews'][image['bufferView']];imageData=tb[view['byteOffset']:view['byteOffset']+view['byteLength']]
w.j['images']=[{'bufferView':w.raw(imageData),'mimeType':image['mimeType']}];w.j['textures']=[{'source':0}];material['pbrMetallicRoughness']['baseColorTexture']['index']=0;material['doubleSided']=True;w.j['materials']=[material]
for name,color in [('SkinContact',[.55,.35,.24,1]),('ShirtContact',[.24,.57,.55,1]),('DenimContact',[.25,.33,.37,1])]:w.j['materials'].append({'name':name,'pbrMetallicRoughness':{'baseColorFactor':color,'metallicFactor':0,'roughnessFactor':.9},'doubleSided':True})
if '--remove-contact-bridges' in sys.argv:
 mask=np.load('artifacts/characters/contact-bridge-faces.npy');idx=idx.reshape(-1,3)[~mask].reshape(-1,1)
primitive={'attributes':attrs,'indices':w.accessor(idx.reshape(-1,3)[faceMaterials==0].astype('<u4').reshape(-1,1),'SCALAR',5125),'material':0}
if pr.get('targets'):
 originalDelta=acc(tj,tb,pr['targets'][0]['POSITION'])@flip.T
 delta=np.zeros_like(v);valid=sourceVertices>=0;delta[valid]=originalDelta[sourceVertices[valid]]
 newDelta=np.einsum('nij,nj->ni',referenceInverse[:,:3,:3],delta)
 primitive['targets']=[{'POSITION':w.accessor(newDelta.astype('<f4'),'VEC3',bounds=True)}]
primitives=[primitive]
for materialId in [1,2,3]:
 cap=copy.deepcopy(primitive);cap['material']=materialId;cap['indices']=w.accessor(idx.reshape(-1,3)[faceMaterials==materialId].astype('<u4').reshape(-1,1),'SCALAR',5125);primitives.append(cap)
w.j['meshes']=[{'name':'TommyOriginalRig','primitives':primitives,'weights':[0],'extras':{'targetNames':['speech']}}]
for node in w.j['nodes']:
 if 'mesh' in node:
  if node['mesh']==0:node['mesh']=0;node['skin']=0
  else:node.pop('mesh');node.pop('skin',None)
w.j['extras']={'character':'Tommy Vercetti','animationSource':str(original),'forward':'-Z','adaptation':'Visible mesh fitted to original bind skeleton; original animation channels preserved'}
assert w.j['animations']==j['animations']
assert w.j['skins']==j['skins']
assert np.isfinite(local).all() and np.max(abs(weights.sum(1)-1))<1e-5
output=Path('public/models/characters/tommy-original-rig.glb');w.save(output)
Path('artifacts/characters/original-rig-adaptation.json').write_text(json.dumps({'asset':str(output),'originalAnimations':[c['name'] for c in j['animations']],'skeletonUnchanged':True,'animationChannelsUnchanged':True,'vertices':len(v),'referenceSkinReconstructionError':error,'bindBounds':[posed.min(0).tolist(),posed.max(0).tolist()]},indent=2),encoding='utf-8')
print('Saved',output,'with unchanged original rig and Idle/Walk/Run/TPose clips',flush=True)
