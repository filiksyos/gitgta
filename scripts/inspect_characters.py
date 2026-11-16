import json,struct,io
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.spatial.transform import Rotation
SRC=Path(r'C:\Users\toshiba\Desktop\GTA 6\glb assets')
TYPES={5126:np.float32,5125:np.uint32,5123:np.uint16,5121:np.uint8}
SIZES={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def load(path):
 b=path.read_bytes(); n=struct.unpack_from('<I',b,12)[0]; j=json.loads(b[20:20+n]); return j,b[28+n:]
def acc(j,b,i):
 a=j['accessors'][i]; v=j['bufferViews'][a['bufferView']]; dtype=TYPES[a['componentType']]; return np.ndarray((a['count'],SIZES[a['type']]),dtype=dtype,buffer=b,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',np.dtype(dtype).itemsize*SIZES[a['type']]),np.dtype(dtype).itemsize)).copy()
def geometry(path):
 j,b=load(path); p=j['meshes'][0]['primitives'][0]; v=acc(j,b,p['attributes']['POSITION']); n=next(n for n in j['nodes'] if 'mesh' in n)
 if 'rotation' in n: v=Rotation.from_quat(n['rotation']).apply(v)
 if 'scale' in n: v*=n['scale']
 if 'translation' in n: v+=n['translation']
 lo=v.min(0); hi=v.max(0); v=(v-np.array([(lo[0]+hi[0])/2,lo[1],(lo[2]+hi[2])/2]))/(hi[1]-lo[1])*1.82
 uv=acc(j,b,p['attributes']['TEXCOORD_0']); mat=j['materials'][p.get('material',0)]; ti=mat.get('pbrMetallicRoughness',{}).get('baseColorTexture',{}).get('index',0); im=j['images'][j['textures'][ti]['source']]; bv=j['bufferViews'][im['bufferView']]; tex=Image.open(io.BytesIO(b[bv.get('byteOffset',0):bv.get('byteOffset',0)+bv['byteLength']])).convert('RGB'); tex=np.array(tex); u=(uv[:,0]%1*(tex.shape[1]-1)).astype(int); w=(uv[:,1]%1*(tex.shape[0]-1)).astype(int); colors=tex[w,u]
 return j,b,v,colors
if __name__=='__main__':
 paths=sorted(SRC.glob('*.glb')); sheet=Image.new('RGB',(1500,1200),'#251c32'); d=ImageDraw.Draw(sheet)
 for i,path in enumerate(paths):
  j,b,v,c=geometry(path); print(i,path.name, len(v),v.min(0).round(3),v.max(0).round(3))
  for back in [False,True]:
   pts=v.copy(); pts[:,0]*=(-1 if back else 1); pts[:,2]*=(-1 if back else 1)
   size=280; canvas=np.full((470,size,3),[37,28,50],dtype=np.uint8); x=((pts[:,0])*210+size/2).astype(int); y=(420-pts[:,1]*210).astype(int)
   for k in np.argsort(pts[:,2]):
    xx=x[k]; yy=y[k]
    if 1<=xx<size-1 and 1<=yy<469: canvas[yy-1:yy+2,xx-1:xx+2]=c[k]
   im=Image.fromarray(canvas).resize((140,235)); ox=(i%5)*300+int(back)*145; oy=(i//5)*590; sheet.paste(im,(ox,oy))
  d.text(((i%5)*300+4,(i//5)*590+245),f'{i}: {path.stem[9:39]}',fill='white')
 sheet.save('artifacts/characters/source-contact-sheet.jpg')
