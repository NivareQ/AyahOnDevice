import { buildMatcher } from './matcher-core.js';
let matcher=null;
async function init(){
  const t0=performance.now();
  const res=await fetch('./data/matcher.json');
  if(!res.ok) throw new Error(`Quran corpus load failed: ${res.status}`);
  const corpus=await res.json();
  matcher=buildMatcher(corpus);
  postMessage({type:'ready',ms:performance.now()-t0,verseCount:matcher.verseCount,candidateCount:matcher.candidateCount,metadata:corpus.metadata});
}
const initPromise=init();
self.onmessage=async(e)=>{
  const m=e.data;
  try{
    if(!matcher) await initPromise;
    if(m.type==='search') postMessage({type:'search-result',id:m.id,...matcher.search(m.text,m.limit||5)});
    else if(m.type==='context') postMessage({type:'context-result',id:m.id,context:matcher.getContext(m.s,m.a1,m.a2)});
    else if(m.type==='torture') postMessage({type:'torture-result',id:m.id,...matcher.torture(m.iterations||500,m.seed||137)});
  }catch(err){postMessage({type:'error',id:m.id,message:err?.stack||String(err)});}
};
initPromise.catch(err=>postMessage({type:'error',message:err?.stack||String(err)}));
