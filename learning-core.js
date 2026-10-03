function fnv1a(text=''){
  let h=2166136261>>>0;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
  return (h>>>0).toString(16).padStart(8,'0');
}
function grams3(s=''){
  const x=String(s||'').replace(/\s+/g,' ').trim();
  if(!x)return new Set();
  if(x.length<3)return new Set([x]);
  const out=new Set();for(let i=0;i<=x.length-3;i++)out.add(x.slice(i,i+3));return out;
}
function diceSets(A,B){if(!A.size||!B.size)return 0;let n=0;for(const x of A)if(B.has(x))n++;return 2*n/(A.size+B.size);}
function tokenSet(s=''){return new Set(String(s||'').split(' ').filter(Boolean));}
export function learningQuerySimilarity(a='',b=''){
  a=String(a||'').trim();b=String(b||'').trim();if(!a||!b)return 0;if(a===b)return 1;
  const charDice=diceSets(grams3(a),grams3(b)),tokenDice=diceSets(tokenSet(a),tokenSet(b));
  const len=Math.min(a.length,b.length)/Math.max(a.length,b.length);
  return Math.max(0,Math.min(1,0.58*charDice+0.30*tokenDice+0.12*len));
}
export function learningFingerprintId(queryNorm,targetKey){return `lrn-${fnv1a(`${String(queryNorm||'')}|${String(targetKey||'')}`)}`;}
export function confirmationStrength(count=1){const n=Math.max(1,Math.min(4,Number(count)||1));return [0,0.018,0.030,0.042,0.052][n];}
export function learningBonus(records=[],queryNorm='',targetKey='',{blocked=false,minSimilarity=0.74}={}){
  if(blocked||!queryNorm||!targetKey)return 0;
  const values=[];
  for(const r of records||[]){if(r?.targetKey!==targetKey)continue;const sim=learningQuerySimilarity(queryNorm,r.queryNorm||'');if(sim<minSimilarity)continue;values.push(sim*confirmationStrength(r.confirmations));}
  values.sort((a,b)=>b-a);let total=0;for(let i=0;i<Math.min(3,values.length);i++)total+=values[i]*(i===0?1:i===1?0.35:0.18);
  return Math.min(0.052,total);
}
export function personalizeItems(items=[],records=[],queryNorm='',{blocked=false}={}){
  const seen=new Set();const enriched=items.map((item,index)=>{const duplicateTarget=seen.has(item.targetKey);seen.add(item.targetKey);const bonus=duplicateTarget?0:learningBonus(records,queryNorm,item.targetKey,{blocked});return{...item,rawIndex:index,duplicateTarget,bonus,personalizedScore:(Number(item.rawScore)||0)+bonus};});
  if(blocked)return{items:enriched,applied:false,reordered:false};
  const sorted=[...enriched].sort((a,b)=>b.personalizedScore-a.personalizedScore||b.rawScore-a.rawScore||a.rawIndex-b.rawIndex);
  const applied=sorted.some(x=>x.bonus>0),reordered=sorted.some((x,i)=>x.rawIndex!==i);
  return{items:sorted,applied,reordered};
}
export function isLearningEligible(queryNorm='',{coValidExact=false,sharedOpening=false}={}){
  const q=String(queryNorm||'').trim();return !!q && q.length>=4 && !coValidExact && !sharedOpening;
}
