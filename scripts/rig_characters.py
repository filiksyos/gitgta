"""Build individually skinned characters from the supplied static Meshy meshes.

Run: python scripts/rig_characters.py --prepare; node scripts/optimize-characters.mjs;

     python scripts/rig_characters.py

No source assets are changed. Bind poses and per-character landmarks are explicit.

"""

import sys, json, struct, io, math

from pathlib import Path

import numpy as np

from scipy.spatial.transform import Rotation as R

from scipy import sparse

from inspect_characters import SRC,load,acc,geometry

from PIL import Image

WORK=Path('artifacts/characters/work');WORK.mkdir(parents=True,exist_ok=True)

OUT=Path('public/models/characters');OUT.mkdir(parents=True,exist_ok=True)

# source index, stable id, pose, height; grouped family is intentionally not a pedestrian.

CAST=[(7,'tommy','down',1.82),(0,'nightlife','down',1.73),(1,'summer','t',1.73),(3,'casual','t',1.82),(4,'executive','down',1.76),(5,'suit','cross',1.82),(6,'floral','t',1.82),(8,'weathered','a',1.82),(9,'white-dress','down',1.72)]

FILES=sorted(SRC.glob('*.glb'))

def source(index,height):

 j,b,v,c=geometry(FILES[index]);v*=height/1.82

 p=j['meshes'][0]['primitives'][0];idx=acc(j,b,p['indices']).reshape(-1).astype(np.uint32);uv=acc(j,b,p['attributes']['TEXCOORD_0']);normal=acc(j,b,p['attributes']['NORMAL'])

 return j,b,v,uv,normal,idx,c

if '--prepare' in sys.argv:

 for index,name,pose,height in CAST:

  j,b,v,uv,n,idx,colors=source(index,height); stem=WORK/name

  v.astype('<f4').tofile(str(stem)+'.positions.bin');uv.astype('<f4').tofile(str(stem)+'.uv.bin');idx.astype('<u4').tofile(str(stem)+'.indices.bin')

  Path(str(stem)+'.input.json').write_text(json.dumps({'target':16000 if name=='tommy' else 9000}))

 sys.exit()



def skeleton(pose,h,name=""):

 k=h/1.82; names=[];parents=[];points=[];ends=[]

 def add(name,parent,point,end):

  names.append(name);parents.append(names.index(parent) if parent else -1);points.append(np.array(point)*k);ends.append(np.array(end)*k)

 add('Hips',None,[0,.94,0],[0,1.10,0]);add('Spine','Hips',[0,1.10,0],[0,1.29,0]);add('Chest','Spine',[0,1.29,0],[0,1.48,0]);add('Neck','Chest',[0,1.48,0],[0,1.60,0]);add('Head','Neck',[0,1.60,0],[0,1.80,0])

 for side,sg in [('Left',1),('Right',-1)]:

  shoulder=np.array([.205*sg,1.45,0]);

  if pose=='t': elbow=[.46*sg,1.43,0];wrist=[.68*sg,1.43,.005];hand=[.77*sg,1.43,.015]

  elif pose=='a': elbow=[.36*sg,1.22,0];wrist=[.49*sg,1.01,.015];hand=[.53*sg,.94,.03]

  elif pose=='cross': elbow=[.25*sg,1.15,.08];wrist=[-.08*sg,1.38,.16];hand=[-.16*sg,1.40,.15]

  else: elbow=[.265*sg,1.16,0];wrist=[.275*sg,.91,.03];hand=[.275*sg,.83,.04]

  if name=='floral': elbow=[.46*sg,1.49,0];wrist=[.65*sg,1.56,.015];hand=[.74*sg,1.60,.025]

  if name=='summer':

   elbow=[.46*sg,1.47 if sg<0 else 1.48,0];wrist=[.65*sg,1.51 if sg<0 else 1.61,.015];hand=[.74*sg,1.58 if sg<0 else 1.65,.025]

  if name=='executive': elbow=[.22*sg,1.16,0];wrist=[.205*sg,.91,.03];hand=[.20*sg,.83,.04]

  add(side+'Arm','Chest',shoulder,elbow);add(side+'ForeArm',side+'Arm',elbow,wrist);add(side+'Hand',side+'ForeArm',wrist,hand)

  add(side+'UpLeg','Hips',[.105*sg,.91,0],[.115*sg,.52,.025]);add(side+'Leg',side+'UpLeg',[.115*sg,.52,.025],[.12*sg,.12,0]);add(side+'Foot',side+'Leg',[.12*sg,.12,0],[.12*sg,.065,.16]);add(side+'Toe',side+'Foot',[.12*sg,.065,.16],[.12*sg,.045,.22])

 return names,np.array(parents),np.array(points),np.array(ends)



def skin(v,tri,names,points,ends,pose,name="",colors=None):

 # Capsule distance with anatomical masks prevents the nearby hands binding to the hips.

 seg=ends-points; rel=v[:,None,:]-points[None,:,:];t=np.clip(np.sum(rel*seg[None,:,:],axis=2)/np.sum(seg*seg,axis=1),0,1)

 distances=np.linalg.norm(rel-t[:,:,None]*seg[None,:,:],axis=2)

 y=v[:,1];x=v[:,0];h=v[:,1].max();k=h/1.82

 for i,name in enumerate(names):

  if 'Leg' in name or 'Foot' in name or 'Toe' in name:

   distances[y>1.0*k,i]+=2

   sg=1 if name.startswith('Left') else -1

   distances[x*sg<-.015*k,i]+=1

  elif any(s in name for s in ['Arm','Hand']):

   sg=1 if name.startswith('Left') else -1

   distances[x*sg<-.04*k,i]+=1

   if pose!='cross': distances[(np.abs(x)<.17*k)|(y<.76*k),i]+=1

  else:

   distances[y<.76*k,i]+=1

   if name=='Head': distances[y<1.52*k,i]+=.4

 nearest=np.argsort(distances,axis=1)[:,:3];ds=np.take_along_axis(distances,nearest,axis=1)

 weights=np.exp(-(ds-ds[:,0:1])*65/k);weights/=weights.sum(1,keepdims=True)

 w=np.zeros((len(v),len(names)));np.put_along_axis(w,nearest,weights,axis=1)

 # Weld texture seams before adjacency smoothing so the skin never tears along UV islands.

 _,inverse=np.unique(np.round(v,5),axis=0,return_inverse=True);count=inverse.max()+1

 a=inverse[tri[:,[0,1,1,2,2,0]].reshape(-1)];b=inverse[tri[:,[1,0,2,1,0,2]].reshape(-1)]

 adj=sparse.coo_matrix((np.ones(len(a)),(a,b)),shape=(count,count)).tocsr();adj.data[:]=1

 adj=sparse.diags(1/np.maximum(np.asarray(adj.sum(axis=1)).ravel(),1))@adj

 sums=np.bincount(inverse);weld=np.zeros((count,len(names)));np.add.at(weld,inverse,w);weld/=sums[:,None]

 seed=weld.copy()

 for _ in range(12): weld=.55*seed+.45*(adj@weld)

 w=weld[inverse]

 if name in ['executive','white-dress','nightlife']:

  hem={'executive':.50,'white-dress':.80,'nightlife':.88}[name]*k

  skirt=(y>hem)&(y<1.02*k)&(np.abs(x)<.235*k)
  if colors is not None:
   flesh=(colors[:,0]>colors[:,1]*1.08)&(colors[:,0]>colors[:,2]*1.12)&(colors[:,0]>85)
   skirt &= ~flesh

  w[skirt]=0;w[skirt,names.index('Hips')]=1

 joints=np.argsort(w,axis=1)[:,-4:];weights=np.take_along_axis(w,joints,axis=1);weights/=weights.sum(1,keepdims=True)

 return joints.astype(np.uint16),weights.astype(np.float32)



def align(a,b):

 a=a/np.linalg.norm(a);b=b/np.linalg.norm(b);cross=np.cross(a,b);dot=np.clip(a@b,-1,1)

 if dot<-.9999: return R.from_rotvec(np.array([1.,0,0])*math.pi)

 return R.from_quat(np.r_[cross,1+dot]/np.linalg.norm(np.r_[cross,1+dot]))



def pose_frame(names,parents,bind,ends,anim,t,duration,height):

 k=height/1.82;p=bind.copy();target=ends.copy();phase=t/duration*2*math.pi

 # All animation is in-place. Simulation owns world position and jumping height.

 gait=anim in ['Walk_Loop','Jog_Fwd_Loop','Sprint_Loop'];run=anim!='Walk_Loop'

 bob=((- .16 if run else -.10)+(.018 if run else .012)*(1-math.cos(phase*2))) if gait else .003*math.sin(phase)

 p[:5,1]+=bob*k;target[:5,1]+=bob*k

 if anim=='Driving_Loop': p[:5,1]-=.36*k;target[:5,1]-=.36*k

 if anim=='Death01':

  p,target=pose_frame(names,parents,bind,ends,'Idle_Loop',0,3.2,height)

  f=min(1,t/duration);rot=R.from_rotvec([0,0,1.4*f]);p=rot.apply(p-np.array([0,.9*k,0]))+np.array([0,(.9-.67*f)*k,0]);target=rot.apply(target-np.array([0,.9*k,0]))+np.array([0,(.9-.67*f)*k,0]);return p,target

 for side,sg in [('Left',1),('Right',-1)]:

  ids={s:names.index(side+s) for s in ['Arm','ForeArm','Hand','UpLeg','Leg','Foot','Toe']};q=phase+(0 if sg==1 else math.pi)

  hip=np.array([.105*sg,.91+bob,0])*k

  ankle=np.array([.12*sg,.12,0])*k

  if gait:

   # Stance has constant backward foot speed; swing clears the ground with a bent knee.

   u=(q/(2*math.pi))%1;stride=.88 if run else .70

   stance=.35 if run else .6

   if u<stance: z=stride*(.5-u/stance); lift=0

   else: a=(u-stance)/(1-stance);z=stride*(-.5+a);lift=(.17 if run else .09)*math.sin(math.pi*a)

   ankle+=np.array([0,lift,z])*k

  if anim.startswith('Jump'):

   crouch=.07 if anim=='Jump_Land' else .10;ankle[2]=.08*k;hip[1]-=crouch*k

  # Two-bone IK in sagittal plane; bounded reach prevents knee inversion.

  upper=.39*k;lower=.40*k;vec=ankle-hip;length=np.linalg.norm(vec);dist=min(length,upper+lower-.004*k);direction=vec/length

  mid=(upper*upper-lower*lower+dist*dist)/(2*dist);bend=math.sqrt(max(0,upper*upper-mid*mid));forward=np.array([0,0,1.]);forward-=direction*np.dot(forward,direction);forward/=np.linalg.norm(forward)

  ankle=hip+direction*dist

  knee=hip+direction*mid+forward*bend

  if anim=='Driving_Loop':

   hip=np.array([.105*sg,.55,0])*k;knee=hip+np.array([0,-.05,.38])*k;ankle=knee+np.array([0,-.39,.04])*k

  foot=ankle+np.array([0,-.055,.16])*k;toe=foot+np.array([0,-.02,.06])*k

  for s,pt,en in [('UpLeg',hip,knee),('Leg',knee,ankle),('Foot',ankle,foot),('Toe',foot,toe)]:p[ids[s]]=pt;target[ids[s]]=en

  shoulder=np.array([.205*sg,1.45+bob-(.36 if anim=='Driving_Loop' else 0),0])*k

  swing=(.50 if run else .29)*math.sin(q) if gait else .025*math.sin(phase+sg)

  elbow=shoulder+np.array([.04*sg,-.28, -math.sin(swing)*.28])*k

  wrist=elbow+np.array([.015*sg,-.23, .055-math.sin(swing)*.23])*k

  if gait and run: wrist=elbow+np.array([0,-.10,.215-math.sin(swing)*.14])*k

  if anim in ['Pistol_Idle_Loop','Pistol_Shoot']:

   elbow=shoulder+np.array([-.06*sg,-.12,.25])*k;wrist=elbow+np.array([-.07*sg,.015,.23])*k

   if anim=='Pistol_Shoot': wrist[2]-=.04*k*math.sin(math.pi*min(1,t/duration))

  if anim.startswith('Punch'):

   active=(sg==1)==(anim=='Punch_Jab');strike=math.sin(math.pi*min(1,t/duration)) if active else 0

   elbow=shoulder+np.array([.02*sg,-.12,.18+.10*strike])*k;wrist=elbow+np.array([-.06*sg,.10-.07*strike,.08+.16*strike])*k

  if anim=='Driving_Loop':

   elbow=shoulder+np.array([.02*sg,-.21,.16])*k;wrist=elbow+np.array([-.07*sg,.04,.23])*k

  hand=wrist+(wrist-elbow)/np.linalg.norm(wrist-elbow)*.09*k

  for s,pt,en in [('Arm',shoulder,elbow),('ForeArm',elbow,wrist),('Hand',wrist,hand)]:p[ids[s]]=pt;target[ids[s]]=en

 if anim in ['Idle_Loop','Talk_Loop','Pistol_Idle_Loop','Pistol_Shoot','Punch_Jab','Punch_Cross']:

  for i,bn in enumerate(names):

   if any(s in bn for s in ['Leg','Foot','Toe']): p[i]=bind[i];target[i]=ends[i]

 if anim in ['Idle_Loop','Talk_Loop']:

  for i,bn in enumerate(names):

   if any(s in bn for s in ['Arm','Hand']) and (ends[names.index(('Left' if bn.startswith('Left') else 'Right')+'Arm')][1]-bind[names.index(('Left' if bn.startswith('Left') else 'Right')+'Arm')][1])<-.15*k:

    p[i]=bind[i]+[0,bob*k,0];target[i]=ends[i]+[0,bob*k,.004*math.sin(phase)*k]

 return p,target



CLIPS={'Idle_Loop':3.2,'Walk_Loop':.96,'Jog_Fwd_Loop':.72,'Sprint_Loop':.64,'Jump_Start':.16,'Jump_Loop':.8,'Jump_Land':.18,'Punch_Jab':.4,'Punch_Cross':.45,'Pistol_Shoot':.3,'Pistol_Idle_Loop':2.4,'Driving_Loop':2.4,'Death01':1.0,'Talk_Loop':2.4}

class Writer:

 def __init__(self):self.j={'asset':{'version':'2.0','generator':'GitGTA character pipeline'},'buffers':[{'byteLength':0}],'bufferViews':[],'accessors':[]};self.bin=bytearray()

 def raw(self,data):

  while len(self.bin)%4:self.bin.append(0)

  i=len(self.j['bufferViews']);self.j['bufferViews'].append({'buffer':0,'byteOffset':len(self.bin),'byteLength':len(data)});self.bin.extend(data);return i

 def accessor(self,a,typ,component=5126,normalized=False,bounds=False):

  a=np.asarray(a);i=len(self.j['accessors']);d={'bufferView':self.raw(a.tobytes()),'componentType':component,'count':len(a),'type':typ}

  if normalized:d['normalized']=True

  if bounds:d.update(min=a.min(axis=0).reshape(-1).tolist(),max=a.max(axis=0).reshape(-1).tolist())

  self.j['accessors'].append(d);return i

 def save(self,path):

  while len(self.bin)%4:self.bin.append(0)

  self.j['buffers'][0]['byteLength']=len(self.bin);js=json.dumps(self.j,separators=(',',':')).encode();js+=b' '*((-len(js))%4)

  path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(js)+len(self.bin))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(self.bin),0x004e4942)+self.bin)



if __name__ == "__main__":

 reports=[]

 for index,name,pose,height in CAST:

  if '--only' in sys.argv and name!=sys.argv[sys.argv.index('--only')+1]:continue
  destination=OUT if name in ['tommy','nightlife','floral','weathered'] else Path('artifacts/characters/drafts')

  destination.mkdir(parents=True,exist_ok=True)

  j,b,v,uv,n,idx,colors=source(index,height);original=len(idx)//3;si=np.fromfile(str(WORK/name)+'.simplified.bin',dtype='<u4');keep,remap=np.unique(si,return_inverse=True);v=v[keep];uv=uv[keep];n=n[keep];tri=remap.reshape(-1,3)

  names,parents,points,ends=skeleton(pose,height,name);joints,weights=skin(v,tri,names,points,ends,pose,name,colors[keep])

  w=Writer();attrs={'POSITION':w.accessor(v.astype('<f4'),'VEC3',bounds=True),'NORMAL':w.accessor(n.astype('<f4'),'VEC3'),'TEXCOORD_0':w.accessor(uv.astype('<f4'),'VEC2'),'JOINTS_0':w.accessor(joints.astype('<u2'),'VEC4',5123),'WEIGHTS_0':w.accessor(weights.astype('<f4'),'VEC4')}

  # A restrained lower-face morph accompanies speech; hair and upper head remain still.

  mouth=np.zeros_like(v);front=np.maximum(0,v[:,2]);face=np.exp(-((v[:,0]/(.055*height/1.82))**2+((v[:,1]-height*.887)/(.022*height/1.82))**2))*np.clip(front/.075,0,1);mouth[:,1]=-.008*face;mouth[:,2]=.003*face

  primitive={'attributes':attrs,'indices':w.accessor(remap.astype('<u4').reshape(-1,1),'SCALAR',5125),'material':0,'targets':[{'POSITION':w.accessor(mouth.astype('<f4'),'VEC3',bounds=True)}]}

  w.j['meshes']=[{'name':name,'primitives':[primitive],'weights':[0],'extras':{'targetNames':['speech']}}]

  nodes=[{'name':'Character','children':[1,2]},{'name':name+'Mesh','mesh':0,'skin':0}]

  for i,bn in enumerate(names):

   trans=points[i]-(points[parents[i]] if parents[i]>=0 else 0);nodes.append({'name':bn,'translation':trans.tolist(),'children':[2+k for k,p in enumerate(parents) if p==i]})

  w.j['nodes']=nodes;w.j['scenes']=[{'nodes':[0]}];w.j['scene']=0

  ibm=np.tile(np.eye(4),(len(names),1,1));ibm[:,:3,3]=-points

  w.j['skins']=[{'name':name+'Rig','joints':list(range(2,len(nodes))),'skeleton':2,'inverseBindMatrices':w.accessor(ibm.transpose(0,2,1).reshape(-1,16).astype('<f4'),'MAT4')}]

  w.j['materials']=[{'name':name+'Material','pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':0,'roughnessFactor':.85},'doubleSided':False}]

  mat=j['materials'][j['meshes'][0]['primitives'][0].get('material',0)];ti=mat.get('pbrMetallicRoughness',{}).get('baseColorTexture',{}).get('index',0);im=j['images'][j['textures'][ti]['source']];bv=j['bufferViews'][im['bufferView']];tex=Image.open(io.BytesIO(b[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']])).convert('RGB');tex.thumbnail((1536,1536) if name=='tommy' else (1024,1024));buf=io.BytesIO();tex.save(buf,'JPEG',quality=90);w.j['images']=[{'bufferView':w.raw(buf.getvalue()),'mimeType':'image/jpeg'}];w.j['textures']=[{'source':0,'sampler':0}];w.j['samplers']=[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}]

  w.j['animations']=[];sampled={}

  for anim,dur in CLIPS.items():

   times=np.linspace(0,dur,max(9,int(dur*30)+1));rotations=[];translations=[]

   for t in times:

    posed,targets=pose_frame(names,parents,points,ends,anim,t,dur,height);world=[align(ends[i]-points[i],targets[i]-posed[i]) for i in range(len(names))];qs=[];ts=[]

    for i,parent in enumerate(parents):

     parentrot=world[parent] if parent>=0 else R.identity();qs.append((parentrot.inv()*world[i]).as_quat());ts.append(parentrot.inv().apply(posed[i]-(posed[parent] if parent>=0 else 0)))

    rotations.append(qs);translations.append(ts)

   rotations=np.array(rotations);translations=np.array(translations);sampled[anim]={'rotation':rotations.tolist(),'translation':translations.tolist(),'times':times.tolist()}

   a={'name':anim,'samplers':[],'channels':[]};timeacc=w.accessor(times.astype('<f4').reshape(-1,1),'SCALAR',bounds=True)

   for i in range(len(names)):

    for path,data,typ in [('rotation',rotations[:,i,:],'VEC4'),('translation',translations[:,i,:],'VEC3')]:

     a['channels'].append({'sampler':len(a['samplers']),'target':{'node':2+i,'path':path}});a['samplers'].append({'input':timeacc,'output':w.accessor(data.astype('<f4'),typ),'interpolation':'LINEAR'})

   if anim=='Talk_Loop':

    values=(.25+.65*np.sin(times*math.pi*5)**2).astype('<f4').reshape(-1,1);a['channels'].append({'sampler':len(a['samplers']),'target':{'node':1,'path':'weights'}});a['samplers'].append({'input':timeacc,'output':w.accessor(values,'SCALAR'),'interpolation':'LINEAR'})

   w.j['animations'].append(a)

  w.j['extras']={'character':name,'height':height,'forward':'+Z','rig':'19-joint capsule-weighted skeleton','source':FILES[index].name}

  w.save(destination/(name+'.glb'))

  np.savez_compressed(WORK/(name+'.qa.npz'),positions=v,uv=uv,triangles=tri,joints=joints,weights=weights,bind=points,ends=ends,parents=parents)

  (WORK/(name+'.clips.json')).write_text(json.dumps(sampled))

  reports.append({'name':name,'source':FILES[index].name,'sourceTriangles':original,'triangles':len(tri),'vertices':len(v),'joints':len(names),'clips':len(CLIPS),'bytes':(destination/(name+'.glb')).stat().st_size,'maxWeightError':float(abs(weights.sum(1)-1).max())})

  print(name,reports[-1],flush=True)

 Path('artifacts/characters/rig-report.json').write_text(json.dumps(reports,indent=2))

