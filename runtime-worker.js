/* AyahOnDevice local inference worker.
   No pthreads. Inference stays off the UI thread. */
var Module = null;
let instance = 0;
let runtimeReady = false;
let runtimePromiseResolve = null;
let currentLines = [];
const MODEL_PATH = 'ayah-model.bin';
const MODEL_CACHE = 'ayah-finder-models-v1';

function post(type, data={}) { self.postMessage({type, ...data}); }
function emit(kind, text) {
  const line=String(text??'');
  currentLines.push({kind,line,at:performance.now()});
  if(currentLines.length>4000) currentLines.splice(0,1000);
  post('line',{kind,line});
}
function maybeAwait(v){return v&&typeof v.then==='function'?v:Promise.resolve(v);}

async function probeWebGPU(){
  if(!self.navigator?.gpu) return {available:false,reason:'WebGPU unavailable'};
  try{
    const adapter=await self.navigator.gpu.requestAdapter({powerPreference:'high-performance'});
    if(!adapter) return {available:false,reason:'No WebGPU adapter'};
    const l=adapter.limits||{}, i=adapter.info||{};
    return {available:true,info:{vendor:i.vendor||'',architecture:i.architecture||'',device:i.device||'',description:i.description||''},limits:{maxBufferSize:Number(l.maxBufferSize||0),maxStorageBufferBindingSize:Number(l.maxStorageBufferBindingSize||0)}};
  }catch(e){return {available:false,reason:e?.message||String(e)};}
}

function parseHeader(bytes){
  if(bytes.byteLength<48) throw new Error('Model file is too small.');
  const v=new DataView(bytes.buffer,bytes.byteOffset,Math.min(bytes.byteLength,64));
  const g=i=>v.getInt32(i*4,true);
  const h={magic:g(0)>>>0,n_vocab:g(1),n_audio_ctx:g(2),n_audio_state:g(3),n_audio_head:g(4),n_audio_layer:g(5),n_text_ctx:g(6),n_text_state:g(7),n_text_head:g(8),n_text_layer:g(9),n_mels:g(10),ftype:g(11)};
  if(h.magic!==0x67676d6c) throw new Error(`Not a supported Whisper GGML model (magic 0x${h.magic.toString(16)}).`);
  if(h.n_text_ctx!==448) throw new Error(`Unsupported decoder context ${h.n_text_ctx}.`);
  if(h.n_audio_state===512&&h.n_audio_layer===6&&h.n_mels===80) h.arch='Whisper Base';
  else if(h.n_audio_state===1280&&h.n_audio_layer===32&&h.n_text_layer===4&&h.n_mels===128) h.arch='Whisper Large-v3-Turbo';
  else throw new Error('Model architecture is not one of AyahOnDevice’s supported Whisper Base / Large-v3-Turbo families.');
  return h;
}

async function initRuntime(msg){
  currentLines=[];
  if(msg.backend==='webgpu'){
    const gpu=await probeWebGPU(); post('gpuProbe',{gpu});
    if(!gpu.available) throw new Error(gpu.reason||'WebGPU unavailable.');
  }
  const abs=new URL(msg.runtimeUrl,self.location.href).href;
  Module=self.Module={
    print:t=>emit('out',t), printErr:t=>emit('err',t), setStatus:t=>emit('status',t),
    monitorRunDependencies:left=>left&&emit('deps',`run dependencies: ${left}`),
    onRuntimeInitialized(){runtimeReady=true;emit('runtime','Local inference runtime ready');runtimePromiseResolve?.();}
  };
  self.importScripts(abs);
  if(!runtimeReady){
    await new Promise((resolve,reject)=>{runtimePromiseResolve=resolve;setTimeout(()=>reject(new Error('Inference runtime initialization timed out.')),120000);});
  }
  post('runtimeReady',{backend:msg.backend});
}

async function bytesFromUrl(url){
  post('modelProgress',{stage:'download',received:0,total:0});
  const cache=await caches.open(MODEL_CACHE);
  let r=await cache.match(url);
  let cached=!!r;
  if(!r){
    r=await fetch(url,{mode:'cors',credentials:'omit',cache:'no-store'});
    if(!r.ok) throw new Error(`Model download HTTP ${r.status}.`);
    try{await cache.put(url,r.clone());}catch(e){emit('err',`Model cache warning: ${e.message}`);}
  }
  const total=Number(r.headers.get('content-length'))||0;
  if(!r.body){const b=new Uint8Array(await r.arrayBuffer());post('modelProgress',{stage:cached?'cache':'download',received:b.byteLength,total:b.byteLength,cached});return b;}
  const rd=r.body.getReader();let received=0,chunks=[];
  for(;;){const {done,value}=await rd.read();if(done)break;chunks.push(value);received+=value.byteLength;post('modelProgress',{stage:cached?'cache':'download',received,total,cached});}
  const out=new Uint8Array(received);let off=0;for(const c of chunks){out.set(c,off);off+=c.length;}return out;
}
async function bytesFromFile(file){
  post('modelProgress',{stage:'file',received:0,total:file.size});
  const b=new Uint8Array(await file.arrayBuffer());
  post('modelProgress',{stage:'file',received:b.byteLength,total:b.byteLength});return b;
}

async function loadModel(msg){
  if(!runtimeReady) throw new Error('Inference engine is not ready.');
  if(instance){try{self.Module.free(instance);}catch{}instance=0;}
  const t0=performance.now();
  let bytes=msg.source==='file'?await bytesFromFile(msg.file):await bytesFromUrl(msg.url);
  if(msg.expectedSha){
    emit('runtime','Verifying pinned model SHA-256…');
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    const actual=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
    if(actual.toLowerCase()!==String(msg.expectedSha).toLowerCase()) throw new Error(`Model SHA-256 mismatch. Expected ${msg.expectedSha}, got ${actual}.`);
    emit('runtime','Pinned model SHA-256 verified.');
  }
  const header=parseHeader(bytes);post('modelHeader',{header,bytes:bytes.byteLength});
  try{self.Module.FS_unlink('/'+MODEL_PATH);}catch{}
  self.Module.FS_createDataFile('/',MODEL_PATH,bytes,true,true,true);bytes=null;
  const idx=await maybeAwait(self.Module.init(MODEL_PATH));
  if(!idx) throw new Error('Whisper could not initialize this model.');
  instance=Number(idx);
  try{self.Module.FS_unlink('/'+MODEL_PATH);}catch{}
  post('modelReady',{instance,ms:performance.now()-t0,header});
}
function transcriptFrom(lines){
  const seg=[];for(const x of lines){const m=x.line.match(/^\s*\[[0-9:.]+\s*-->\s*[0-9:.]+\]\s*(.+?)\s*$/);if(m)seg.push(m[1]);}
  return seg.join(' ').replace(/\s+/g,' ').trim();
}
async function infer(msg){
  if(!instance) throw new Error('Local AI model is not loaded.');
  const audio=msg.audio instanceof Float32Array?msg.audio:new Float32Array(msg.audio);
  currentLines=[];const t0=performance.now();
  post('phase',{phase:'inference',seconds:audio.length/16000});
  const ret=await maybeAwait(self.Module.full_default(instance,audio,'ar',1,false));
  const ms=performance.now()-t0;
  post('inferenceDone',{ret:Number(ret),ms,seconds:audio.length/16000,transcript:transcriptFrom(currentLines)});
}

self.onmessage=async e=>{
  const msg=e.data||{};
  try{
    if(msg.cmd==='init') await initRuntime(msg);
    else if(msg.cmd==='loadModel') await loadModel(msg);
    else if(msg.cmd==='infer') await infer(msg);
    else if(msg.cmd==='probeWebGPU') post('gpuProbe',{gpu:await probeWebGPU()});
  }catch(err){post('error',{cmd:msg.cmd,message:err?.message||String(err),stack:err?.stack||''});}
};
