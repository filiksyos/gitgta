from rig_characters import *
from PIL import ImageDraw
sheet=Image.new('RGB',(1500,1950),'#251c32');d=ImageDraw.Draw(sheet)
for i,(index,name,pose,h) in enumerate(CAST):
 j,b,v,c=geometry(FILES[index]);v*=h/1.82
 canvas=np.full((600,490,3),[37,28,50],dtype=np.uint8);x=(v[:,0]*280+245).astype(int);y=(550-v[:,1]*280).astype(int)
 for kk in np.argsort(v[:,2]):
  xx=x[kk];yy=y[kk]
  if 1<=xx<489 and 1<=yy<599:canvas[yy-1:yy+2,xx-1:xx+2]=c[kk]
 im=Image.fromarray(canvas);di=ImageDraw.Draw(im);names,parents,pts,ends=skeleton(pose,h)
 for k in range(len(names)):
  a=tuple((pts[k][[0,1]]*np.array([280,-280])+[245,550]).astype(int));b=tuple((ends[k][[0,1]]*np.array([280,-280])+[245,550]).astype(int));di.line([a,b],fill='#ff3333',width=2);di.ellipse([a[0]-3,a[1]-3,a[0]+3,a[1]+3],fill='yellow')
 sheet.paste(im,((i%3)*500,(i//3)*650));d.text(((i%3)*500+5,(i//3)*650+610),name,fill='white')
sheet.save('artifacts/characters/landmarks.jpg')
