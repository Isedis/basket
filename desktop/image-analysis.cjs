const {nativeImage} = require('electron');

async function readImage(data) {
  if(data.length>4*1024*1024)return null;
  // Check PNG dimensions before decoding highly compressed large textures.
  if(data.length>=24 && data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && data.readUInt32BE(16)*data.readUInt32BE(20)>16_000_000)return null;
  const image=nativeImage.createFromBuffer(data);
  if(image.isEmpty())return null;
  const size=image.getSize();
  if(size.width*size.height>16_000_000)return null;
  const bitmap=image.resize({width:64,height:64,quality:'good'}).toBitmap({scaleFactor:1});
  const histogram=new Map();
  let opaque=0;
  for(let i=0;i<bitmap.length;i+=4) {
    if(bitmap[i+3]<240)continue;
    opaque++;
    const quantize=value=>Math.min(255,Math.round(value/24)*24).toString(16).padStart(2,'0');
    const hex=('#'+quantize(bitmap[i+2])+quantize(bitmap[i+1])+quantize(bitmap[i])).toUpperCase();
    histogram.set(hex,(histogram.get(hex)||0)+1);
  }
  const colors=[...histogram].filter(([,count])=>count>=opaque*.04).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([hex])=>({hex}));
  const scale=Math.min(1,320/size.width,320/size.height);
  const thumbnail=image.resize({width:Math.max(1,Math.round(size.width*scale)),height:Math.max(1,Math.round(size.height*scale)),quality:'good'}).toDataURL();
  return {thumbnail,colors};
}
module.exports={readImage};
