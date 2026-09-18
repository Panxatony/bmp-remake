import struct,sys
d=open(sys.argv[1],'rb').read()
h=struct.unpack('<14H',d[:28])
load=h[4]*16
hdr_off=load+h[11]*16
hdr=d[hdr_off:hdr_off+18]
print('exepack hdr', hdr.hex(), 'sig at 16:', d[hdr_off+16:hdr_off+18], 'sig at 14:', d[hdr_off+14:hdr_off+16])
if d[hdr_off+16:hdr_off+18]==b'RB':
    real_ip,real_cs,mem_start,exepack_size,real_sp,real_ss,dest_len,skip_len=struct.unpack('<8H',hdr[:16]); hlen=18
else:
    real_ip,real_cs,mem_start,exepack_size,real_sp,real_ss,dest_len=struct.unpack('<7H',hdr[:14]); skip_len=1; hlen=16
print(dict(real_ip=hex(real_ip),real_cs=hex(real_cs),exepack_size=exepack_size,real_sp=hex(real_sp),real_ss=hex(real_ss),dest_len=dest_len,skip_len=skip_len))
packed=d[load:hdr_off]
# strip trailing 0xff padding
end=len(packed)
while end>0 and packed[end-1]==0xff: end-=1
src=end
out=bytearray(dest_len*16)
dst=len(out)
while True:
    src-=1; cmd=packed[src]
    src-=2; length=struct.unpack('<H',packed[src:src+2])[0]
    if cmd&0xfe==0xb0:
        src-=1; fill=packed[src]
        dst-=length; out[dst:dst+length]=bytes([fill])*length
    elif cmd&0xfe==0xb2:
        dst-=length; out[dst:dst+length]=packed[src-length:src]; src-=length
    else:
        raise SystemExit('bad cmd %02x at %d'%(cmd,src))
    if cmd&1: break
out[:dst]=packed[:src]
print("unpacked",len(out),"prefix",src)
# relocations
rel=hdr_off+exepack_size  # hmm: relocation table follows the stub; stub begins at hdr_off+hlen
# find stub length: search for "Packed file is corrupt" then table follows
i=d.find(b'Packed file is corrupt',hdr_off)
p=i+len(b'Packed file is corrupt')
relocs=[]
for seg in range(16):
    cnt=struct.unpack('<H',d[p:p+2])[0]; p+=2
    for k in range(cnt):
        off=struct.unpack('<H',d[p:p+2])[0]; p+=2
        relocs.append((seg*0x1000,off))
print('relocs',len(relocs))
import json
json.dump(relocs,open(sys.argv[2]+'.relocs.json','w'))
open(sys.argv[2]+'.bin','wb').write(bytes(out))
print('done')
