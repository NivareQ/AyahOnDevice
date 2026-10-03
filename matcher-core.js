export function normalizeArabic(input = '', expandSmall = false) {
  let s = String(input || '');
  if (expandSmall) {
    s = s.replace(/ٰ/g, 'ا').replace(/[ۥ]/g, 'و').replace(/[ۦۧ]/g, 'ي');
  }
  return s
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/ـ/g, '')
    .replace(/[ٱأإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '')
    .replace(/ة/g, 'ه')
    .replace(/[^\u0621-\u063A\u0641-\u064A\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const OPENING_BASMILLAH_NORM = normalizeArabic('بسم الله الرحمن الرحيم', false);

function fnv1a3(a,b,c) {
  let h = 2166136261 >>> 0;
  h ^= a.charCodeAt(0); h = Math.imul(h, 16777619);
  h ^= b.charCodeAt(0); h = Math.imul(h, 16777619);
  h ^= c.charCodeAt(0); h = Math.imul(h, 16777619);
  return h >>> 0;
}

function gramHashes(s) {
  const compact = s.replace(/\s+/g, ' ');
  if (!compact) return new Uint32Array();
  if (compact.length < 3) {
    const h = compact.split('').reduce((acc,ch)=>Math.imul((acc ^ ch.charCodeAt(0))>>>0,16777619)>>>0,2166136261>>>0);
    return Uint32Array.of(h>>>0);
  }
  const arr = new Uint32Array(compact.length - 2);
  for (let i=0; i<compact.length-2; i++) arr[i] = fnv1a3(compact[i], compact[i+1], compact[i+2]);
  arr.sort();
  // de-duplicate compactly
  let w = 0, last = -1;
  for (let i=0; i<arr.length; i++) {
    if (i === 0 || arr[i] !== last) arr[w++] = arr[i];
    last = arr[i];
  }
  return arr.slice(0,w);
}

function sortedIntersectionCount(a,b) {
  let i=0,j=0,n=0;
  while(i<a.length && j<b.length){
    if(a[i]===b[j]){n++;i++;j++;}
    else if(a[i]<b[j]) i++; else j++;
  }
  return n;
}

function levenshtein(a,b) {
  if (a===b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (a.length > b.length) [a,b] = [b,a];
  const prev = new Uint16Array(a.length+1);
  const curr = new Uint16Array(a.length+1);
  for(let i=0;i<=a.length;i++) prev[i]=i;
  for(let j=1;j<=b.length;j++){
    curr[0]=j;
    const bj=b.charCodeAt(j-1);
    for(let i=1;i<=a.length;i++){
      const cost = a.charCodeAt(i-1)===bj ? 0 : 1;
      curr[i]=Math.min(curr[i-1]+1, prev[i]+1, prev[i-1]+cost);
    }
    prev.set(curr);
  }
  return prev[a.length];
}

function levSimilarity(a,b){
  const m=Math.max(a.length,b.length);
  return m ? 1 - levenshtein(a,b)/m : 1;
}

function tokenDice(a,b){
  const A=new Set(a.split(' ').filter(Boolean));
  const B=new Set(b.split(' ').filter(Boolean));
  if(!A.size || !B.size) return 0;
  let i=0; for(const x of A) if(B.has(x)) i++;
  return (2*i)/(A.size+B.size);
}

function bestLocalSimilarity(query, candidate) {
  if (!query || !candidate) return 0;
  if (candidate.includes(query) || query.includes(candidate)) {
    const shorter = Math.min(query.length,candidate.length);
    const longer = Math.max(query.length,candidate.length);
    return Math.min(1, 0.94 + 0.06 * (shorter/longer));
  }
  const qTokens=query.split(' ').filter(Boolean);
  const cTokens=candidate.split(' ').filter(Boolean);
  const qn=qTokens.length;
  let best=0;
  if (qn && cTokens.length > qn) {
    for (let size=Math.max(1,qn-1); size<=Math.min(cTokens.length,qn+2); size++) {
      for (let start=0; start+size<=cTokens.length; start++) {
        const seg=cTokens.slice(start,start+size).join(' ');
        const ls=levSimilarity(query,seg);
        const td=tokenDice(query,seg);
        const score=0.72*ls+0.28*td;
        if(score>best) best=score;
      }
    }
  } else {
    best=0.72*levSimilarity(query,candidate)+0.28*tokenDice(query,candidate);
  }
  return best;
}

export function buildMatcher(corpus) {
  const flat = corpus.flat;
  const byKey = new Map(flat.map(v=>[`${v.s}:${v.a}`,v]));
  const surahs = new Map(corpus.surahs.map(s=>[s.number,s]));
  const fullVerseVariants=new Set();for(const v of flat)for(const x of [v.n,v.ny,v.nx])if(x)fullVerseVariants.add(x);
  const candidates=[];

  const verseVariants = v => Array.from(new Set([v.n, v.ny || v.n, v.nx || v.n].filter(Boolean)));
  const verseOccurrence = (v, score=1) => {
    const meta=surahs.get(v.s);
    return {s:v.s,a:v.a,a1:v.a,a2:v.a,score,surah_ar:meta.name_ar,surah_en:meta.name_en,verses:[v]};
  };
  function bestAnchorForCandidate(candidate, qvars) {
    if(!candidate) return null;
    let anchor=null, anchorScore=-1;
    for(const v of candidate.verses || []){
      let local=0;
      for(const qv of qvars) for(const vv of verseVariants(v)) local=Math.max(local,bestLocalSimilarity(qv,vv));
      if(local>anchorScore){anchor=v;anchorScore=local;}
    }
    return anchor;
  }

  function canonicalVerseSignature(v) {
    return v?.n || '';
  }

  function duplicateOccurrences(anchor, score=1) {
    if(!anchor) return [];
    const sig=canonicalVerseSignature(anchor);
    if(!sig) return [verseOccurrence(anchor,score)];
    const dup=[];
    for(const v of flat){
      if(canonicalVerseSignature(v)===sig) dup.push(verseOccurrence(v,score));
    }
    return dup.length ? dup : [verseOccurrence(anchor,score)];
  }

  function locusCandidate(s,a1,a2,score=1) {
    const meta=surahs.get(s),verses=[];
    for(let a=a1;a<=a2;a++){const v=byKey.get(`${s}:${a}`);if(v)verses.push(v);}
    return {s,a1,a2,score,surah_ar:meta?.name_ar||'',surah_en:meta?.name_en||'',verses};
  }

  function minimalExactLocations(matched) {
    const minimal=matched.filter(c=>!matched.some(o=>o!==c&&o.s===c.s&&o.a1>=c.a1&&o.a2<=c.a2&&(o.a2-o.a1)<(c.a2-c.a1)));
    const out=new Map();
    for(const c of minimal){const key=`${c.s}:${c.a1}-${c.a2}`;if(!out.has(key))out.set(key,locusCandidate(c.s,c.a1,c.a2,1));}
    return [...out.values()].sort((a,b)=>a.s-b.s||a.a1-b.a1||a.a2-b.a2);
  }

  function buildPresentation(qvars, qgrams, qTokens, ranked) {
    if(!ranked.length) return {topGroups:[],alternatives:[],occurrences:[]};
    const topScore=ranked[0].score;
    const EPS=1e-12;
    const topGroups=[];
    const seenTopSignatures=new Set();

    // Every candidate tied at the exact highest score is a legitimate primary
    // interpretation. Identical repeated ayat collapse into one group whose
    // occurrence list is scanned across the entire canonical Quran corpus.
    for(const r of ranked){
      if(Math.abs(r.score-topScore)>EPS) break;
      const anchor=bestAnchorForCandidate(r,qvars);
      const signature=canonicalVerseSignature(anchor) || `${r.s}:${r.a1}-${r.a2}`;
      if(seenTopSignatures.has(signature)) continue;
      seenTopSignatures.add(signature);
      topGroups.push({score:r.score,candidate:r,anchor:anchor?verseOccurrence(anchor,r.score):null,occurrences:duplicateOccurrences(anchor,r.score),interpretationKey:signature});
    }

    // Keep exactly the next four STRICTLY lower-scoring distinct candidates.
    // Repeated instances of a top-group ayah are not repeated as alternatives.
    const alternatives=[];
    const addAlternative = r => {
      if(!(r.score < topScore-EPS)) return false;
      const anchor=bestAnchorForCandidate(r,qvars);
      const signature=canonicalVerseSignature(anchor) || `${r.s}:${r.a1}-${r.a2}`;
      if(seenTopSignatures.has(signature)) return false;
      const duplicate=alternatives.some(x=>x.s===r.s && Math.abs(x.a1-r.a1)<=1 && Math.abs(x.a2-r.a2)<=1);
      if(duplicate) return false;
      alternatives.push({...r,interpretationKey:signature,interpretationAnchor:anchor?verseOccurrence(anchor,r.score):null,interpretationOccurrences:duplicateOccurrences(anchor,r.score)}); return true;
    };
    for(const r of ranked){addAlternative(r);if(alternatives.length>=4) break;}

    // Repeated verses can dominate the normal prefilter (for example the 31
    // repetitions in Ar-Rahman). If that leaves fewer than four lower-score
    // alternatives, do a small SECONDARY prefilter that explicitly excludes
    // every candidate containing a top-group ayah signature. This preserves
    // the main ranking while still giving the user four genuinely distinct
    // fallback ayah candidates beneath the repeated top result.
    if(alternatives.length<4){
      const extra=[]; const EXTRA_MAX=36;
      for(let i=0;i<candidates.length;i++){
        const c=candidates[i]; let containsTop=false;
        for(let a=c.a1;a<=c.a2;a++){
          const v=byKey.get(`${c.s}:${a}`);
          if(v && seenTopSignatures.has(canonicalVerseSignature(v))){containsTop=true;break;}
        }
        if(containsTop) continue;
        let bestRecall=0,bestPrecision=0;
        for(const qg of qgrams){
          for(const cg of [c.grams,c.gramsX]){
            const inter=sortedIntersectionCount(qg,cg);
            const recall=qg.length?inter/qg.length:0,precision=cg.length?inter/cg.length:0;
            if(recall+precision>bestRecall+bestPrecision){bestRecall=recall;bestPrecision=precision;}
          }
        }
        const lenRatio=Math.min(qTokens,c.tokenCount)/Math.max(qTokens,c.tokenCount);
        const rough=0.68*bestRecall+0.24*bestPrecision+0.08*lenRatio;
        if(extra.length<EXTRA_MAX){extra.push({i,rough});if(extra.length===EXTRA_MAX)extra.sort((a,b)=>a.rough-b.rough);}
        else if(rough>extra[0].rough){extra[0]={i,rough};let p=0;while(p+1<extra.length&&extra[p].rough>extra[p+1].rough){const t=extra[p];extra[p]=extra[p+1];extra[p+1]=t;p++;}}
      }
      const rescoredExtra=extra.map(({i,rough})=>{
        const c=candidates[i];let local=0;
        for(const qv of qvars)local=Math.max(local,bestLocalSimilarity(qv,c.n),bestLocalSimilarity(qv,c.ny),bestLocalSimilarity(qv,c.nx));
        const score=Math.min(1,0.18*Math.min(1,rough)+0.82*local),meta=surahs.get(c.s),verses=[];
        for(let a=c.a1;a<=c.a2;a++)verses.push(byKey.get(`${c.s}:${a}`));
        return{s:c.s,a1:c.a1,a2:c.a2,score,surah_ar:meta.name_ar,surah_en:meta.name_en,verses};
      }).sort((a,b)=>b.score-a.score);
      for(const r of rescoredExtra){addAlternative(r);if(alternatives.length>=4)break;}
    }

    // Legacy compatibility: a single top group's occurrence list is also
    // exposed at `occurrences`, but it is no longer confidence-gated.
    const occurrences=topGroups.length===1 ? topGroups[0].occurrences : [];
    return {topGroups,alternatives,occurrences};
  }

  for (let i=0; i<flat.length; i++) {
    const v=flat[i];
    let combined='';
    let combinedY='';
    let combinedX='';
    let endA=v.a;
    for(let len=1; len<=3; len++){
      const k=i+len-1;
      if(k>=flat.length || flat[k].s!==v.s) break;
      combined = combined ? `${combined} ${flat[k].n}` : flat[k].n;
      combinedY = combinedY ? `${combinedY} ${flat[k].ny || flat[k].n}` : (flat[k].ny || flat[k].n);
      combinedX = combinedX ? `${combinedX} ${flat[k].nx || flat[k].n}` : (flat[k].nx || flat[k].n);
      endA=flat[k].a;
      candidates.push({
        s:v.s, a1:v.a, a2:endA, n:combined, ny:combinedY, nx:combinedX,
        grams:gramHashes(combined), gramsX:gramHashes(combinedX),
        tokenCount:combined.split(' ').length,
      });
    }
  }

  function search(raw, limit=5) {
    const t0=performance.now();
    let q=normalizeArabic(raw,false);
    let qx=normalizeArabic(raw,true);
    if(!q) return {query:q,ms:performance.now()-t0,results:[],topGroups:[],alternatives:[],occurrences:[]};

    // The opening Bismillah is deliberately not an identification target.
    // It appears before nearly every surah, so standalone recitation is
    // intentionally treated as ambiguous. If it precedes additional words,
    // only that leading opening phrase is removed from the SEARCH QUERY; the
    // ASR transcript shown to the user is never rewritten.
    let leadingBismillahStripped=false;
    const qWords=q.split(' ').filter(Boolean);
    // Prefer recognizing an opening Bismillah + continuation before applying
    // the standalone suppression rule, so "Bismillah ... Alif Lam Mim" still
    // identifies the meaningful continuation.
    if(qWords.length>=5){
      const prefix=qWords.slice(0,4).join(' ');
      if(bestLocalSimilarity(prefix,OPENING_BASMILLAH_NORM)>=0.82){
        q=qWords.slice(4).join(' ');
        const xWords=qx.split(' ').filter(Boolean);
        qx=(xWords.length>=5?xWords.slice(4).join(' '):normalizeArabic(q,true));
        leadingBismillahStripped=true;
      }
    }
    if(!leadingBismillahStripped){
      // Compare against the WHOLE opening Bismillah. A local-substring score
      // falsely suppresses legitimate short Quran input such as حم and الر
      // merely because those letters occur inside الرحمن / الرحيم.
      const bismillahOnlyScore=0.72*levSimilarity(q,OPENING_BASMILLAH_NORM)+0.28*tokenDice(q,OPENING_BASMILLAH_NORM);
      if(qWords.length<=5 && bismillahOnlyScore>=0.80){
        return {query:q,ms:performance.now()-t0,results:[],topGroups:[],alternatives:[],occurrences:[],bismillahOnly:true,openingBismillahScore:bismillahOnlyScore};
      }
    }
    if(!q) return {query:q,ms:performance.now()-t0,results:[],topGroups:[],alternatives:[],occurrences:[],bismillahOnly:true};

    // الر is not a standalone complete ayah. It is the exact disjointed-letter
    // opening of five longer first ayat (10:1, 11:1, 12:1, 14:1, 15:1). The
    // normalized letters also occur at the start of ordinary words such as
    // الرحمن, so generic fuzzy/substring ranking cannot represent this short
    // input truthfully. Return the five canonical opening locations as a
    // bounded ambiguity; reciting additional words falls through to the normal
    // matcher and identifies the specific ayah.
    if(q==='الر'){
      const refs=[[10,1],[11,1],[12,1],[14,1],[15,1]];
      const sharedOpeningMatches=refs.map(([s,a])=>locusCandidate(s,a,a,1));
      return {query:q,ms:performance.now()-t0,results:sharedOpeningMatches,topGroups:[],alternatives:[],occurrences:[],sharedOpening:true,sharedOpeningMatches,exactLocations:sharedOpeningMatches,exactQuery:q,leadingBismillahStripped};
    }

    const qvars = qx && qx!==q ? [q,qx] : [q];
    const strictQvars=qvars.filter(v=>v.includes(' '));
    const queryIsFullVerse=qvars.some(v=>fullVerseVariants.has(v));
    const qgrams = qvars.map(gramHashes);
    const qTokens=q.split(' ').length;

    // Fast exact-substring path: common for keyboard dictation and good ASR output.
    const exact=[];
    const exactLocusCandidates=[];
    for (const c of candidates) {
      const strictExact=!queryIsFullVerse&&strictQvars.some(v=>[c.n,c.ny,c.nx].some(text=>` ${text} `.includes(` ${v} `)));
      if(strictExact) exactLocusCandidates.push(c);
      if (qvars.some(v => c.n.includes(v) || c.ny.includes(v) || c.nx.includes(v))) {
        const sMeta=surahs.get(c.s);
        const verses=[]; for(let a=c.a1;a<=c.a2;a++) verses.push(byKey.get(`${c.s}:${a}`));
        const matchedLen=Math.min(c.n.length,c.ny.length,c.nx.length);
        const ratio=q.length/matchedLen;
        exact.push({s:c.s,a1:c.a1,a2:c.a2,score:Math.min(1,0.96+0.04*ratio),surah_ar:sMeta.name_ar,surah_en:sMeta.name_en,verses});
      }
    }
    if (exact.length) {
      exact.sort((a,b)=>b.score-a.score || (a.a2-a.a1)-(b.a2-b.a1));
      const results=[];
      for(const r of exact){
        const duplicate=results.some(x=>x.s===r.s && x.a1===r.a1 && x.a2===r.a2);
        if(!duplicate) results.push(r);
        if(results.length>=limit) break;
      }
      const presentation=buildPresentation(qvars,qgrams,qTokens,results);
      const exactLocations=minimalExactLocations(exactLocusCandidates);
      return {query:q,ms:performance.now()-t0,results,...presentation,exactLocations,exactQuery:q,leadingBismillahStripped};
    }

    const prelim=[];
    const PRELIM_MAX=140;
    for(let i=0;i<candidates.length;i++){
      const c=candidates[i];
      let bestRecall=0, bestPrecision=0;
      for (const qg of qgrams) {
        for (const cg of [c.grams,c.gramsX]) {
          const inter=sortedIntersectionCount(qg,cg);
          const recall=qg.length ? inter/qg.length : 0;
          const precision=cg.length ? inter/cg.length : 0;
          if (recall + precision > bestRecall + bestPrecision) { bestRecall=recall; bestPrecision=precision; }
        }
      }
      const lenRatio=Math.min(qTokens,c.tokenCount)/Math.max(qTokens,c.tokenCount);
      const rough=0.68*bestRecall + 0.24*bestPrecision + 0.08*lenRatio;
      if(prelim.length<PRELIM_MAX) {
        prelim.push({i,rough});
        if(prelim.length===PRELIM_MAX) prelim.sort((a,b)=>a.rough-b.rough);
      } else if(rough>prelim[0].rough) {
        prelim[0]={i,rough};
        // insertion sort first item upward enough; cheap at 140 items
        let p=0;
        while(p+1<prelim.length && prelim[p].rough>prelim[p+1].rough){
          const tmp=prelim[p]; prelim[p]=prelim[p+1]; prelim[p+1]=tmp; p++;
        }
      }
    }

    const rescored=prelim.map(({i,rough})=>{
      const c=candidates[i];
      let local=0;
      for(const qv of qvars) local=Math.max(local,bestLocalSimilarity(qv,c.n),bestLocalSimilarity(qv,c.ny),bestLocalSimilarity(qv,c.nx));
      const score=Math.min(1, 0.18*Math.min(1,rough)+0.82*local);
      const sMeta=surahs.get(c.s);
      const verses=[];
      for(let a=c.a1;a<=c.a2;a++) verses.push(byKey.get(`${c.s}:${a}`));
      return {
        s:c.s,a1:c.a1,a2:c.a2,score,
        surah_ar:sMeta.name_ar,surah_en:sMeta.name_en,
        verses,
      };
    }).sort((a,b)=>b.score-a.score);

    // Deduplicate near-identical overlapping ranges: keep strongest distinct references.
    const results=[];
    for(const r of rescored){
      const duplicate=results.some(x=>x.s===r.s && Math.abs(x.a1-r.a1)<=1 && Math.abs(x.a2-r.a2)<=1);
      if(!duplicate) results.push(r);
      if(results.length>=limit) break;
    }
    const presentation=buildPresentation(qvars,qgrams,qTokens,results);
    return {query:q,ms:performance.now()-t0,results,...presentation,exactLocations:[],exactQuery:q,leadingBismillahStripped};
  }

  function getContext(s,a1,a2){
    const surah=surahs.get(s);
    const min=Math.max(1,a1-1), max=Math.min(surah.ayahs.length,a2+1);
    return surah.ayahs.filter(v=>v.a>=min&&v.a<=max);
  }

  function seeded(seed){
    let x=seed>>>0;
    return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296};
  }
  function corrupt(text, rng){
    const toks=normalizeArabic(text).split(' ').filter(Boolean);
    if(toks.length>4 && rng()<0.8) toks.splice(Math.floor(rng()*toks.length),1);
    if(toks.length>3 && rng()<0.6) toks.splice(0,Math.floor(rng()*Math.min(2,toks.length-2)));
    if(toks.length>4 && rng()<0.5) toks.splice(Math.max(2,toks.length-1),1);
    if(toks.length && rng()<0.7){
      const i=Math.floor(rng()*toks.length); const w=toks[i];
      if(w.length>2){ const p=Math.floor(rng()*w.length); toks[i]=w.slice(0,p)+w.slice(p+1); }
    }
    return toks.join(' ');
  }

  function torture(iterations=500, seed=137){
    const rng=seeded(seed); const samples=[]; let top1=0,top3=0; const t0=performance.now();
    for(let k=0;k<iterations;k++){
      const target=flat[Math.floor(rng()*flat.length)];
      const q=corrupt(target.ar,rng);
      const out=search(q,3);
      const hit1=out.results[0]?.s===target.s && out.results[0]?.a1<=target.a && out.results[0]?.a2>=target.a;
      const hit3=out.results.some(r=>r.s===target.s && r.a1<=target.a && r.a2>=target.a);
      if(hit1) top1++; if(hit3) top3++;
      if(samples.length<8 || (!hit1 && samples.length<16)) samples.push({target:`${target.s}:${target.a}`,q,hit1,top:out.results[0] ? `${out.results[0].s}:${out.results[0].a1}${out.results[0].a2!==out.results[0].a1?'-'+out.results[0].a2:''}` : 'none',score:out.results[0]?.score||0});
    }
    return {iterations,top1,top3,top1Rate:top1/iterations,top3Rate:top3/iterations,ms:performance.now()-t0,samples};
  }

  return {search,getContext,torture,candidateCount:candidates.length,verseCount:flat.length};
}
