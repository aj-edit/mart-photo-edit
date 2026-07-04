import { removeBackground } from "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.0/+esm";

const $=id=>document.getElementById(id);
const file=$("file"),pick=$("pick"),process=$("process"),status=$("status"),fill=$("fill"),orig=$("orig"),edit=$("edit"),final=$("final"),download=$("download"),info=$("info"),fname=$("fname");
const ectx=edit.getContext("2d",{willReadFrequently:true}),fctx=final.getContext("2d");
const move=$("move"),erase=$("erase"),restore=$("restore"),brush=$("brush"),box=$("box");
const zoom=$("zoom"),brushSize=$("brushSize"),zv=$("zv"),bv=$("bv"),br=$("br"),co=$("co"),sa=$("sa"),sh=$("sh"),brv=$("brv"),cov=$("cov"),sav=$("sav"),shv=$("shv");
const enh=$("enh"),shadow=$("shadow"),gridOn=$("gridOn");
const rl=$("rl"),rr=$("rr"),flip=$("flip"),center=$("center"),undo=$("undo"),redo=$("redo"),clear=$("clear"),reset=$("reset");
let srcImg=null,cutImg=null,finalBlob=null,selected=null,tool="move",shape="brush",down=false,last=null,stroke=null,boxStart=null,previewBox=null;
let st={rot:0,flip:false,zoom:1,x:0,y:0,brush:35};let edits=[],redoStack=[];


async function safeRemoveBackground(fileObj){
  const configs = [
    {
      debug:false,
      publicPath:"https://staticimgly.com/@imgly/background-removal-data/1.5.0/dist/",
      model:"medium",
      device:"gpu",
      output:{format:"image/png",quality:.95},
      progress:(k,c,t)=>setStatus("AI model load/background remove ho raha hai...",t?Math.min(70,15+Math.round(c/t*55)):35)
    },
    {
      debug:false,
      publicPath:"https://staticimgly.com/@imgly/background-removal-data/1.5.0/dist/",
      model:"small",
      device:"cpu",
      output:{format:"image/png",quality:.92},
      progress:(k,c,t)=>setStatus("Fallback AI mode chal raha hai...",t?Math.min(70,15+Math.round(c/t*55)):35)
    },
    {
      debug:false,
      publicPath:"https://cdn.jsdelivr.net/npm/@imgly/background-removal-data@1.5.0/dist/",
      model:"small",
      device:"cpu",
      output:{format:"image/png",quality:.92},
      progress:(k,c,t)=>setStatus("CDN fallback AI mode chal raha hai...",t?Math.min(70,15+Math.round(c/t*55)):35)
    }
  ];

  let lastError = null;
  for (const cfg of configs){
    try{
      return await removeBackground(fileObj, cfg);
    }catch(e){
      console.warn("AI config failed:", e);
      lastError = e;
    }
  }
  throw lastError || new Error("Background removal failed");
}

pick.onclick=()=>file.click();
file.onchange=()=>loadFile(file.files[0]);
document.getElementById("drop").ondragover=e=>{e.preventDefault();};
document.getElementById("drop").ondrop=e=>{e.preventDefault();loadFile(e.dataTransfer.files[0]);};

function setStatus(t,p){status.textContent=t;if(p!=null)fill.style.width=p+"%"}
function white(){ectx.fillStyle="#fff";ectx.fillRect(0,0,600,600);fctx.fillStyle="#fff";fctx.fillRect(0,0,400,400)}
function enable(v){[rl,rr,flip,center,zoom,brushSize,br,co,sa,sh,undo,redo,clear,reset].forEach(x=>x.disabled=!v)}
async function loadFile(f){if(!f||!f.type.startsWith("image/"))return alert("Image select karo");selected=f;srcImg=await imgFrom(f);cutImg=null;edits=[];redoStack=[];finalBlob=null;enable(false);download.disabled=true;orig.src=URL.createObjectURL(f);orig.style.display="block";fname.value=f.name.replace(/\.[^/.]+$/,"").replace(/[^a-zA-Z0-9-_ ]/g,"")||"product-photo-400x400";process.disabled=false;white();setStatus("Photo ready hai.",5)}
process.onclick=async()=>{try{process.disabled=true;setStatus("AI model load ho raha hai. First time time lag sakta hai...",15);let blob=await safeRemoveBackground(selected);cutImg=await imgFrom(blob);resetAll();enable(true);setTool("move");setShape("brush");await render();setStatus("Done. Edit/enhance karke download karo.",100)}catch(e){console.error(e);alert("AI model load fail hua. Page hard refresh karo (Ctrl+F5), Chrome/Edge use karo, aur internet on rakho. Agar phir bhi fail ho to browser cache clear karo.");setStatus("Error",0)}finally{process.disabled=false}}
function imgFrom(blob){return new Promise((res,rej)=>{let im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=URL.createObjectURL(blob)})}
function setTool(t){tool=t;[move,erase,restore].forEach(b=>b.classList.remove("active"));({move,erase,restore}[t]).classList.add("active");edit.style.cursor=t==="move"?"grab":"crosshair"}
function setShape(s){shape=s;[brush,box].forEach(b=>b.classList.remove("active"));({brush,box}[s]).classList.add("active")}
move.onclick=()=>setTool("move");erase.onclick=()=>setTool("erase");restore.onclick=()=>setTool("restore");brush.onclick=()=>setShape("brush");box.onclick=()=>setShape("box");

function drawLayer(ctx,img){let size=ctx.canvas.width,pad=size===600?42:28,base=Math.min((size-pad*2)/img.width,(size-pad*2)/img.height),sc=base*st.zoom,f=size/400,w=img.width*sc,h=img.height*sc;ctx.translate(size/2+st.x*f,size/2+st.y*f);ctx.rotate(st.rot*Math.PI/180);ctx.scale(st.flip?-1:1,1);ctx.drawImage(img,-w/2,-h/2,w,h)}
function composite(canvas,showGrid=false){let c=document.createElement("canvas"),ctx=c.getContext("2d");c.width=canvas.width;c.height=canvas.height;ctx.fillStyle="#fff";ctx.fillRect(0,0,c.width,c.height);if(cutImg){ctx.save();if(shadow.checked){ctx.shadowColor="rgba(0,0,0,.18)";ctx.shadowBlur=c.width===600?18:12;ctx.shadowOffsetY=c.width===600?10:7}drawLayer(ctx,cutImg);ctx.restore()}applyEdits(ctx,c);if(enh.checked)enhance(c);if(+sh.value>0)sharpen(c,+sh.value);if(showGrid&&gridOn.checked)grid(ctx,c.width);if(showGrid&&previewBox){let s=c.width/600;ctx.save();ctx.setLineDash([8,5]);ctx.strokeStyle="#111";ctx.lineWidth=2;ctx.strokeRect(previewBox.x*s,previewBox.y*s,previewBox.w*s,previewBox.h*s);ctx.restore()}return c}
function applyEdits(ctx,c){for(let ed of edits){let s=c.width/600;if(ed.shape==="box"){let{x,y,w,h}=ed.rect;x*=s;y*=s;w*=s;h*=s;if(ed.type==="erase"){ctx.fillStyle="#fff";ctx.fillRect(x,y,w,h)}else{let oc=document.createElement("canvas"),o=oc.getContext("2d");oc.width=c.width;oc.height=c.height;o.save();drawLayer(o,srcImg);o.restore();ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.drawImage(oc,0,0);ctx.restore()}continue}if(!ed.points)continue;if(ed.type==="erase"){ctx.save();ctx.strokeStyle="#fff";ctx.fillStyle="#fff";ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=ed.r*2*s;ctx.beginPath();ed.points.forEach((p,i)=>i?ctx.lineTo(p.x*s,p.y*s):ctx.moveTo(p.x*s,p.y*s));ctx.stroke();for(let p of ed.points){ctx.beginPath();ctx.arc(p.x*s,p.y*s,ed.r*s,0,Math.PI*2);ctx.fill()}ctx.restore()}else{let oc=document.createElement("canvas"),o=oc.getContext("2d");oc.width=c.width;oc.height=c.height;o.save();drawLayer(o,srcImg);o.restore();ctx.save();ctx.beginPath();ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=ed.r*2*s;ed.points.forEach((p,i)=>i?ctx.lineTo(p.x*s,p.y*s):ctx.moveTo(p.x*s,p.y*s));ctx.stroke();for(let p of ed.points){ctx.moveTo(p.x*s+ed.r*s,p.y*s);ctx.arc(p.x*s,p.y*s,ed.r*s,0,Math.PI*2)}ctx.clip();ctx.drawImage(oc,0,0);ctx.restore()}}}
function enhance(c){let ctx=c.getContext("2d"),im=ctx.getImageData(0,0,c.width,c.height),d=im.data,b=+br.value/100,cn=+co.value/100,sv=+sa.value/100;for(let i=0;i<d.length;i+=4){let r=((d[i]-128)*cn+128)*b,g=((d[i+1]-128)*cn+128)*b,bb=((d[i+2]-128)*cn+128)*b,gray=.299*r+.587*g+.114*bb;d[i]=cl(gray+(r-gray)*sv);d[i+1]=cl(gray+(g-gray)*sv);d[i+2]=cl(gray+(bb-gray)*sv)}ctx.putImageData(im,0,0)}
function sharpen(c,a){let ctx=c.getContext("2d"),src=ctx.getImageData(0,0,c.width,c.height),out=ctx.createImageData(src),w=c.width,h=c.height,d=src.data,o=out.data,A=a/100;for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){let idx=(y*w+x)*4;for(let ch=0;ch<3;ch++)o[idx+ch]=cl(d[idx+ch]*(1+4*A)-(d[idx-4+ch]+d[idx+4+ch]+d[idx-w*4+ch]+d[idx+w*4+ch])*A);o[idx+3]=d[idx+3]}ctx.putImageData(out,0,0)}
function cl(v){return Math.max(0,Math.min(255,Math.round(v)))}
function grid(ctx,size){ctx.save();ctx.strokeStyle="rgba(225,19,37,.28)";ctx.lineWidth=1;let m=size*.07;ctx.strokeRect(m,m,size-2*m,size-2*m);ctx.beginPath();ctx.moveTo(size/2,0);ctx.lineTo(size/2,size);ctx.moveTo(0,size/2);ctx.lineTo(size,size/2);ctx.stroke();ctx.restore()}
async function render(){if(!cutImg)return;let ec=composite(edit,true);ectx.clearRect(0,0,600,600);ectx.drawImage(ec,0,0);let fc=composite(final,false);fctx.clearRect(0,0,400,400);fctx.drawImage(fc,0,0);finalBlob=await jpegRange(final,190*1024,199*1024);info.textContent=`Ready: 400×400 JPG • ${(finalBlob.size/1024).toFixed(1)} KB`;download.disabled=false;undo.disabled=edits.length===0;redo.disabled=redoStack.length===0}
async function jpegRange(canvas,min,max){let low=.35,high=.98,best=await blob(canvas,.92);for(let i=0;i<12;i++){let q=(low+high)/2,b=await blob(canvas,q);if(b.size>max)high=q;else{best=b;if(b.size>=min)return b;low=q}}if(best.size<min){let target=Math.min(max-512,Math.max(min+1024,best.size)),pad=new Uint8Array(target-best.size);pad.fill(32);return new Blob([best,pad],{type:"image/jpeg"})}return best}
function blob(c,q){return new Promise(r=>c.toBlob(r,"image/jpeg",q))}
function pos(e){let r=edit.getBoundingClientRect();return{x:(e.clientX-r.left)*600/r.width,y:(e.clientY-r.top)*600/r.height}}
edit.onpointerdown=e=>{if(!cutImg)return;e.preventDefault();down=true;last=pos(e);edit.setPointerCapture(e.pointerId);if(tool!=="move"&&shape==="brush"){stroke={type:tool,shape:"brush",r:st.brush,points:[last]};edits.push(stroke);redoStack=[];render()}if(tool!=="move"&&shape==="box"){boxStart=last;previewBox={x:last.x,y:last.y,w:0,h:0};render()}};
edit.onpointermove=e=>{if(!down||!cutImg)return;e.preventDefault();let p=pos(e);if(tool==="move"){st.x+=(p.x-last.x)*400/600;st.y+=(p.y-last.y)*400/600;last=p;render()}else if(shape==="brush"&&stroke){let dx=p.x-last.x,dy=p.y-last.y,dist=Math.hypot(dx,dy),cnt=Math.max(1,Math.ceil(dist/Math.max(4,st.brush/3)));for(let i=1;i<=cnt;i++)stroke.points.push({x:last.x+dx*i/cnt,y:last.y+dy*i/cnt});last=p;render()}else if(shape==="box"&&boxStart){previewBox={x:Math.min(boxStart.x,p.x),y:Math.min(boxStart.y,p.y),w:Math.abs(p.x-boxStart.x),h:Math.abs(p.y-boxStart.y)};render()}};
function finish(){if(!down)return;if(tool!=="move"&&shape==="box"&&previewBox&&previewBox.w>3&&previewBox.h>3){edits.push({type:tool,shape:"box",rect:previewBox});redoStack=[]}down=false;last=null;stroke=null;boxStart=null;previewBox=null;render()}
edit.onpointerup=finish;edit.onpointercancel=finish;edit.onpointerleave=finish;
function resetAll(){st={rot:0,flip:false,zoom:1,x:0,y:0,brush:35};zoom.value=100;zv.textContent="100%";brushSize.value=35;bv.textContent="35px"}
rl.onclick=()=>{st.rot-=90;render()};rr.onclick=()=>{st.rot+=90;render()};flip.onclick=()=>{st.flip=!st.flip;render()};center.onclick=()=>{st.x=0;st.y=0;render()};reset.onclick=()=>{resetAll();edits=[];redoStack=[];render()};clear.onclick=()=>{edits=[];redoStack=[];render()};undo.onclick=()=>{if(edits.length){redoStack.push(edits.pop());render()}};redo.onclick=()=>{if(redoStack.length){edits.push(redoStack.pop());render()}};
zoom.oninput=()=>{st.zoom=+zoom.value/100;zv.textContent=zoom.value+"%";render()};brushSize.oninput=()=>{st.brush=+brushSize.value;bv.textContent=st.brush+"px"};
[enh,shadow,gridOn].forEach(x=>x.onchange=render);br.oninput=()=>{brv.textContent=br.value+"%";render()};co.oninput=()=>{cov.textContent=co.value+"%";render()};sa.oninput=()=>{sav.textContent=sa.value+"%";render()};sh.oninput=()=>{shv.textContent=sh.value;render()};
download.onclick=()=>{let a=document.createElement("a");a.href=URL.createObjectURL(finalBlob);let n=(fname.value||"product-photo-400x400").replace(/\.[^/.]+$/,"").replace(/[\\/:*?"<>|]/g,"").replace(/\s+/g,"-")||"product-photo-400x400";a.download=n+".jpg";document.body.appendChild(a);a.click();a.remove()};
white();
