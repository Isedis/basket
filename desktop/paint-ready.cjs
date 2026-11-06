// A JS-ready renderer is insufficient: verify an actual nonempty rendered frame.
async function verify(win){
  win.show();
  const deadline=Date.now()+10000;
  while(Date.now()<deadline){
    if(win.isDestroyed())throw new Error('Окно закрылось до проверки изображения.');
    const image=await win.webContents.capturePage(),size=image.getSize(),pixels=image.toBitmap(),colors=new Set();
    for(let y=40;y<size.height-20;y+=13)for(let x=20;x<size.width-20;x+=13){const offset=(y*size.width+x)*4;if(offset+2<pixels.length)colors.add(pixels.readUIntLE(offset,3));}
    if(win.isVisible()&&colors.size>5)return;
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  throw new Error('Интерфейс не отрисовался. Обновление будет отменено.');
}
module.exports={verify};
