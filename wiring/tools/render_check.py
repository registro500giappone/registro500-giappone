# -*- coding: utf-8 -*-
"""ビューアの実カメラ設定で頂点を投影し、body/dashboard/操舵マーカーを
スクリーン空間に散布。screen-left/rightと車の前後(-x=nose)を注記して
LHD/RHDを目視確定する。matplotlibオフスクリーン(Agg)。"""
import os, json, numpy as np
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from pygltflib import GLTF2
BASE=os.path.abspath(os.path.join(os.path.dirname(__file__),'..'))
ASSETS=os.path.join(BASE,'assets')
COMP={5120:np.int8,5121:np.uint8,5122:np.int16,5123:np.uint16,5125:np.uint32,5126:np.float32}
DIV={5120:127.0,5121:255.0,5122:32767.0,5123:65535.0}

def glb_verts(fname):
    g=GLTF2().load(os.path.join(ASSETS,fname)); blob=g.binary_blob(); out=[]
    for node in g.nodes:
        if node.mesh is None: continue
        prim=g.meshes[node.mesh].primitives[0]; a=g.accessors[prim.attributes.POSITION]
        bv=g.bufferViews[a.bufferView]; off=(bv.byteOffset or 0)+(a.byteOffset or 0)
        dt=COMP[a.componentType]; cb=np.dtype(dt).itemsize; stride=bv.byteStride or cb*3; nc=stride//cb
        raw=np.frombuffer(blob,dtype=dt,count=a.count*nc,offset=off)
        pos=raw.reshape(a.count,nc)[:,:3].astype(np.float64)
        if a.normalized: pos=pos/DIV[a.componentType]
        if node.scale: pos=pos*np.array(node.scale)
        if node.translation: pos=pos+np.array(node.translation)
        out.append(pos)
    return np.vstack(out)

# camera (viewer既定)
eye=np.array([-2600.,-3400.,1900.]); target=np.array([920.,0.,550.]); up=np.array([0.,0.,1.])
f=(target-eye); f/=np.linalg.norm(f)
s=np.cross(f,up); s/=np.linalg.norm(s)     # camera right
u=np.cross(s,f)                            # camera up
# view: screen_x = dot(p-eye, s), screen_y = dot(p-eye, u), depth = dot(p-eye, f)
def project(P):
    d=P-eye
    sx=d@s; sy=d@u; dz=d@f
    persp=1.0/np.clip(dz,1.0,None)*2000.0
    return sx*persp, sy*persp, dz

def scr_of(pt):
    x,y,_=project(np.array([pt]))
    return x[0],y[0]

body=glb_verts('body_f_v2.glb'); dash=glb_verts('dashboard_110f.glb')
bx,by,_=project(body); dx,dy,_=project(dash)

fig,ax=plt.subplots(figsize=(10,8))
ax.scatter(bx,by,s=0.5,c='#bbbbbb',alpha=0.25,label='body')
ax.scatter(dx,dy,s=3,c='#d02020',alpha=0.8,label='dashboard(instruments)')
# markers
mk={'steering':[490,250,800],'seat_driver':[650,280,600],'seat_pass':[650,-280,600],
    'nose(-x front)':[-409,0,578],'rear(+x)':[2300,0,500]}
for nm,p in mk.items():
    X,Y=scr_of(p); ax.scatter([X],[Y],s=90,marker='*',zorder=5)
    ax.annotate(nm,(X,Y),fontsize=9,color='blue',xytext=(4,4),textcoords='offset points')
# where does +y point on screen? s vector's y-comp:
ax.set_title(f"viewer default camera view  (screen_right basis s={s.round(2)}, +y->screen_x sign={np.sign(s[1]):.0f})")
ax.set_xlabel('screen X (right +)'); ax.set_ylabel('screen Y (up +)')
ax.legend(loc='upper right'); ax.set_aspect('equal'); ax.grid(alpha=0.2)
os.makedirs(os.path.join(BASE,'scratchpad'),exist_ok=True)
outp=os.path.join(BASE,'scratchpad','rhd_check_default.png')
plt.savefig(outp,dpi=110,bbox_inches='tight'); print('saved',outp)
print('camera right vector s=',s.round(3),' => +y maps to screen-x sign',np.sign(s[1]))
print('dashboard screen-x mean=',dx.mean().round(1),' body screen-x mean=',bx.mean().round(1))

# ===== 決定版: 運転者と同じ向き(車の後方から前方-xを見る)ビュー =====
def render_view(eye2,target2,up2,fname,title):
    f2=(target2-eye2); f2/=np.linalg.norm(f2)
    s2=np.cross(f2,up2); s2/=np.linalg.norm(s2); u2=np.cross(s2,f2)
    def proj(P):
        d=P-eye2; return d@s2, d@u2, d@f2
    bx2,by2,_=proj(body); dx2,dy2,_=proj(dash)
    fig,ax=plt.subplots(figsize=(9,7))
    ax.scatter(bx2,by2,s=0.5,c='#bbbbbb',alpha=0.25)
    ax.scatter(dx2,dy2,s=4,c='#d02020',alpha=0.85,label='dashboard')
    for nm,p,col in [('steering',[490,250,800],'blue'),('seat_driver',[650,280,600],'orange'),
                     ('seat_pass',[650,-280,600],'green')]:
        X,Y,_=proj(np.array([p])); ax.scatter(X,Y,s=120,marker='*',color=col,zorder=5)
        ax.annotate(nm,(X[0],Y[0]),fontsize=10,color=col,xytext=(5,5),textcoords='offset points')
    ax.set_title(title); ax.set_xlabel('<= screen LEFT      screen RIGHT =>')
    ax.axvline(0,color='k',lw=0.5,alpha=0.3); ax.legend(loc='upper right')
    ax.set_aspect('equal'); ax.grid(alpha=0.2)
    outp=os.path.join(BASE,'scratchpad',fname)
    plt.savefig(outp,dpi=110,bbox_inches='tight'); plt.close()
    print(f'{fname}: dashboard screen-x mean={dx2.mean():.0f}  (+右/-左),  camera_right s={s2.round(2)}')
    return outp

# 運転者視点(後方+xから前方-xを向く。up+z)。screen-right=+y
render_view(np.array([5000.,0.,650.]),np.array([0.,0.,650.]),np.array([0.,0.,1.]),
            'rhd_check_driverview.png',
            'DRIVER-oriented view: looking forward(-x) from behind car\n(this matches how a driver sees left/right)')
