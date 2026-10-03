import {normalizeArabic} from './matcher-core.js';
import {personalStore,deletePersonalDatabase} from './personal-store.js';
import {t,setLocale,applyI18n} from './i18n.js';
import {learningFingerprintId,personalizeItems,isLearningEligible} from './learning-core.js';
const BASE_MODEL={
  id:'quran-base-q8',
  label:'Quran Base Q8',
  url:'https://huggingface.co/sadrapp/whisper-base-ar-quran-ggml/resolve/fa7a13981ff68f2a1af37a33e2c35e1238d922d5/ggml-model-q8_0.bin?download=true',
  sha:'72194195f7d280adebec57acf2c6e01e209484322ec1cec21c275a3c0b1e3d77'
};
const BUILD_ID='v2.0 Stable';
const SHELL_CACHE='ayahondevice-shell-v2.0-stable';
const MODEL_CACHE='ayah-finder-models-v1';
const BASE_VERIFIED_KEY='ayah.baseVerifiedSha';
const PERSONAL_BACKUP_FORMAT='NivareQ AyahOnDevice Personal Backup';
const LEGACY_PERSONAL_BACKUP_FORMAT='NivareQ Ayah Finder Personal Backup';
const PERSONAL_BACKUP_VERSION=2;
const PERSONAL_BACKUP_SCHEMA='ayahondevice.personal.v2';
const BASMILLAH_NORM='بسم الله الرحمن الرحيم';
const INDOPAK_OPENING_BASMILLAH='بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ';
function alignedIndoPakRows(rows,s){
  if(Number(s)!==1||!Array.isArray(rows)||rows.length!==7)return rows;
  const r=rows;
  return [
    {...r[0],verse:1,text:INDOPAK_OPENING_BASMILLAH},
    {...r[0],verse:2,text:r[0].text},
    {...r[1],verse:3,text:r[1].text},
    {...r[2],verse:4,text:r[2].text},
    {...r[3],verse:5,text:r[3].text},
    {...r[4],verse:6,text:r[4].text},
    {...r[5],verse:7,text:`${r[5].text} ${r[6].text}`.trim()}
  ];
}
function normalizeForBasmillah(s=''){
  return String(s).normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g,'')
    .replace(/ـ/g,'').replace(/[ٱأإآ]/g,'ا').replace(/ى/g,'ي')
    .replace(/ؤ/g,'و').replace(/ئ/g,'ي').replace(/ء/g,'').replace(/ة/g,'ه')
    .replace(/[^\u0621-\u063A\u0641-\u064A\s]/g,' ').replace(/\s+/g,' ').trim();
}
function splitOpeningBasmillah(text,s,a){
  text=String(text||'');
  if(Number(a)!==1||Number(s)===1||Number(s)===9)return{basm:'',body:text};
  const words=text.trim().split(/\s+/);
  if(words.length<5)return{basm:'',body:text};
  const basm=words.slice(0,4).join(' ');
  if(normalizeForBasmillah(basm)!==BASMILLAH_NORM)return{basm:'',body:text};
  return{basm,body:words.slice(4).join(' ')};
}
function stripOpeningBasmillah(text,s,a){return splitOpeningBasmillah(text,s,a).body;}
function looksLikeIndoPakText(text=''){return /[\u089C\u08D5-\u08DF\u08E2]/u.test(String(text));}
const THEMES=['day','night','oled','dusk','ocean','forest','sand','lavender','ember'];
const TRANSLATIONS=[
  {id:'none',name:'',file:null,lang:'none',credit:''},
  {id:'english-rwwad',name:'Rowwad Translation Center',file:'data/translations/english-rwwad.json',lang:'en',credit:'QuranEnc · Rowwad Translation Center · v1.0.19'},
  {id:'english-saheeh',name:'Saheeh / Noor International',file:'data/translations/english-saheeh.json',lang:'en',credit:'QuranEnc · Noor International Center · v1.1.2'},
  {id:'english-hilali-khan',name:'Hilali & Khan',file:'data/translations/english-hilali-khan.json',lang:'en',credit:'QuranEnc · Hilali & Khan · v1.1.2'},
  {id:'english-pickthall',name:'Pickthall',file:'data/translations/english-pickthall.json',lang:'en',credit:'Marmaduke Pickthall · public-domain edition'},
  {id:'english-yusuf-ali',name:'Yusuf Ali',file:'data/translations/english-yusuf-ali.json',lang:'en',credit:'Abdullah Yusuf Ali · public-domain edition'},
  {id:'bengali-rwwad',name:'Rowwad Translation Center',file:'data/translations/bengali-rwwad.json',lang:'bn',credit:'QuranEnc · Rowwad Translation Center · v1.1.2'},
  {id:'bengali-zakaria',name:'Abu Bakr Zakaria',file:'data/translations/bengali-zakaria.json',lang:'bn',credit:'QuranEnc · Abu Bakr Zakaria · v1.1.1'}
];
const $=id=>document.getElementById(id);
const ui={};
['topDot','topStatus','micBtn','micIcon','micLabel','aiStatus','modelProgressWrap','modelProgressBar','queryInput','findBtn','clearQueryBtn','enginePill','modelPill','perfText','transcriptCard','transcript','resultsCard','results','surahSelect','scriptSelect','translationSelect','ayahJump','jumpBtn','surahHeader','verseList','savedSearch','clearSavedSearchBtn','savedSearchStatus','savedList','historyStatus','historyList','clearHistoryBtn','historyFilterAll','historyFilterConfirmed','historyFilterCorrections','learningStatus','reviewCorrectionsBtn','resetLearningBtn','themeGrid','uiLanguageSelect','settingsScript','settingsTranslation','footnotesToggle','backupDataBtn','restoreDataFile','resetAppDataBtn','personalDataStatus','engineSelect','modelMode','advancedModelRow','advancedFileLabel','advancedFile','restartAiBtn','offlineReadinessBtn','offlineReadinessStatus','clearModelCacheBtn','copyLogBtn','diagnostics','openGuideBtn','guideBackBtn','openAboutBtn','aboutBackBtn','editSavedDialog','editSavedHeading','savedTitleInput','savedNoteInput','clearSavedNoteBtn','editSavedCancelBtn','editSavedSaveBtn','restoreDataDialog','restoreDataText','restoreDataCancelBtn','restoreDataConfirmBtn','resetAppDataDialog','resetAppDataInput','resetAppDataCancelBtn','resetAppDataConfirmBtn','removeSavedDialog','removeSavedText','removeSavedCancelBtn','removeSavedConfirmBtn','clearModelDialog','clearModelConfirmInput','clearModelCancelBtn','clearModelConfirmBtn','toast'].forEach(k=>ui[k]=$(k));
const state={
  matcher:null,matcherReady:false,matcherReq:0,matcherWait:new Map(),
  runtime:null,runtimeReady:false,modelReady:false,gpu:null,engine:null,modelHeader:null,modelBytes:0,
  advancedFile:null,mediaRecorder:null,mediaStream:null,chunks:[],recording:false,lastAudio:null,
  arabic:{uthmani:null,indopak:null},chapters:null,translationCache:new Map(),readerSurah:1,highlight:null,
  logs:[],lastAsrMs:0,lastAudioSec:0,lastTranscript:'',modelLoadMs:0,sessionForceCpu:false,pendingSavedDeleteKey:null,pendingSavedEditKey:null,pendingRestore:null,
  storageAvailable:false,storageError:null,savedItems:[],historyItems:[],learningItems:[],historyFilter:'all',activeSearch:null,
  familiarRecords:[],familiarByRange:new Map(),familiarByStart:new Map()
};

const prefs={
  theme:localStorage.getItem('ayah.theme')||'day',
  script:'uthmani',translation:'english-rwwad',footnotes:false,engine:'auto',modelMode:'base',
  uiLanguage:localStorage.getItem('ayah.uiLanguage')||'en'
};
function familiarRangeId(s,a1,a2=a1){s=Number(s);a1=Number(a1);a2=Number(a2??a1);return `${s}:${a1}${a2!==a1?`-${a2}`:''}`;}
function familiarScopeBounds(record){
  const parse=x=>{const [s,a]=String(x||'').split(':');return{ s:Number(s),a:Number(a) };};
  const start=parse(record?.scope?.start),end=parse(record?.scope?.end||record?.scope?.start);return{...start,a1:start.a,a2:end.a};
}
async function loadFamiliarData(){
  if(state.familiarRecords.length)return state.familiarRecords;
  const data=await fetch('data/familiar-ayah.json').then(r=>{if(!r.ok)throw new Error(`Familiar-Ayah metadata HTTP ${r.status}`);return r.json();});
  const rows=Array.isArray(data?.records)?data.records:[];state.familiarRecords=rows;state.familiarByRange=new Map();state.familiarByStart=new Map();
  for(const row of rows){const b=familiarScopeBounds(row);if(!Number.isFinite(b.s)||!Number.isFinite(b.a1)||!Number.isFinite(b.a2))continue;state.familiarByRange.set(familiarRangeId(b.s,b.a1,b.a2),row);const k=`${b.s}:${b.a1}`;if(!state.familiarByStart.has(k))state.familiarByStart.set(k,[]);state.familiarByStart.get(k).push(row);}
  return rows;
}
function familiarForRange(s,a1,a2=a1){return state.familiarByRange.get(familiarRangeId(s,a1,a2))||null;}
function familiarStartingAt(s,a){return state.familiarByStart.get(`${Number(s)}:${Number(a)}`)||[];}
function familiarWithinRange(s,a1,a2=a1){
  s=Number(s);a1=Number(a1);a2=Number(a2??a1);return state.familiarRecords.filter(row=>{const b=familiarScopeBounds(row);return b.s===s&&b.a1>=a1&&b.a2<=a2;});
}
function familiarDisplay(row){if(!row)return'';return prefs.uiLanguage==='bn'?(row.display_bn||row.display_en||row.id):(row.display_en||row.id);}
function familiarTooltip(row){const bits=[row?.arabic_name,...(row?.aliases_en||[])].filter(Boolean);return bits.length?bits.join(' · '):familiarDisplay(row);}
function familiarLabelHtml(row,{compact=false}={}){if(!row)return'';return `<span class="familiarname${compact?' compact':''}" title="${escapeHtml(familiarTooltip(row))}">${escapeHtml(familiarDisplay(row))}</span>`;}
function familiarLabelForRefLike(x){if(!x)return null;const a1=Number(x.a1??x.a),a2=Number(x.a2??x.a??a1),s=Number(x.s);return familiarForRange(s,a1,a2)||familiarWithinRange(s,a1,a2)[0]||null;}
function log(msg){const line=`[${new Date().toLocaleTimeString()}] ${msg}`;state.logs.push(line);if(state.logs.length>1000)state.logs.splice(0,200);console.log(line);renderDiag();}
function toast(msg){ui.toast.textContent=msg;ui.toast.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>ui.toast.classList.remove('show'),2200);}
function fmtBytes(n){if(!Number.isFinite(n))return'—';for(const u of ['B','KB','MB','GB']){if(n<1024||u==='GB')return `${n.toFixed(n<10&&u!=='B'?2:1)} ${u}`;n/=1024;}}
function setTop(text,kind='busy'){ui.topStatus.textContent=text;ui.topDot.className=`dot ${kind}`;}
async function savePrefs(){
  localStorage.setItem('ayah.theme',prefs.theme);localStorage.setItem('ayah.uiLanguage',prefs.uiLanguage||'en');
  if(!state.storageAvailable)return false;
  try{await personalStore.setPreferences(prefs);return true;}catch(e){state.storageAvailable=false;state.storageError=e;log(`Personal storage preference write failed: ${e.message}`);updatePersonalDataStatus();refreshSaveIndicators();if(document.getElementById('view-history')?.classList.contains('active'))renderHistory();return false;}
}
const THEME_BG={day:'#f4f1e8',night:'#111815',oled:'#000000',dusk:'#201b2d',ocean:'#e9f5f8',forest:'#edf3ea',sand:'#f5ede0',lavender:'#f3f0fa',ember:'#241713'};
function applyThemePaint(t){const id=THEMES.includes(t)?t:'day';const bg=THEME_BG[id]||THEME_BG.day;const root=document.documentElement;if(id==='day')delete root.dataset.theme;else root.dataset.theme=id;root.style.backgroundColor=bg;if(document.body)document.body.style.backgroundColor=bg;document.querySelector('meta[name=\"theme-color\"]')?.setAttribute('content',bg);}
function setTheme(theme){prefs.theme=theme;applyThemePaint(theme);void savePrefs();renderThemes();}
function renderThemes(){ui.themeGrid.innerHTML='';for(const id of THEMES){const b=document.createElement('button');b.className=`themebtn ${prefs.theme===id?'active':''}`;b.textContent=t(`theme.${id}`);b.onclick=()=>setTheme(id);ui.themeGrid.appendChild(b);}}
function translationLabel(row){if(row.id==='none')return t('reader.noTranslation');return `${t(row.lang==='bn'?'language.bengali':'language.english')} — ${row.name}`;}
function chapterTypeLabel(type){const k=String(type||'').toLowerCase();return k==='meccan'?t('reader.meccan'):k==='medinan'?t('reader.medinan'):String(type||'');}
function setView(name){document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id===`view-${name}`));document.querySelectorAll('.navbtn').forEach(x=>x.classList.toggle('active',x.dataset.view===name));if(name==='quran')renderReader();if(name==='saved')renderSaved();if(name==='history')renderHistory();if(name==='settings')renderDiag();window.scrollTo({top:0,behavior:'instant'});}
document.querySelectorAll('.navbtn').forEach(b=>b.onclick=()=>setView(b.dataset.view));

async function initMatcher(){
  const w=new Worker('matcher-worker.js',{type:'module'});state.matcher=w;
  w.onmessage=e=>{const m=e.data||{};if(m.type==='ready'){state.matcherReady=true;log(`Matcher ready: ${m.verseCount} ayat, ${m.candidateCount} windows.`);setTop(state.modelReady?t('voice.readyTop'):t('finder.preparingVoice'),state.modelReady?'good':'busy');return;}if(m.id&&state.matcherWait.has(m.id)){const {resolve,reject}=state.matcherWait.get(m.id);state.matcherWait.delete(m.id);m.type==='error'?reject(new Error(m.message)):resolve(m);}else if(m.type==='error')log(`Matcher error: ${m.message}`);};
}
function matcherSearch(text){return new Promise((resolve,reject)=>{const id=++state.matcherReq;state.matcherWait.set(id,{resolve,reject});state.matcher.postMessage({type:'search',id,text,limit:64});});}

function runtimeChoice(){
  if(state.sessionForceCpu&&prefs.modelMode==='base')return{backend:'cpu',url:'runtime/proven-04.js'};
  if(prefs.modelMode==='advanced'){
    if(!state.advancedFile) throw new Error(t('voice.chooseAdvancedFirst'));
    return {backend:'webgpu',url:state.advancedFile.size>1100*1024*1024?'runtime/webgpu-4g.js':'runtime/webgpu-2g.js'};
  }
  const wants=prefs.engine;
  if(wants==='cpu')return{backend:'cpu',url:'runtime/proven-04.js'};
  if(wants==='webgpu')return{backend:'webgpu',url:'runtime/webgpu-2g.js'};
  return navigator.gpu?{backend:'webgpu',url:'runtime/webgpu-2g.js'}:{backend:'cpu',url:'runtime/proven-04.js'};
}
function killRuntime(reason='stopped'){
  if(state.runtime){state.runtime.terminate();state.runtime=null;}
  state.runtimeReady=false;state.modelReady=false;ui.micBtn.disabled=true;ui.micLabel.textContent=t('voice.notReady');ui.aiStatus.textContent=reason;setTop(t('voice.stopped'),'busy');ui.micBtn.setAttribute('aria-label',t('voice.micAria'));
}
async function startAI(){
  killRuntime(t('voice.starting'));
  let choice;
  try{choice=runtimeChoice();}catch(e){ui.aiStatus.textContent=e.message;setTop(t('voice.chooseModel'),'busy');return;}
  state.engine=choice.backend;ui.enginePill.textContent=t('voice.mode',{mode:choice.backend==='webgpu'?t('voice.webgpu'):t('voice.cpuFallback')});
  ui.modelPill.textContent=prefs.modelMode==='base'?t('voice.modelBase'):t('voice.modelNamed',{name:state.advancedFile?.name||t('voice.modelAdvanced')});
  ui.modelProgressBar.style.width='4%';
  const w=new Worker('runtime-worker.js');state.runtime=w;
  w.onmessage=onRuntimeMessage;
  w.onerror=e=>{log(`Runtime worker error: ${e.message||'unknown'}`);ui.aiStatus.textContent=t('voice.startError');setTop(t('voice.error'),'bad');};
  log(`Starting ${choice.backend} runtime (${choice.url}).`);
  w.postMessage({cmd:'init',backend:choice.backend,runtimeUrl:choice.url});
}
function onRuntimeMessage(e){
  const m=e.data||{};
  if(m.type==='line'){if(m.line?.trim())log(`whisper: ${m.line.trim()}`);return;}
  if(m.type==='gpuProbe'){state.gpu=m.gpu;log(m.gpu?.available?`WebGPU ready • max buffer ${fmtBytes(m.gpu.limits.maxBufferSize)}`:`WebGPU unavailable: ${m.gpu?.reason}`);return;}
  if(m.type==='runtimeReady'){state.runtimeReady=true;log('Inference runtime ready.');loadSelectedModel();return;}
  if(m.type==='modelProgress'){
    const total=m.total||0,p=total?Math.min(100,m.received/total*100):Math.min(90,5+Math.log10(Math.max(1,m.received))*10);
    ui.modelProgressBar.style.width=`${p}%`;const action=m.cached?t('voice.preparingSaved'):t('voice.downloading');ui.aiStatus.textContent=t('voice.modelProgress',{action,received:fmtBytes(m.received),total:total?` / ${fmtBytes(total)}`:''});return;
  }
  if(m.type==='modelHeader'){state.modelHeader=m.header;state.modelBytes=m.bytes;log(`Model header OK: ${m.header.arch}, ${fmtBytes(m.bytes)}.`);return;}
  if(m.type==='modelReady'){
    state.modelReady=true;state.modelLoadMs=m.ms;ui.modelProgressBar.style.width='100%';ui.micBtn.disabled=false;ui.micLabel.textContent=t('voice.tapRecite');ui.aiStatus.textContent=t('voice.ready');setTop(t('voice.readyTop'),'good');ui.micBtn.setAttribute('aria-label',t('voice.micAria'));log(`Model ready in ${(m.ms/1000).toFixed(2)} s.`);
    if(prefs.modelMode==='base') localStorage.setItem(BASE_VERIFIED_KEY,BASE_MODEL.sha);
    checkOfflineReadiness({requestPersist:false,quiet:true}).catch(()=>{});
    renderDiag();return;
  }
  if(m.type==='phase'&&m.phase==='inference'){ui.micBtn.disabled=true;ui.micLabel.textContent=t('voice.processing');ui.aiStatus.textContent=t('voice.findingClosest');setTop(t('voice.findingAyah'),'busy');return;}
  if(m.type==='inferenceDone'){
    state.lastAsrMs=m.ms;state.lastAudioSec=m.seconds;state.lastTranscript=m.transcript||'';ui.micBtn.disabled=false;ui.micLabel.textContent=t('voice.tapRecite');ui.aiStatus.textContent=t('voice.complete');setTop(t('voice.matchingQuran'),'busy');ui.micBtn.setAttribute('aria-label',t('voice.micAria'));log(`Inference ${(m.ms/1000).toFixed(2)} s for ${m.seconds.toFixed(1)} s audio; return ${m.ret}.`);
    if(m.transcript){ui.transcript.textContent=m.transcript;ui.transcriptCard.classList.remove('hidden');ui.queryInput.value=m.transcript;searchAndRender(m.transcript,{source:'voice'});}else{setTop(t('voice.noSpeech'),'bad');toast(t('voice.noTranscript'));}
    return;
  }
  if(m.type==='error'){
    log(`Local AI error (${m.cmd}): ${m.message}`);ui.aiStatus.textContent=t('voice.errorDetail');setTop(t('voice.error'),'bad');
    if(state.modelReady){ui.micBtn.disabled=false;ui.micLabel.textContent=t('voice.tapRecite');ui.micBtn.setAttribute('aria-label',t('voice.micAria'));}
    if(state.engine==='webgpu'&&prefs.engine==='auto'&&prefs.modelMode==='base'){
      log('Automatic mode: falling back to proven CPU/WASM runtime for this session.');state.sessionForceCpu=true;setTimeout(()=>startAI(),250);
    }
  }
}
function loadSelectedModel(){
  if(!state.runtimeReady)return;
  if(prefs.modelMode==='advanced'){
    state.runtime.postMessage({cmd:'loadModel',source:'file',file:state.advancedFile});
  }else{
    state.runtime.postMessage({cmd:'loadModel',source:'remote',url:BASE_MODEL.url,expectedSha:BASE_MODEL.sha});
  }
}

function bestRecorderMime(){return ['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'].find(x=>window.MediaRecorder?.isTypeSupported?.(x))||'';}
async function startRecording(){
  if(!state.modelReady)return toast(t('voice.stillPreparing'));
  const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
  const mime=bestRecorderMime(),rec=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);state.mediaStream=stream;state.mediaRecorder=rec;state.chunks=[];state.recording=true;
  rec.ondataavailable=e=>{if(e.data?.size)state.chunks.push(e.data)};
  rec.onstop=async()=>{state.recording=false;ui.micBtn.classList.remove('recording');ui.micIcon.textContent='●';ui.micBtn.disabled=true;ui.micLabel.textContent=t('voice.processing');ui.micBtn.setAttribute('aria-label',t('voice.micAria'));stream.getTracks().forEach(t=>t.stop());const blob=new Blob(state.chunks,{type:rec.mimeType||mime||'audio/mp4'});log(`Captured ${fmtBytes(blob.size)} ${blob.type}.`);try{const audio=await decodeTo16k(blob);state.lastAudio=audio;const copy=audio.slice();state.runtime.postMessage({cmd:'infer',audio:copy},[copy.buffer]);}catch(e){log(`Audio decode failed: ${e.message}`);ui.micBtn.disabled=false;ui.micLabel.textContent=t('voice.tapRecite');ui.aiStatus.textContent=t('voice.ready');setTop(t('voice.readyTop'),'good');ui.micBtn.setAttribute('aria-label',t('voice.micAria'));toast(t('voice.decodeError'));}};
  rec.start(250);ui.micBtn.classList.add('recording');ui.micIcon.textContent='■';ui.micLabel.textContent=t('voice.tapStop');ui.aiStatus.textContent=t('voice.recording');ui.micBtn.setAttribute('aria-label',t('voice.tapStop'));log(`Recording started (${mime||'default'}).`);
}
function stopRecording(){state.mediaRecorder?.stop();}
async function decodeTo16k(blob){const ab=await blob.arrayBuffer(),Ctx=window.AudioContext||window.webkitAudioContext,ctx=new Ctx();let b;try{b=await ctx.decodeAudioData(ab.slice(0));}finally{try{await ctx.close()}catch{}}const mono=new Float32Array(b.length);for(let c=0;c<b.numberOfChannels;c++){const ch=b.getChannelData(c);for(let i=0;i<b.length;i++)mono[i]+=ch[i]/b.numberOfChannels;}return resample(mono,b.sampleRate,16000);}
function resample(input,from,to){if(from===to)return input.slice();const ratio=from/to,n=Math.max(1,Math.round(input.length/ratio)),out=new Float32Array(n);for(let i=0;i<n;i++){const p=i*ratio,a=Math.floor(p),b=Math.min(input.length-1,a+1),f=p-a;out[i]=input[a]*(1-f)+input[b]*f;}let peak=0;for(const x of out)peak=Math.max(peak,Math.abs(x));if(peak>.0001&&peak<.85){const g=Math.min(8,.92/peak);for(let i=0;i<out.length;i++)out[i]*=g;}return out;}
ui.micBtn.onclick=()=>state.recording?stopRecording():startRecording().catch(e=>{log(`Microphone error: ${e.message}`);toast(t('voice.microphoneError'));});


function targetRefCandidate(x){
  if(!x)return null;const s=Number(x.s),a1=Number(x.a??x.a1),a2=Number(x.a2??x.a??x.a1);if(!Number.isInteger(s)||!Number.isInteger(a1)||!Number.isInteger(a2))return null;
  return{s,a1,a2,surah_en:String(x.surah_en||''),surah_ar:String(x.surah_ar||'')};
}
function targetRefKey(x){const r=targetRefCandidate(x);return r?`ref:${r.s}:${r.a1}-${r.a2}`:'';}
function exactLocusInside(candidate,exactLocations=[]){
  const c=targetRefCandidate(candidate);if(!c)return null;const hits=(exactLocations||[]).filter(x=>Number(x.s)===c.s&&Number(x.a1??x.a)>=c.a1&&Number(x.a2??x.a??x.a1)<=c.a2);return hits.length===1?targetRefCandidate(hits[0]):null;
}
function signatureKeyFromCandidate(candidate){
  const v=(candidate?.verses||[]).length===1?candidate.verses[0]:null;const sig=String(candidate?.interpretationKey||v?.n||'').trim();return sig?`sig:${sig}`:'';
}
function targetForCandidate(candidate,exactLocations=[]){
  if(!candidate)return null;const exact=exactLocusInside(candidate,exactLocations);if(exact)return{key:targetRefKey(exact),ref:exact,kind:'locus'};
  const sig=signatureKeyFromCandidate(candidate);const ref=targetRefCandidate(candidate?.interpretationAnchor||candidate);if(sig)return{key:sig,ref,kind:'signature'};
  return ref?{key:targetRefKey(ref),ref,kind:'locus'}:null;
}
function targetForGroup(group,exactLocations=[]){
  if(!group)return null;const occ=group.occurrences||[],anchor=group.anchor||occ[0]||group.candidate;const exact=exactLocusInside(group.candidate||anchor,exactLocations);if(exact)return{key:targetRefKey(exact),ref:exact,kind:'locus'};
  const sig=String(group.interpretationKey||anchor?.verses?.[0]?.n||group.candidate?.verses?.[0]?.n||'').trim();const ref=targetRefCandidate(anchor||group.candidate);if(sig)return{key:`sig:${sig}`,ref,kind:'signature',occurrences:occ.length};
  return ref?{key:targetRefKey(ref),ref,kind:'locus',occurrences:occ.length}:null;
}
function buildLearningItems(out){
  const exact=out.exactLocations||[],items=[];let rawRank=1;
  for(const g of out.topGroups||[]){const target=targetForGroup(g,exact);if(target)items.push({kind:'group',group:g,target,targetKey:target.key,rawScore:Number(g.score)||0,rawRank});}
  rawRank=Math.max(2,(out.topGroups||[]).length+1);
  for(const r of out.alternatives||[]){const target=targetForCandidate(r,exact);if(target)items.push({kind:'candidate',candidate:r,target,targetKey:target.key,rawScore:Number(r.score)||0,rawRank:rawRank++});}
  return items;
}
function personalizedModel(out,query){
  const queryNorm=normalizeArabic(query,false),items=buildLearningItems(out);const blocked=!!out.sharedOpening||(out.exactLocations||[]).length>1||(out.topGroups||[]).length!==1;
  const ranked=personalizeItems(items,state.learningItems||[],queryNorm,{blocked});
  ranked.items.forEach((x,i)=>x.displayRank=i+1);return{...ranked,blocked,queryNorm};
}
function targetLabel(target){const r=target?.ref;if(!r)return'Quran interpretation';const base=`${r.surah_en||'Surah'} · ${r.s}:${r.a1}${r.a2!==r.a1?`–${r.a2}`:''}`;return target?.occurrences>1?`${base} · ${target.occurrences} identical occurrences`:base;}
function activeConfirmation(){return state.activeSearch?.confirmation||null;}
function styleConfirmButton(btn,target,meta={}){
  if(!btn||!target)return;btn.dataset.confirmKey=target.key;const c=activeConfirmation();const same=c?.targetKey===target.key;
  const canConfirm=state.storageAvailable&&!!state.activeSearch?.historyId;btn.textContent=same?t('finder.undo'):t('finder.correct');btn.classList.toggle('confirmedstate',same);btn.disabled=!canConfirm||(!same&&!!c);btn.style.visibility=(!same&&!!c)?'hidden':'';
  btn.setAttribute('aria-hidden',(!same&&!!c)?'true':'false');btn.setAttribute('aria-label',same?t('finder.confirmUndoAria'):!state.storageAvailable?t('storage.unavailable'):t('finder.confirmAria'));
  btn.onclick=async()=>{if(same)await undoConfirmation(state.activeSearch?.historyId,c);else await confirmInterpretation(target,meta);};
}
function refreshConfirmIndicators(){document.querySelectorAll('[data-confirm-key]').forEach(btn=>{const key=btn.dataset.confirmKey,target=state.activeSearch?.targets?.get(key);if(target)styleConfirmButton(btn,target.target,target.meta);});}
function registerConfirmTarget(target,meta={}){if(!target||!state.activeSearch)return null;state.activeSearch.targets??=new Map();state.activeSearch.targets.set(target.key,{target,meta});const b=document.createElement('button');b.className='btn confirmbtn';styleConfirmButton(b,target,meta);return b;}
function learningRecordFor(id){return(state.learningItems||[]).find(x=>x.fingerprintId===id)||null;}
async function confirmInterpretation(target,meta={}){
  const a=state.activeSearch;if(!a?.historyId||!state.storageAvailable||activeConfirmation())return;
  const queryNorm=normalizeArabic(a.query,false),coValidExact=!!a.rawOut?.sharedOpening||(a.rawOut?.exactLocations||[]).length>1;
  const eligible=isLearningEligible(queryNorm,{coValidExact,sharedOpening:!!a.rawOut?.sharedOpening});let learningApplied=false,fingerprintId=null;
  if(eligible){
    fingerprintId=learningFingerprintId(queryNorm,target.key);const prev=learningRecordFor(fingerprintId);const now=Date.now();const row={fingerprintId,queryNorm,targetKey:target.key,targetRef:target.ref||null,confirmations:Math.min(99,(Number(prev?.confirmations)||0)+1),createdAt:Number(prev?.createdAt)||now,updatedAt:now};
    await personalStore.putLearning(row);state.learningItems=await personalStore.getLearning();learningApplied=true;
  }
  const rawRank=Number(meta.rawRank)||null,displayRank=Number(meta.displayRank)||rawRank;const confirmation={at:Date.now(),targetKey:target.key,targetRef:target.ref||null,targetLabel:targetLabel(target),rawRank,displayRank,isCorrection:!!(rawRank&&rawRank>1&&!coValidExact),coValidExact,learningApplied,learningFingerprintId:fingerprintId};
  await personalStore.updateHistoryConfirmation(a.historyId,confirmation);a.confirmation=confirmation;state.historyItems=await personalStore.getHistory();refreshConfirmIndicators();renderHistory();updateLearningStatus();updatePersonalDataStatus();renderDiag();
  toast(learningApplied?t('learning.applied'):coValidExact?t('learning.notAppliedCoValid'):t('learning.notAppliedShort'));
}
async function undoConfirmation(historyId,confirmation){
  if(!historyId||!confirmation||!state.storageAvailable)return;
  if(confirmation.learningApplied&&confirmation.learningFingerprintId){const row=learningRecordFor(confirmation.learningFingerprintId);if(row){if((Number(row.confirmations)||1)<=1)await personalStore.deleteLearning(row.fingerprintId);else await personalStore.putLearning({...row,confirmations:Number(row.confirmations)-1,updatedAt:Date.now()});state.learningItems=await personalStore.getLearning();}}
  await personalStore.updateHistoryConfirmation(historyId,null);if(state.activeSearch?.historyId===historyId)state.activeSearch.confirmation=null;state.historyItems=await personalStore.getHistory();rerenderActiveSearchWithLearning();refreshConfirmIndicators();renderHistory();updateLearningStatus();updatePersonalDataStatus();renderDiag();toast(t('learning.undoDone'));
}
function rerenderActiveSearchWithLearning(){
  const a=state.activeSearch;if(!a?.rawOut)return;
  a.model=personalizedModel(a.rawOut,a.query);a.targets=new Map();
  if(a.rawOut.sharedOpening)renderSharedOpening(a.rawOut.sharedOpeningMatches||a.rawOut.results||[],a.rawOut.exactQuery||a.rawOut.query||'',a.model);
  else renderResults(a.rawOut.results||[],a.rawOut.topGroups||[],a.rawOut.alternatives||[],a.rawOut.occurrences||[],a.rawOut.exactLocations||[],a.rawOut.exactQuery||a.rawOut.query||'',a.model);
}
function updateLearningStatus(){
  if(!ui.learningStatus)return;if(!state.storageAvailable){ui.learningStatus.textContent=t('history.storageUnavailable');ui.resetLearningBtn.disabled=true;ui.reviewCorrectionsBtn.disabled=true;return;}
  const rows=state.learningItems||[],n=rows.length,c=rows.reduce((sum,x)=>sum+(Number(x.confirmations)||0),0);ui.learningStatus.textContent=n?t('learning.status',{patterns:n,patternSuffix:n===1?'':'s',confirmations:c,confirmationSuffix:c===1?'':'s'}):t('learning.statusEmpty');ui.resetLearningBtn.disabled=!n;ui.reviewCorrectionsBtn.disabled=!(state.historyItems||[]).some(x=>x.confirmation?.isCorrection);
}

async function searchAndRender(text,{source='text'}={}){
  if(!state.matcherReady)return toast(t('finder.loading'));
  const q=String(text||'').trim();if(!q)return;
  setTop(t('finder.matching'),'busy');
  try{
    const out=await matcherSearch(q);
    if(out.bismillahOnly){
      ui.results.innerHTML='';ui.resultsCard.classList.remove('hidden');
      const heading=ui.resultsCard.querySelector('h3');if(heading)heading.textContent=t('finder.bismillahHeading');
      ui.results.innerHTML=`<p>${escapeHtml(t('finder.bismillahText'))}</p>`;
      setTop(t('voice.readyTop'),'good');log('Finder suppressed a standalone opening Bismillah query.');return;
    }
    const model=personalizedModel(out,q);const historyId=(out.results||[]).length?await recordHistoryEvent(q,source,out,model):null;
    state.activeSearch={query:q,source,rawOut:out,model,historyId,confirmation:null,targets:new Map()};
    if(out.sharedOpening)renderSharedOpening(out.sharedOpeningMatches||out.results||[],out.exactQuery||out.query||'',model);
    else renderResults(out.results||[],out.topGroups||[],out.alternatives||[],out.occurrences||[],out.exactLocations||[],out.exactQuery||out.query||'',model);
    setTop(t('voice.readyTop'),'good');
    const primaryCount=out.topGroups?.length||0;
    const occurrenceCount=(out.topGroups||[]).reduce((n,g)=>n+(g.occurrences?.length||0),0);
    log(`Matcher ${(out.ms||0).toFixed(1)} ms • ${primaryCount||1} primary interpretation${primaryCount===1?'':'s'} • ${occurrenceCount} canonical occurrence${occurrenceCount===1?'':'s'} • ${(out.alternatives||[]).length} lower alternatives • ${(out.exactLocations||[]).length} exact canonical locus${(out.exactLocations||[]).length===1?'':'es'}.`);
  }catch(e){log(`Matcher failed: ${e.message}`);setTop(t('finder.matcherError'),'bad');}
}
function historyCandidateSnapshot(r){
  if(!r)return null;const a1=Number(r.a??r.a1),a2=Number(r.a??r.a2??a1);
  return{s:Number(r.s),a1,a2,surah_en:String(r.surah_en||''),surah_ar:String(r.surah_ar||''),score:Number(r.score)||0};
}
function historyGroupSnapshot(g){
  const candidate=historyCandidateSnapshot(g?.candidate),anchor=historyCandidateSnapshot(g?.anchor||g?.occurrences?.[0]);
  return{score:Number(g?.score)||candidate?.score||0,candidate,anchor,occurrences:(g?.occurrences||[]).map(historyCandidateSnapshot).filter(Boolean).map(x=>({s:x.s,a1:x.a1,a2:x.a2,surah_en:x.surah_en}))};
}
async function recordHistoryEvent(query,source,out,model=null){
  if(!state.storageAvailable)return null;
  const topGroups=(out.topGroups||[]).map(historyGroupSnapshot),alternatives=(out.alternatives||[]).slice(0,4).map(historyCandidateSnapshot).filter(Boolean);
  const fallback=historyCandidateSnapshot(out.results?.[0]);
  const personalization=model?{applied:!!model.applied,reordered:!!model.reordered,displayTargetKeys:(model.items||[]).map(x=>x.targetKey),bonuses:(model.items||[]).filter(x=>x.bonus>0).map(x=>({targetKey:x.targetKey,bonus:x.bonus}))}:null;
  const event={at:Date.now(),source:source==='voice'?'voice':'text',query:String(query).slice(0,500),normalizedQuery:normalizeArabic(query,false),matchKind:out.sharedOpening?'shared-opening':'ranked',sharedOpeningMatches:(out.sharedOpeningMatches||[]).map(historyCandidateSnapshot).filter(Boolean),exactLocations:(out.exactLocations||[]).map(historyCandidateSnapshot).filter(Boolean),topGroups,alternatives,top:fallback,personalization,confirmation:null};
  try{const id=await personalStore.addHistory(event);state.historyItems=await personalStore.getHistory();updatePersonalDataStatus();if(document.getElementById('view-history')?.classList.contains('active'))renderHistory();return id;}
  catch(e){state.storageAvailable=false;state.storageError=e;log(`History write failed: ${e.message}`);updatePersonalDataStatus();return null;}
}
function historyTop(entry){if(entry?.confirmation?.targetRef)return entry.confirmation.targetRef;const g=entry.topGroups?.[0];return g?.anchor||g?.candidate||entry.top||null;}
function historyRef(x){if(!x)return t('history.quranMatch');const a1=x.a1??x.a,a2=x.a2??a1;return `${x.surah_en||t('common.surah')} · ${x.s}:${a1}${a2!==a1?`–${a2}`:''}`;}
function historyDate(at){try{return new Intl.DateTimeFormat(prefs.uiLanguage==='bn'?'bn-BD':'en',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(at));}catch{return new Date(at).toLocaleString();}}
async function removeHistoryEntry(id){if(!state.storageAvailable)return;try{await personalStore.deleteHistory(id);state.historyItems=state.historyItems.filter(x=>x.id!==id);renderHistory();updatePersonalDataStatus();}catch(e){toast(t('storage.unavailable'));}}
function renderHistory(){
  if(!ui.historyList)return;
  [ui.historyFilterAll,ui.historyFilterConfirmed,ui.historyFilterCorrections].forEach(b=>{if(b)b.classList.toggle('active',b.dataset.historyFilter===state.historyFilter);});
  if(!state.storageAvailable){ui.historyStatus.textContent='';ui.clearHistoryBtn.disabled=true;ui.historyList.innerHTML=`<div class="historystorage">${escapeHtml(t('history.storageUnavailable'))}</div>`;return;}
  const all=state.historyItems||[];let items=all;if(state.historyFilter==='confirmed')items=all.filter(x=>!!x.confirmation);else if(state.historyFilter==='corrections')items=all.filter(x=>!!x.confirmation?.isCorrection);
  ui.clearHistoryBtn.disabled=!all.length;ui.historyStatus.textContent=t('history.count',{count:items.length,suffix:items.length===1?'':'es'});
  ui.historyList.innerHTML='';if(!items.length){ui.historyList.innerHTML=`<div class="savedempty">${escapeHtml(t('history.empty'))}</div>`;return;}
  for(const x of items){const top=historyTop(x),g=x.topGroups?.[0],occ=g?.occurrences?.length||1,score=Number(g?.score??top?.score??0),alts=x.alternatives?.length||0,tied=(x.topGroups?.length||0)>1;
    const el=document.createElement('div');el.className='historyitem';
    const sourceLabel=x.source==='voice'?t('history.voice'):t('history.text');const sharedOpening=x.matchKind==='shared-opening';const sharedCount=x.sharedOpeningMatches?.length||0;const exactCount=x.exactLocations?.length||0;const c=x.confirmation;
    const meta=[historyDate(x.at),sourceLabel,sharedOpening?t('history.sharedOpening'):(tied?t('history.tiedTop'):t('history.topMatch')),sharedOpening&&sharedCount?t('history.possibleAyat',{count:sharedCount}):null,!sharedOpening&&exactCount>1?t('history.exactAyat',{count:exactCount}):null,!sharedOpening&&score?`${(score*100).toFixed(1)}%`:null,occ>1?t('history.occurrences',{count:occ,suffix:occ===1?'':'s'}):null,alts?t('history.alternatives',{count:alts,suffix:alts===1?'':'s'}):null].filter(Boolean).join(' · ');
    const displayRef=c?.targetRef?historyRef(c.targetRef):(c?.targetLabel||(sharedOpening?t('history.sharedOpeningRef',{query:x.query||x.normalizedQuery||''}):historyRef(top)));const familiar=!sharedOpening?familiarLabelForRefLike(c?.targetRef||top):null;
    let confirmText='';if(c){if(c.coValidExact)confirmText=`✓ ${t('history.confirmed')} · ${t('history.coValidIntent')}`;else if(c.isCorrection)confirmText=`✓ ${t('history.corrected')} · ${t('history.originallyRanked',{rank:c.rawRank})}`;else confirmText=`✓ ${t('history.confirmed')}`;}
    el.innerHTML=`<div class="historyhead"><div><div class="historyref">${escapeHtml(displayRef)}</div>${familiar?`<div class="familiarrow">${familiarLabelHtml(familiar,{compact:true})}</div>`:''}<div class="historymeta">${escapeHtml(meta)}</div>${confirmText?`<div class="historyconfirmation">${escapeHtml(confirmText)}</div>`:''}</div></div>${!sharedOpening&&x.query?`<div class="historyquery">${escapeHtml(x.query)}</div>`:''}<div class="historyactions"><button class="btn soft open">${escapeHtml(sharedOpening&&!c?t('history.searchAgain'):t('history.open'))}</button>${c?`<button class="btn undo">${escapeHtml(t('history.undoConfirmation'))}</button>`:''}<button class="btn danger remove">${escapeHtml(t('history.remove'))}</button></div>`;
    const open=el.querySelector('.open');if(c?.targetRef)open.onclick=()=>openReference(c.targetRef.s,c.targetRef.a1);else if(sharedOpening){open.onclick=()=>{setView('find');ui.queryInput.value=x.query||x.normalizedQuery||'';void searchAndRender(ui.queryInput.value,{source:'text'});};}else if(top)open.onclick=()=>openReference(top.s,top.a1??top.a);else open.disabled=true;
    el.querySelector('.undo')?.addEventListener('click',()=>undoConfirmation(x.id,c));el.querySelector('.remove').onclick=()=>removeHistoryEntry(x.id);ui.historyList.appendChild(el);
  }
}
[ui.historyFilterAll,ui.historyFilterConfirmed,ui.historyFilterCorrections].forEach(b=>{if(b)b.onclick=()=>{state.historyFilter=b.dataset.historyFilter||'all';renderHistory();};});
ui.clearHistoryBtn.onclick=async()=>{if(!state.storageAvailable||!state.historyItems.length)return;if(!confirm(t('history.confirmClear')))return;try{await personalStore.clearHistory();state.historyItems=[];renderHistory();updatePersonalDataStatus();toast(t('history.cleared'));}catch{toast(t('storage.unavailable'));}};

function resultArabic(r){return (r.verses||[]).map(v=>v.ar).join(' ');}
function refKey(x){return `${x.s}:${x.a??x.a1}-${x.a2??x.a??x.a1}`;}
function savedKeySet(){return new Set(getSaved().map(x=>x.key));}
function styleSaveButton(btn,key){
  const saved=savedKeySet().has(key);
  btn.dataset.saveKey=key;
  btn.textContent=saved?t('saved.saved'):t('saved.save');
  btn.classList.toggle('savedstate',saved);
  btn.disabled=saved||!state.storageAvailable;
  btn.setAttribute('aria-label',!state.storageAvailable?t('storage.unavailable'):saved?t('saved.savedAria'):t('saved.saveAria'));
}
function refreshSaveIndicators(){const keys=savedKeySet();document.querySelectorAll('[data-save-key]').forEach(btn=>{const saved=keys.has(btn.dataset.saveKey);btn.textContent=saved?t('saved.saved'):t('saved.save');btn.classList.toggle('savedstate',saved);btn.disabled=saved||!state.storageAvailable;btn.setAttribute('aria-label',!state.storageAvailable?t('storage.unavailable'):saved?t('saved.savedAria'):t('saved.saveAria'));});}
function bindSaveButton(btn,x){const key=refKey(x);styleSaveButton(btn,key);btn.onclick=()=>saveReference({...x,key});}
function resultSavePayload(r){return{s:r.s,a:r.a??r.a1,a2:r.a2??r.a??r.a1,surah:r.surah_en,ar:resultArabic(r)};}
function exactTokenMarks(verses,query){
  const queryVariants=[normalizeArabic(query,false),normalizeArabic(query,true)].filter(Boolean).map(x=>x.split(' ').filter(Boolean));
  const flat=[];(verses||[]).forEach((v,vi)=>String(v?.ar||'').trim().split(/\s+/).filter(Boolean).forEach((raw,ti)=>flat.push({vi,ti,raw,n:normalizeArabic(raw,false),x:normalizeArabic(raw,true)})));
  const marks=new Set();
  for(const q of queryVariants){if(!q.length)continue;for(const field of ['n','x']){outer:for(let i=0;i+q.length<=flat.length;i++){for(let j=0;j<q.length;j++)if(flat[i+j][field]!==q[j])continue outer;for(let j=0;j<q.length;j++)marks.add(`${flat[i+j].vi}:${flat[i+j].ti}`);}}}
  return marks;
}
function highlightedVerseHtml(verses,vi,query,marks){
  const tokens=String(verses[vi]?.ar||'').trim().split(/\s+/).filter(Boolean);
  return tokens.map((token,ti)=>marks.has(`${vi}:${ti}`)?`<mark class="exactmatch">${escapeHtml(token)}</mark>`:escapeHtml(token)).join(' ');
}
function resultAyahHtml(r,exactQuery=''){
  const verses=(r.verses||[]).filter(Boolean),marks=exactQuery?exactTokenMarks(verses,exactQuery):new Set();
  if(verses.length<=1)return `<div class="arabic">${highlightedVerseHtml(verses,0,exactQuery,marks)}</div>`;
  return `<div class="resultayahs">${verses.map((v,vi)=>{const familiar=familiarForRange(r.s,v.a,v.a);return `<div class="resultayah"><div class="resultayahlabel"><span>${escapeHtml(t('finder.ayahLabel',{ayah:v.a}))}</span>${familiar?familiarLabelHtml(familiar,{compact:true}):''}</div><div class="arabic resultayahtext">${highlightedVerseHtml(verses,vi,exactQuery,marks)}</div></div>`;}).join('')}</div>`;
}
function confirmMetaForTarget(target,model=null){const item=(model?.items||[]).find(x=>x.targetKey===target?.key);return{rawRank:item?.rawRank||null,displayRank:item?.displayRank||item?.rawRank||null};}
function groupFromCandidateItem(item){const r=item.candidate,occ=r?.interpretationOccurrences?.length?r.interpretationOccurrences:[r],anchor=r?.interpretationAnchor||occ[0]||r;return{score:r?.score||0,candidate:r,anchor,occurrences:occ,interpretationKey:r?.interpretationKey||''};}
function makeResultCard(r,{prefix='',scoreText=null,exactQuery='',confirmTarget=null,confirmMeta=null}={}){
  const el=document.createElement('div');el.className='result';
  const a1=r.a??r.a1,a2=r.a??r.a2??a1;const ref=`${r.s}:${a1}${a2!==a1?`–${a2}`:''}`;const ar=resultArabic(r);
  const score=scoreText===null?t('finder.similarity',{value:(r.score*100).toFixed(1)}):scoreText;const familiar=familiarForRange(r.s,a1,a2)||(a1===a2?familiarForRange(r.s,a1,a1):null);
  el.innerHTML=`<div class="resulthead"><div><div class="resultref">${prefix?`${escapeHtml(prefix)} `:''}${escapeHtml(r.surah_en)} · ${ref}</div>${familiar?`<div class="familiarrow">${familiarLabelHtml(familiar)}</div>`:''}<div class="substatus">${escapeHtml(r.surah_ar)}</div></div>${score?`<div class="score">${escapeHtml(score)}</div>`:''}</div>${resultAyahHtml(r,exactQuery)}<div class="resultactions"><button class="btn soft open">${escapeHtml(t('finder.openQuran'))}</button><button class="btn save">${escapeHtml(t('saved.save'))}</button></div>`;
  el.querySelector('.open').onclick=()=>openReference(r.s,a1);bindSaveButton(el.querySelector('.save'),{s:r.s,a:a1,a2,surah:r.surah_en,ar});if(confirmTarget){const b=registerConfirmTarget(confirmTarget,confirmMeta||{});if(b)el.querySelector('.resultactions').appendChild(b);}return el;
}

function makeOccurrenceGroup(group,{collapsed=false,label=null,exactQuery='',confirmTarget=null,confirmMeta=null}={}){
  const d=document.createElement('details');d.className='matchgroup';d.open=!collapsed;label=label||t('finder.topMatch');
  const occ=group.occurrences||[];const candidate=group.candidate;const representative=group.anchor||occ[0]||candidate;const count=Math.max(1,occ.length);
  const summary=document.createElement('summary');summary.innerHTML=`<span><b>${escapeHtml(label)}</b><small>${escapeHtml(representative?.surah_en||candidate?.surah_en||t('reader.title'))} · ${representative?.s??candidate?.s}:${representative?.a??candidate?.a1}</small></span><span class="score">${(group.score*100).toFixed(1)}% · ${escapeHtml(t('finder.occurrenceCount',{count,suffix:count===1?'':'s'}))}</span>`;d.appendChild(summary);
  const body=document.createElement('div');body.className='matchgroupbody';
  if(confirmTarget){const row=document.createElement('div');row.className='confirmrow';const b=registerConfirmTarget(confirmTarget,confirmMeta||{});if(b)row.appendChild(b);body.appendChild(row);}
  if(occ.length>1){const note=document.createElement('p');note.className='substatus';note.textContent=t('finder.repeatedNote');body.appendChild(note);occ.forEach((r,i)=>body.appendChild(makeResultCard(r,{prefix:`${i+1}.`,scoreText:t('finder.occurrenceOf',{index:i+1,count:occ.length}),exactQuery})));}
  else body.appendChild(makeResultCard(candidate||representative,{scoreText:t('finder.similarity',{value:(group.score*100).toFixed(1)}),exactQuery}));
  d.appendChild(body);return d;
}
function exactPanelRedundant(exactLocations,topGroups,exactQuery){
  if(exactLocations.length<2||topGroups.length!==1)return false;const occ=topGroups[0].occurrences||[];if(occ.length!==exactLocations.length)return false;
  const a=new Set(occ.map(x=>`${x.s}:${x.a??x.a1}-${x.a??x.a2??x.a1}`)),b=new Set(exactLocations.map(x=>`${x.s}:${x.a1}-${x.a2}`));if(a.size!==b.size||[...a].some(x=>!b.has(x)))return false;
  const v=(topGroups[0].anchor||topGroups[0].candidate)?.verses?.[0];if(!v)return false;const q=[normalizeArabic(exactQuery,false),normalizeArabic(exactQuery,true)];return [v.n,v.ny,v.nx].filter(Boolean).some(x=>q.includes(x));
}
function renderExactOccurrencePanel(exactLocations=[],exactQuery='',topGroups=[],model=null){
  if(exactLocations.length<2||exactPanelRedundant(exactLocations,topGroups,exactQuery))return;
  const ranges=exactLocations.some(x=>(x.a2??x.a1)!==(x.a1??x.a));const d=document.createElement('details');d.className='exactoccurrences';
  const label=ranges?t('finder.exactLocationsFound',{count:exactLocations.length}):t('finder.exactAyatFound',{count:exactLocations.length});
  const summary=document.createElement('summary');summary.innerHTML=`<span><b>${escapeHtml(label)}</b><small>${escapeHtml(t('finder.showAllExact'))}</small></span>`;d.appendChild(summary);
  const body=document.createElement('div');body.className='exactoccurrencebody';exactLocations.forEach(r=>{const target=targetForCandidate(r,exactLocations);body.appendChild(makeResultCard(r,{scoreText:t('finder.exactPhrase'),exactQuery,confirmTarget:target,confirmMeta:confirmMetaForTarget(target,model)}));});d.appendChild(body);ui.results.appendChild(d);
}
function renderSharedOpening(matches=[],exactQuery='',model=null){
  ui.results.innerHTML='';ui.resultsCard.classList.remove('hidden');const heading=ui.resultsCard.querySelector('h3');if(heading)heading.textContent=t('finder.sharedOpeningCount',{count:matches.length});
  const intro=document.createElement('p');intro.className='substatus';intro.textContent=t('finder.sharedOpeningText',{count:matches.length});ui.results.appendChild(intro);
  matches.forEach(r=>{const target=targetForCandidate(r,matches);ui.results.appendChild(makeResultCard(r,{scoreText:t('finder.sharedOpeningLabel'),exactQuery,confirmTarget:target,confirmMeta:confirmMetaForTarget(target,model)}));});refreshSaveIndicators();refreshConfirmIndicators();
}
function renderResults(results,topGroups=[],alternatives=[],legacyOccurrences=[],exactLocations=[],exactQuery='',model=null){
  ui.results.innerHTML='';ui.resultsCard.classList.remove('hidden');const heading=ui.resultsCard.querySelector('h3');
  if(!results.length){if(heading)heading.textContent=t('finder.resultsTitle');ui.results.innerHTML=`<p>${escapeHtml(t('finder.noMatch'))}</p>`;return;}
  if(!topGroups.length){topGroups=[{score:results[0].score,candidate:results[0],anchor:legacyOccurrences[0]||null,occurrences:legacyOccurrences.length?legacyOccurrences:[results[0]]}];alternatives=results.slice(1,5);}
  const tied=topGroups.length>1;
  renderExactOccurrencePanel(exactLocations,exactQuery,topGroups,model);
  if(model?.reordered&&model.items?.length){
    if(heading)heading.textContent=t('finder.personalizedTop');const note=document.createElement('div');note.className='personalizednote';note.textContent=t('finder.personalizedNote');ui.results.appendChild(note);
    const first=model.items[0],topGroup=first.kind==='group'?first.group:groupFromCandidateItem(first);ui.results.appendChild(makeOccurrenceGroup(topGroup,{collapsed:false,label:t('finder.personalizedTop'),exactQuery,confirmTarget:first.target,confirmMeta:{rawRank:first.rawRank,displayRank:1}}));
    const rest=model.items.slice(1,5);if(rest.length){const h=document.createElement('h4');h.className='resultssection';h.textContent=t('finder.nextClosest');ui.results.appendChild(h);rest.forEach((item,i)=>{if(item.kind==='group'&&(item.group?.occurrences?.length||0)>1)ui.results.appendChild(makeOccurrenceGroup(item.group,{collapsed:true,label:t('finder.nextMatch',{index:i+1}),exactQuery,confirmTarget:item.target,confirmMeta:{rawRank:item.rawRank,displayRank:i+2}}));else{const r=item.kind==='group'?(item.group.candidate||item.group.anchor):item.candidate;ui.results.appendChild(makeResultCard(r,{prefix:`${i+1}.`,exactQuery,confirmTarget:item.target,confirmMeta:{rawRank:item.rawRank,displayRank:i+2}}));}});}
  }else{
    if(heading)heading.textContent=tied?t('finder.topMatchesTied'):t('finder.topQuranMatch');
    if(model?.applied){const note=document.createElement('div');note.className='personalizednote';note.textContent=t('finder.personalizedNote');ui.results.appendChild(note);}
    const intro=document.createElement('p');intro.className='substatus';intro.textContent=tied?t('finder.tiedIntro'):t('finder.bestIntro');ui.results.appendChild(intro);
    topGroups.forEach((g,i)=>{const target=targetForGroup(g,exactLocations);ui.results.appendChild(makeOccurrenceGroup(g,{collapsed:tied,label:tied?t('finder.tiedTopMatch',{index:i+1}):t('finder.topMatch'),exactQuery,confirmTarget:target,confirmMeta:confirmMetaForTarget(target,model)}));});
    if(alternatives.length){const h=document.createElement('h4');h.className='resultssection';h.textContent=t('finder.nextClosest');ui.results.appendChild(h);alternatives.slice(0,4).forEach((r,i)=>{const target=targetForCandidate(r,exactLocations);ui.results.appendChild(makeResultCard(r,{prefix:`${i+1}.`,exactQuery,confirmTarget:target,confirmMeta:confirmMetaForTarget(target,model)}));});}
  }
  refreshSaveIndicators();refreshConfirmIndicators();
}
ui.findBtn.onclick=()=>searchAndRender(ui.queryInput.value,{source:'text'});ui.clearQueryBtn.onclick=()=>{state.activeSearch=null;ui.queryInput.value='';ui.resultsCard.classList.add('hidden');ui.transcriptCard.classList.add('hidden');const h=ui.resultsCard.querySelector('h3');if(h)h.textContent=t('finder.resultsTitle');};ui.queryInput.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')searchAndRender(ui.queryInput.value,{source:'text'});});

async function loadReaderData(){
  if(!state.familiarRecords.length)await loadFamiliarData();
  if(!state.chapters){state.chapters=await fetch('data/arabic/chapters.json').then(r=>r.json());populateSurahs();}
  if(!state.arabic.uthmani)state.arabic.uthmani=await fetch('data/arabic/uthmani.json').then(r=>r.json());
  if(!state.arabic.indopak)state.arabic.indopak=await fetch('data/arabic/indopak.json').then(r=>r.json());
}
function populateSurahs(){ui.surahSelect.innerHTML='';for(const c of state.chapters.chapters){const o=document.createElement('option');o.value=c.id;o.textContent=`${c.id}. ${c.transliteration} — ${c.name}`;ui.surahSelect.appendChild(o);}ui.surahSelect.value=state.readerSurah;}
async function getTranslation(id){const t=TRANSLATIONS.find(x=>x.id===id);if(!t?.file)return null;if(state.translationCache.has(id))return state.translationCache.get(id);const data=await fetch(t.file).then(r=>r.json());state.translationCache.set(id,data);return data;}
function extractBasm(text,s,a){return prefs.script==='uthmani'?splitOpeningBasmillah(text,s,a):{basm:'',body:text};}
async function renderReader(){
  await loadReaderData();const s=Number(state.readerSurah||1),chap=state.chapters.chapters.find(x=>x.id===s);ui.surahSelect.value=s;ui.scriptSelect.value=prefs.script;ui.translationSelect.value=prefs.translation;
  ui.surahHeader.innerHTML=`<div class="resulthead"><div><h3 style="margin:0">${escapeHtml(chap.transliteration)}</h3><div class="substatus">${escapeHtml(chap.translation)} · ${escapeHtml(t('reader.ayatCount',{count:chap.total_verses}))} · ${escapeHtml(chapterTypeLabel(chap.type))}</div></div><div class="arabic" style="margin:0;font-size:28px">${escapeHtml(chap.name)}</div></div>`;
  const rawSrc=state.arabic[prefs.script]?.[String(s)]||[];
  const src=prefs.script==='indopak'?alignedIndoPakRows(rawSrc,s):rawSrc;
  const tr=await getTranslation(prefs.translation);const trRows=tr?.[String(s)]||[];ui.verseList.innerHTML='';ui.verseList.classList.toggle('indopakmode',prefs.script==='indopak');
  let openingBasm='';
  if(s!==1&&s!==9){
    if(prefs.script==='uthmani'&&src[0])openingBasm=splitOpeningBasmillah(src[0].text,s,1).basm;
    if(prefs.script==='indopak')openingBasm=INDOPAK_OPENING_BASMILLAH;
  }
  if(openingBasm){const furniture=document.createElement('div');furniture.className='surahbasm';furniture.textContent=openingBasm;ui.verseList.appendChild(furniture);}
  for(const v of src){const wrap=document.createElement('article');wrap.className='verse'+(state.highlight===v.verse?' highlight':'');wrap.id=`ayah-${s}-${v.verse}`;const pieces=extractBasm(v.text,s,v.verse);const tt=trRows.find(x=>x.verse===v.verse);const familiar=familiarStartingAt(s,v.verse)[0]||null;wrap.innerHTML=`<div class="versemeta"><span class="ayahmetaleft"><span class="ayahbadge">${v.verse}</span>${familiar?familiarLabelHtml(familiar,{compact:true}):''}</span><button class="btn saveVerse" style="min-height:36px;padding:6px 10px">${escapeHtml(t('saved.save'))}</button></div><div class="versearabic">${escapeHtml(pieces.body)}</div>${tt?`<div class="translation" dir="auto">${escapeHtml(tt.text||'')}</div>${prefs.footnotes&&tt.footnotes?`<div class="footnote">${sanitizeFootnote(tt.footnotes)}</div>`:''}`:''}`;bindSaveButton(wrap.querySelector('.saveVerse'),{s,a:v.verse,a2:v.verse,surah:chap.transliteration,ar:pieces.body});ui.verseList.appendChild(wrap);}
  const tmeta=TRANSLATIONS.find(x=>x.id===prefs.translation);if(tmeta?.credit){const cr=document.createElement('div');cr.className='credits';cr.style.marginTop='14px';cr.textContent=tmeta.credit;ui.verseList.appendChild(cr);}
  if(state.highlight){requestAnimationFrame(()=>document.getElementById(`ayah-${s}-${state.highlight}`)?.scrollIntoView({behavior:'smooth',block:'center'}));setTimeout(()=>state.highlight=null,1400);}
}
function sanitizeFootnote(s){const d=document.createElement('div');d.innerHTML=String(s);return escapeHtml(d.textContent||'').replace(/\n/g,'<br>');}
function openReference(s,a){state.readerSurah=Number(s);state.highlight=Number(a);setView('quran');}
ui.surahSelect.onchange=()=>{state.readerSurah=Number(ui.surahSelect.value);state.highlight=null;renderReader();};ui.scriptSelect.onchange=()=>{prefs.script=ui.scriptSelect.value;ui.settingsScript.value=prefs.script;savePrefs();renderReader();};ui.translationSelect.onchange=()=>{prefs.translation=ui.translationSelect.value;ui.settingsTranslation.value=prefs.translation;savePrefs();renderReader();};ui.jumpBtn.onclick=()=>{const a=Number(ui.ayahJump.value);if(a>0){state.highlight=a;renderReader();}};

function getSaved(){return state.savedItems||[];}
async function setSaved(x){
  if(!state.storageAvailable)throw state.storageError||new Error('Personal storage is unavailable');
  const clean=x.map(sanitizeBackupSaved).filter(Boolean).slice(0,200);await personalStore.replaceSaved(clean);state.savedItems=clean;updatePersonalDataStatus();return clean;
}
async function saveReference(x){
  if(!state.storageAvailable){toast(t('storage.unavailable'));return false;}
  let s=getSaved();const key=x.key||refKey(x);
  if(s.some(i=>i.key===key)){toast(t('saved.already'));refreshSaveIndicators();return false;}
  const item=sanitizeBackupSaved({...x,key,at:Date.now(),title:'',note:''});if(!item)return false;
  try{await setSaved([item,...s].slice(0,200));refreshSaveIndicators();toast(t('saved.savedToast'));return true;}
  catch(e){state.storageError=e;toast(t('storage.unavailable'));return false;}
}
function savedHaystack(x){const familiar=familiarLabelForRefLike(x);return [x.title,x.note,x.surah,`${x.s}:${x.a}${x.a2&&x.a2!==x.a?`-${x.a2}`:''}`,x.ar,familiar?.display_en,familiar?.display_bn,...(familiar?.aliases_en||[])].join(' ').normalize('NFKC').toLowerCase();}
function openSavedEditor(x){
  state.pendingSavedEditKey=x.key;ui.savedTitleInput.value=x.title||'';ui.savedNoteInput.value=x.note||'';
  const hasMeta=!!((x.title||'').trim()||(x.note||'').trim());
  ui.editSavedHeading.textContent=t(hasMeta?'dialog.savedEdit':'dialog.savedAdd');ui.clearSavedNoteBtn.classList.toggle('hidden',!hasMeta);
  if(ui.editSavedDialog?.showModal)ui.editSavedDialog.showModal();
}
function closeSavedEditor(){state.pendingSavedEditKey=null;ui.savedTitleInput.value='';ui.savedNoteInput.value='';ui.editSavedDialog.close();}
async function saveSavedMetadata(){
  const key=state.pendingSavedEditKey;if(!key)return;
  const items=getSaved(),x=items.find(i=>i.key===key);if(!x)return closeSavedEditor();
  x.title=ui.savedTitleInput.value.trim().slice(0,120);x.note=ui.savedNoteInput.value.trim().slice(0,4000);x.updatedAt=Date.now();
  try{await setSaved(items);closeSavedEditor();renderSaved();toast(t(x.title||x.note?'saved.metaUpdated':'saved.keptNoNote'));}catch{toast(t('storage.unavailable'));}
}
async function clearSavedMetadata(){
  const key=state.pendingSavedEditKey;if(!key)return;
  if(!confirm(t('saved.clearMetaConfirm')))return;
  const items=getSaved(),x=items.find(i=>i.key===key);if(!x)return closeSavedEditor();
  x.title='';x.note='';x.updatedAt=Date.now();try{await setSaved(items);closeSavedEditor();renderSaved();toast(t('saved.metaCleared'));}catch{toast(t('storage.unavailable'));}
}
function openSavedDeleteConfirm(x){
  state.pendingSavedDeleteKey=x.key;ui.removeSavedText.textContent=t('saved.removePrompt',{surah:x.surah||t('common.surah'),ref:`${x.s}:${x.a}${x.a2&&x.a2!==x.a?`–${x.a2}`:''}`});
  if(ui.removeSavedDialog?.showModal)ui.removeSavedDialog.showModal();else if(confirm(ui.removeSavedText.textContent)){removeSavedByKey(x.key);}
}
async function removeSavedByKey(key){if(!state.storageAvailable)return toast(t('storage.unavailable'));try{await personalStore.deleteSaved(key);state.savedItems=getSaved().filter(i=>i.key!==key);state.pendingSavedDeleteKey=null;updatePersonalDataStatus();refreshSaveIndicators();renderSaved();toast(t('saved.removed'));}catch{toast(t('storage.unavailable'));}}
function renderSaved(){
  if(!state.storageAvailable){ui.savedList.innerHTML=`<div class="historystorage">${escapeHtml(t('storage.unavailable'))}</div>`;if(ui.savedSearchStatus)ui.savedSearchStatus.textContent='';ui.savedSearch.disabled=true;ui.clearSavedSearchBtn.disabled=true;return;}ui.savedSearch.disabled=false;ui.clearSavedSearchBtn.disabled=false;
  const items=getSaved(),q=(ui.savedSearch?.value||'').trim().normalize('NFKC').toLowerCase();const shown=q?items.filter(x=>savedHaystack(x).includes(q)):items;
  ui.savedList.innerHTML='';if(ui.savedSearchStatus)ui.savedSearchStatus.textContent=q?t('saved.searchCount',{shown:shown.length,total:items.length,suffix:shown.length===1?'':'s'}):t('saved.count',{count:items.length});
  if(!items.length){ui.savedList.innerHTML=`<div class="savedempty">${escapeHtml(t('saved.noItems'))}</div>`;return;}
  if(!shown.length){ui.savedList.innerHTML=`<div class="savedempty">${escapeHtml(t('saved.noSearchMatch'))}</div>`;return;}
  for(const x of shown){
    const el=document.createElement('div');el.className='saveditem';const ref=`${escapeHtml(x.surah||t('common.surah'))} · ${x.s}:${x.a}${x.a2&&x.a2!==x.a?`–${x.a2}`:''}`;const hasMeta=!!((x.title||'').trim()||(x.note||'').trim());const familiar=familiarLabelForRefLike(x);
    el.innerHTML=`<div class="savedmain">${x.title?`<b class="savedtitle">${escapeHtml(x.title)}</b><small>${ref}</small>`:`<b>${ref}</b>`}${familiar?`<div class="familiarrow">${familiarLabelHtml(familiar,{compact:true})}</div>`:''}<small class="savedarabic${looksLikeIndoPakText(x.ar)?' indopaktext':''}" dir="rtl">${escapeHtml((x.ar||'').slice(0,140))}</small>${x.note?`<div class="savednote">${escapeHtml(x.note)}</div>`:''}</div><div class="row savedactions"><button class="btn open">${escapeHtml(t('saved.open'))}</button><button class="btn soft edit">${escapeHtml(t(hasMeta?'saved.editMeta':'saved.addMeta'))}</button><button class="btn danger del">${escapeHtml(t('common.remove'))}</button></div>`;
    el.querySelector('.open').onclick=()=>openReference(x.s,x.a);el.querySelector('.edit').onclick=()=>openSavedEditor(x);el.querySelector('.del').onclick=()=>openSavedDeleteConfirm(x);ui.savedList.appendChild(el);
  }
}
ui.savedSearch.oninput=()=>renderSaved();ui.clearSavedSearchBtn.onclick=()=>{ui.savedSearch.value='';renderSaved();ui.savedSearch.focus();};
ui.editSavedCancelBtn.onclick=()=>closeSavedEditor();ui.editSavedSaveBtn.onclick=()=>saveSavedMetadata();ui.clearSavedNoteBtn.onclick=()=>clearSavedMetadata();
ui.removeSavedCancelBtn.onclick=()=>{state.pendingSavedDeleteKey=null;ui.removeSavedDialog.close();};
ui.removeSavedConfirmBtn.onclick=()=>{const key=state.pendingSavedDeleteKey;ui.removeSavedDialog.close();if(key)removeSavedByKey(key);};

function personalPrefsSnapshot(){return{theme:prefs.theme,uiLanguage:prefs.uiLanguage||'en',script:prefs.script,translation:prefs.translation,footnotes:!!prefs.footnotes};}
function sanitizeBackupSaved(x){
  const s=Number(x?.s),a=Number(x?.a??x?.a1),a2=Number(x?.a2??a);if(!Number.isInteger(s)||s<1||s>114||!Number.isInteger(a)||a<1||!Number.isInteger(a2)||a2<a)return null;
  return{key:`${s}:${a}-${a2}`,s,a,a2,surah:String(x.surah||'').slice(0,120),ar:stripOpeningBasmillah(String(x.ar||''),s,a).slice(0,5000),title:String(x.title||'').slice(0,120),note:String(x.note||'').slice(0,4000),at:Number(x.at)||Date.now(),updatedAt:Number(x.updatedAt)||undefined};
}
function sanitizeHistoryCandidate(x){if(!x)return null;const s=Number(x.s),a1=Number(x.a1??x.a),a2=Number(x.a2??a1),score=Number(x.score)||0;if(!Number.isInteger(s)||s<1||s>114||!Number.isInteger(a1)||a1<1||!Number.isInteger(a2)||a2<a1)return null;return{s,a1,a2,surah_en:String(x.surah_en||'').slice(0,120),surah_ar:String(x.surah_ar||'').slice(0,120),score};}
function sanitizeTargetRef(x){if(!x)return null;const s=Number(x.s),a1=Number(x.a1??x.a),a2=Number(x.a2??a1);if(!Number.isInteger(s)||s<1||s>114||!Number.isInteger(a1)||a1<1||!Number.isInteger(a2)||a2<a1)return null;return{s,a1,a2,surah_en:String(x.surah_en||'').slice(0,120),surah_ar:String(x.surah_ar||'').slice(0,120)};}
function sanitizeConfirmation(x){if(!x)return null;const targetKey=String(x.targetKey||'').slice(0,1200);if(!targetKey)return null;const targetRef=sanitizeTargetRef(x.targetRef),rawRank=Number(x.rawRank)||null,displayRank=Number(x.displayRank)||rawRank;return{at:Number(x.at)||Date.now(),targetKey,targetRef,targetLabel:String(x.targetLabel||'').slice(0,180),rawRank,displayRank,isCorrection:!!x.isCorrection,coValidExact:!!x.coValidExact,learningApplied:!!x.learningApplied,learningFingerprintId:x.learningFingerprintId?String(x.learningFingerprintId).slice(0,64):null};}
function sanitizeLearningEntry(x){if(!x)return null;const queryNorm=String(x.queryNorm||'').trim().slice(0,500),targetKey=String(x.targetKey||'').trim().slice(0,1200),confirmations=Math.max(1,Math.min(99,Number(x.confirmations)||1));if(!queryNorm||!targetKey)return null;return{fingerprintId:learningFingerprintId(queryNorm,targetKey),queryNorm,targetKey,targetRef:sanitizeTargetRef(x.targetRef),confirmations,createdAt:Number(x.createdAt)||Date.now(),updatedAt:Number(x.updatedAt)||Date.now()};}
function sanitizeHistoryEntry(x){
  if(!x)return null;const top=sanitizeHistoryCandidate(x.top);const topGroups=(Array.isArray(x.topGroups)?x.topGroups:[]).slice(0,8).map(g=>({score:Number(g?.score)||0,candidate:sanitizeHistoryCandidate(g?.candidate),anchor:sanitizeHistoryCandidate(g?.anchor),occurrences:(Array.isArray(g?.occurrences)?g.occurrences:[]).slice(0,64).map(sanitizeHistoryCandidate).filter(Boolean)})).filter(g=>g.candidate||g.anchor);const alternatives=(Array.isArray(x.alternatives)?x.alternatives:[]).slice(0,4).map(sanitizeHistoryCandidate).filter(Boolean);if(!topGroups.length&&!top)return null;
  const matchKind=x.matchKind==='shared-opening'?'shared-opening':'ranked';const sharedOpeningMatches=(Array.isArray(x.sharedOpeningMatches)?x.sharedOpeningMatches:[]).slice(0,16).map(sanitizeHistoryCandidate).filter(Boolean);const exactLocations=(Array.isArray(x.exactLocations)?x.exactLocations:[]).slice(0,128).map(sanitizeHistoryCandidate).filter(Boolean);
  const personalization=x.personalization&&typeof x.personalization==='object'?{applied:!!x.personalization.applied,reordered:!!x.personalization.reordered,displayTargetKeys:(Array.isArray(x.personalization.displayTargetKeys)?x.personalization.displayTargetKeys:[]).slice(0,8).map(v=>String(v).slice(0,1200)),bonuses:(Array.isArray(x.personalization.bonuses)?x.personalization.bonuses:[]).slice(0,8).map(v=>({targetKey:String(v?.targetKey||'').slice(0,1200),bonus:Math.max(0,Math.min(.052,Number(v?.bonus)||0))}))}:null;return{at:Number(x.at)||Date.now(),source:x.source==='voice'?'voice':'text',query:String(x.query||'').slice(0,500),normalizedQuery:String(x.normalizedQuery||normalizeArabic(x.query||'',false)).slice(0,500),matchKind,sharedOpeningMatches,exactLocations,topGroups,alternatives,top,personalization,confirmation:sanitizeConfirmation(x.confirmation)};
}
async function buildPersonalBackup(){
  if(!state.storageAvailable)throw state.storageError||new Error('Personal storage is unavailable');
  await savePrefs();
  const [savedRows,historyRows,learningRows,storedPrefs]=await Promise.all([personalStore.getSaved(),personalStore.getHistory(),personalStore.getLearning(),personalStore.getPreferences()]);
  const saved=savedRows.map(sanitizeBackupSaved).filter(Boolean).slice(0,200),history=historyRows.map(sanitizeHistoryEntry).filter(Boolean).slice(0,500),learning=learningRows.map(sanitizeLearningEntry).filter(Boolean).slice(0,1000),preferences=cleanPortablePrefs(storedPrefs);
  return{format:PERSONAL_BACKUP_FORMAT,version:PERSONAL_BACKUP_VERSION,schema:PERSONAL_BACKUP_SCHEMA,createdAt:new Date().toISOString(),exportedBy:{product:'AyahOnDevice',build:BUILD_ID},counts:{saved:saved.length,history:history.length,learning:learning.length},saved,history,learning,preferences};
}
async function downloadPersonalBackup(){
  if(!state.storageAvailable)return toast(t('storage.unavailable'));
  try{const data=await buildPersonalBackup(),blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`AyahOnDevice-Personal-Backup-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);toast(t('backup.created'));log(`Personal backup created: ${data.saved.length} saved item(s), ${data.history.length} history item(s).`);}catch(e){log(`Personal backup failed: ${e.message}`);toast(t('storage.unavailable'));}
}
function cleanPortablePrefs(p={}){const clean={};if(THEMES.includes(p.theme))clean.theme=p.theme;if(['en','bn'].includes(p.uiLanguage))clean.uiLanguage=p.uiLanguage;if(['uthmani','indopak'].includes(p.script))clean.script=p.script;if(TRANSLATIONS.some(x=>x.id===p.translation))clean.translation=p.translation;if(typeof p.footnotes==='boolean')clean.footnotes=p.footnotes;return clean;}
function validatePersonalBackup(x){
  if(!x||typeof x!=='object'||Array.isArray(x))throw new Error(t('backup.unsupported'));
  const legacy=x.format===LEGACY_PERSONAL_BACKUP_FORMAT&&x.version===1,current=x.format===PERSONAL_BACKUP_FORMAT&&x.version===PERSONAL_BACKUP_VERSION;if(!legacy&&!current)throw new Error(t('backup.unsupported'));
  if(current&&x.schema!=null&&x.schema!==PERSONAL_BACKUP_SCHEMA)throw new Error(t('backup.invalidSchema'));
  if(!Array.isArray(x.saved))throw new Error(t('backup.invalidSavedSection'));const saved=x.saved.map(sanitizeBackupSaved).filter(Boolean);if(saved.length!==x.saved.length||saved.length>200)throw new Error(t('backup.invalidSavedRefs'));
  if(new Set(saved.map(r=>r.key)).size!==saved.length)throw new Error(t('backup.duplicateSaved'));
  const rawHistory=legacy?[]:(Array.isArray(x.history)?x.history:[]);const history=rawHistory.map(sanitizeHistoryEntry).filter(Boolean);if(!legacy&&history.length!==rawHistory.length)throw new Error(t('backup.invalidHistory'));if(history.length>500)throw new Error(t('backup.tooManyHistory'));
  const rawLearning=legacy?[]:(Array.isArray(x.learning)?x.learning:[]);const learning=rawLearning.map(sanitizeLearningEntry).filter(Boolean);if(!legacy&&learning.length!==rawLearning.length)throw new Error(t('backup.invalidLearning'));if(learning.length>1000)throw new Error(t('backup.tooManyLearning'));if(new Set(learning.map(r=>r.fingerprintId)).size!==learning.length)throw new Error(t('backup.duplicateLearning'));
  const preferences=cleanPortablePrefs(x.preferences||{});return{saved,history,learning,preferences,createdAt:String(x.createdAt||''),legacy,schema:legacy?'legacy-v1':PERSONAL_BACKUP_SCHEMA};
}
async function applyRestoredPersonalData(data){
  if(!state.storageAvailable)return toast(t('storage.unavailable'));
  const defaults={theme:'day',uiLanguage:'en',script:'uthmani',translation:'english-rwwad',footnotes:false};const portable={...defaults,...data.preferences};const fullPrefs={...prefs,...portable,engine:prefs.engine,modelMode:prefs.modelMode};
  try{await personalStore.replacePersonalData({saved:data.saved,history:data.history,learning:data.learning,preferences:fullPrefs});localStorage.setItem('ayah.theme',fullPrefs.theme);localStorage.setItem('ayah.uiLanguage',fullPrefs.uiLanguage||'en');toast(t('backup.restored'));location.reload();}catch(e){log(`Personal restore failed: ${e.message}`);toast(t('storage.unavailable'));}
}
function updatePersonalDataStatus(){
  if(!ui.personalDataStatus)return;ui.backupDataBtn.disabled=!state.storageAvailable;ui.restoreDataFile.disabled=!state.storageAvailable;if(!state.storageAvailable){ui.personalDataStatus.textContent=t('storage.unavailable');return;}ui.personalDataStatus.textContent=t('personal.status',{saved:getSaved().length,history:(state.historyItems||[]).length});
}
ui.backupDataBtn.onclick=()=>downloadPersonalBackup();
ui.restoreDataFile.onchange=async()=>{
  const file=ui.restoreDataFile.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text()),data=validatePersonalBackup(parsed);state.pendingRestore=data;ui.restoreDataText.textContent=t('backup.restorePrompt',{saved:data.saved.length,savedSuffix:data.saved.length===1?'':'s',history:data.history.length,historySuffix:data.history.length===1?'y':'ies',dated:data.createdAt?t('backup.fromDate',{date:data.createdAt}):''});ui.restoreDataDialog.showModal();}catch(e){state.pendingRestore=null;ui.restoreDataFile.value='';toast(e.message||t('backup.readError'));}
};
ui.restoreDataCancelBtn.onclick=()=>{state.pendingRestore=null;ui.restoreDataFile.value='';ui.restoreDataDialog.close();};
ui.restoreDataConfirmBtn.onclick=()=>{const data=state.pendingRestore;ui.restoreDataDialog.close();ui.restoreDataFile.value='';state.pendingRestore=null;if(data)void applyRestoredPersonalData(data);};
function resetResetAppDialog(){ui.resetAppDataInput.value='';ui.resetAppDataConfirmBtn.disabled=true;}
ui.resetAppDataBtn.onclick=()=>{resetResetAppDialog();if(ui.resetAppDataDialog?.showModal)ui.resetAppDataDialog.showModal();};
ui.resetAppDataInput.oninput=()=>{ui.resetAppDataConfirmBtn.disabled=ui.resetAppDataInput.value!=='RESET AYAHONDEVICE DATA';};
ui.resetAppDataCancelBtn.onclick=()=>{resetResetAppDialog();ui.resetAppDataDialog.close();};
ui.resetAppDataConfirmBtn.onclick=async()=>{
  if(ui.resetAppDataInput.value!=='RESET AYAHONDEVICE DATA')return;
  const keepVerified=localStorage.getItem(BASE_VERIFIED_KEY);let resetOk=false;
  try{if(state.storageAvailable){await personalStore.resetPersonalData();resetOk=true;}else{personalStore.close();await deletePersonalDatabase();resetOk=true;}}catch(e){log(`IndexedDB reset failed: ${e.message}`);toast(t('storage.resetFailed'));}
  if(!resetOk)return;
  const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith('ayah.')&&k!==BASE_VERIFIED_KEY)keys.push(k);}keys.forEach(k=>localStorage.removeItem(k));if(keepVerified)localStorage.setItem(BASE_VERIFIED_KEY,keepVerified);
  ui.resetAppDataDialog.close();resetResetAppDialog();location.reload();
};

function populateTranslations(){for(const sel of [ui.translationSelect,ui.settingsTranslation]){sel.innerHTML='';for(const row of TRANSLATIONS){const o=document.createElement('option');o.value=row.id;o.textContent=translationLabel(row);sel.appendChild(o);}sel.value=prefs.translation;}}
function syncSettings(){ui.uiLanguageSelect.value=prefs.uiLanguage;ui.settingsScript.value=prefs.script;ui.settingsTranslation.value=prefs.translation;ui.footnotesToggle.checked=prefs.footnotes;ui.engineSelect.value=prefs.engine;ui.modelMode.value=prefs.modelMode;ui.advancedModelRow.classList.toggle('hidden',prefs.modelMode!=='advanced');ui.engineSelect.disabled=prefs.modelMode==='advanced';}
async function checkOfflineReadiness({requestPersist=true,quiet=false}={}){
  const critical=['./','./index.html','./styles.css','./app.js','./learning-core.js','./personal-store.js','./i18n.js','./locales/en.js','./locales/bn.js','./manifest.webmanifest','./matcher-core.js','./matcher-worker.js','./runtime-worker.js','./runtime/proven-04.js','./runtime/webgpu-2g.js','./runtime/webgpu-4g.js','./assets/icon-32.png','./assets/icon-128.png','./assets/icon-192.png','./assets/icon-512.png','./assets/AyahOnDevice.ico','./assets/fonts/DigitalKhattIndoPak.woff2','./data/matcher.json','./data/familiar-ayah.json','./data/arabic/uthmani.json','./data/arabic/indopak.json','./data/arabic/chapters.json','./data/translations/english-rwwad.json','./data/translations/english-saheeh.json','./data/translations/english-hilali-khan.json','./data/translations/english-pickthall.json','./data/translations/english-yusuf-ali.json','./data/translations/bengali-rwwad.json','./data/translations/bengali-zakaria.json'];
  let persistent=false,swActive=false,shellMissing=[],modelCached=false,verified=false;
  try{
    if(requestPersist&&navigator.storage?.persist) await navigator.storage.persist();
    persistent=!!(await navigator.storage?.persisted?.());
  }catch{}
  try{const reg=await navigator.serviceWorker?.getRegistration?.();swActive=!!(reg?.active||reg?.waiting||reg?.installing);}catch{}
  try{const c=await caches.open(SHELL_CACHE);for(const rel of critical){const url=new URL(rel,location.href).href;if(!(await c.match(url,{ignoreSearch:true})))shellMissing.push(rel);}}catch{shellMissing=critical.slice();}
  try{const c=await caches.open(MODEL_CACHE);modelCached=!!(await c.match(BASE_MODEL.url));}catch{}
  verified=localStorage.getItem(BASE_VERIFIED_KEY)===BASE_MODEL.sha;
  const ready=swActive&&shellMissing.length===0&&modelCached&&verified;
  const parts=[];
  parts.push(t(swActive?'offline.shellRegistered':'offline.shellNotRegistered'));
  parts.push(shellMissing.length===0?t('offline.assetsCached'):t('offline.assetsMissing',{count:shellMissing.length}));
  parts.push(modelCached&&verified?t('offline.modelVerified'):modelCached?t('offline.modelUnverified'):t('offline.modelMissing'));
  parts.push(t(persistent?'offline.persistent':'offline.evictable'));
  if(ui.offlineReadinessStatus){ui.offlineReadinessStatus.textContent=`${t(ready?'offline.ready':'offline.incomplete')} · ${parts.join(' · ')}`;ui.offlineReadinessStatus.style.fontWeight=ready?'700':'500';}
  if(!quiet){toast(t(ready?'offline.confirmed':'offline.notComplete'));log(`Offline readiness: ${ready?'PASS':'NOT READY'} • ${parts.join(' • ')}`);}
  return {ready,swActive,shellMissing,modelCached,verified,persistent};
}
ui.uiLanguageSelect.onchange=async()=>{const next=['en','bn'].includes(ui.uiLanguageSelect.value)?ui.uiLanguageSelect.value:'en';prefs.uiLanguage=next;localStorage.setItem('ayah.uiLanguage',next);setLocale(next);applyI18n();renderThemes();populateTranslations();syncSettings();await savePrefs();location.reload();};ui.settingsScript.onchange=()=>{prefs.script=ui.settingsScript.value;ui.scriptSelect.value=prefs.script;savePrefs();};ui.settingsTranslation.onchange=()=>{prefs.translation=ui.settingsTranslation.value;ui.translationSelect.value=prefs.translation;savePrefs();};ui.footnotesToggle.onchange=()=>{prefs.footnotes=ui.footnotesToggle.checked;savePrefs();};ui.engineSelect.onchange=()=>{prefs.engine=ui.engineSelect.value;savePrefs();};ui.modelMode.onchange=()=>{prefs.modelMode=ui.modelMode.value;savePrefs();syncSettings();};ui.advancedFile.onchange=()=>{state.advancedFile=ui.advancedFile.files?.[0]||null;ui.advancedFileLabel.textContent=state.advancedFile?t('voice.fileChosen',{name:state.advancedFile.name,size:fmtBytes(state.advancedFile.size)}):t('settings.advancedFileHelp');};ui.restartAiBtn.onclick=()=>{state.sessionForceCpu=false;startAI();};
ui.offlineReadinessBtn.onclick=()=>checkOfflineReadiness({requestPersist:true});
ui.reviewCorrectionsBtn.onclick=()=>{state.historyFilter='corrections';setView('history');renderHistory();};
ui.resetLearningBtn.onclick=async()=>{if(!state.storageAvailable||!state.learningItems.length)return;if(!confirm(t('learning.resetConfirm')))return;try{await personalStore.clearLearning();state.learningItems=[];rerenderActiveSearchWithLearning();updateLearningStatus();renderDiag();toast(t('learning.resetDone'));}catch{toast(t('storage.unavailable'));}};

function resetClearModelDialog(){ui.clearModelConfirmInput.value='';ui.clearModelConfirmBtn.disabled=true;}
ui.clearModelCacheBtn.onclick=()=>{resetClearModelDialog();if(ui.clearModelDialog?.showModal)ui.clearModelDialog.showModal();else{const typed=prompt(t('dialog.promptClearModel'));if(typed==='CLEAR OFFLINE MODEL')clearCachedBaseModel();}};
ui.clearModelConfirmInput.oninput=()=>{ui.clearModelConfirmBtn.disabled=ui.clearModelConfirmInput.value!=='CLEAR OFFLINE MODEL';};
ui.clearModelCancelBtn.onclick=()=>{resetClearModelDialog();ui.clearModelDialog.close();};
ui.clearModelConfirmBtn.onclick=async()=>{if(ui.clearModelConfirmInput.value!=='CLEAR OFFLINE MODEL')return;ui.clearModelDialog.close();resetClearModelDialog();await clearCachedBaseModel();};
async function clearCachedBaseModel(){await caches.delete(MODEL_CACHE);localStorage.removeItem(BASE_VERIFIED_KEY);if(ui.offlineReadinessStatus)ui.offlineReadinessStatus.textContent=t('offline.modelRemovedStatus');toast(t('offline.modelRemovedToast'));log('Cached Base model cleared after typed destructive confirmation.');renderDiag();}
ui.openGuideBtn.onclick=()=>setView('guide');ui.guideBackBtn.onclick=()=>setView('settings');ui.openAboutBtn.onclick=()=>setView('about');ui.aboutBackBtn.onclick=()=>setView('settings');
ui.copyLogBtn.onclick=async()=>{const text=state.logs.join('\n');try{await navigator.clipboard.writeText(text);toast(t('diagnostics.copied'));}catch{const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast(t('diagnostics.copied'));}};

async function renderDiag(){if(!ui.diagnostics)return;let est=null;try{est=await navigator.storage?.estimate?.()}catch{}const yes=t('common.yes'),no=t('common.no'),unavailable=t('common.unavailable');const rows=[[t('diagnostics.build'),BUILD_ID],[t('diagnostics.online'),navigator.onLine?yes:no],[t('diagnostics.webgpuExposed'),navigator.gpu?yes:no],[t('diagnostics.workerGpu'),state.gpu?.available?t('diagnostics.available'):state.gpu?.reason||t('diagnostics.notProbed')],[t('diagnostics.gpuBuffer'),state.gpu?.limits?fmtBytes(state.gpu.limits.maxBufferSize):'—'],[t('diagnostics.engine'),state.engine||'—'],[t('diagnostics.modelMode'),prefs.modelMode],[t('diagnostics.model'),state.modelHeader?`${state.modelHeader.arch} · ${fmtBytes(state.modelBytes)}`:'—'],[t('diagnostics.modelInit'),state.modelLoadMs?`${(state.modelLoadMs/1000).toFixed(2)} s`:'—'],[t('diagnostics.lastInference'),state.lastAsrMs?`${(state.lastAsrMs/1000).toFixed(2)} s / ${state.lastAudioSec.toFixed(1)} s audio`:'—'],[t('diagnostics.storage'),est?`${fmtBytes(est.usage)} / ${fmtBytes(est.quota)}`:'—'],[t('diagnostics.personalDb'),state.storageAvailable?t('diagnostics.indexedDbReady'):`${unavailable}${state.storageError?`: ${state.storageError.message}`:''}`],[t('diagnostics.history'),state.storageAvailable?t('diagnostics.localEvents',{count:state.historyItems.length}):unavailable],[t('diagnostics.learning'),state.storageAvailable?t('diagnostics.patterns',{count:state.learningItems.length}):unavailable],[t('diagnostics.serviceWorker'),navigator.serviceWorker?.controller?t('diagnostics.controlling'):t('diagnostics.notControlling')],[t('diagnostics.userAgent'),navigator.userAgent]];ui.diagnostics.textContent=rows.map(([k,v])=>`${k}: ${v}`).join('\n');}
function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

function applyStoredPreferences(stored={}){
  if(THEMES.includes(stored.theme))prefs.theme=stored.theme;
  if(['uthmani','indopak'].includes(stored.script))prefs.script=stored.script;
  if(TRANSLATIONS.some(x=>x.id===stored.translation))prefs.translation=stored.translation;
  if(typeof stored.footnotes==='boolean')prefs.footnotes=stored.footnotes;
  if(['auto','webgpu','cpu'].includes(stored.engine))prefs.engine=stored.engine;
  if(['base','advanced'].includes(stored.modelMode))prefs.modelMode=stored.modelMode;
  if(['en','bn'].includes(stored.uiLanguage))prefs.uiLanguage=stored.uiLanguage;
}
async function initPersonalStorage(){
  const ok=await personalStore.init({normalizeSaved:sanitizeBackupSaved});state.storageAvailable=ok;state.storageError=personalStore.error||null;
  if(!ok){log(`Personal IndexedDB unavailable: ${state.storageError?.message||'unknown error'}. Finder/Quran will continue without persistent personal features.`);setLocale(prefs.uiLanguage||'en');applyI18n();return;}
  try{
    const stored=await personalStore.getPreferences();applyStoredPreferences(stored);
    if(!stored.uiLanguage){prefs.uiLanguage=['en','bn'].includes(prefs.uiLanguage)?prefs.uiLanguage:'en';await personalStore.setPreferences({uiLanguage:prefs.uiLanguage});}
    localStorage.setItem('ayah.theme',prefs.theme);localStorage.setItem('ayah.uiLanguage',prefs.uiLanguage||'en');
    state.savedItems=(await personalStore.getSaved()).map(sanitizeBackupSaved).filter(Boolean);state.historyItems=(await personalStore.getHistory()).map(x=>({...x}));state.learningItems=(await personalStore.getLearning()).map(sanitizeLearningEntry).filter(Boolean);
    setLocale(prefs.uiLanguage||'en');applyI18n();log(`Personal IndexedDB ready: ${state.savedItems.length} saved, ${state.historyItems.length} history, ${state.learningItems.length} learned pattern(s).`);
  }catch(e){state.storageAvailable=false;state.storageError=e;state.savedItems=[];state.historyItems=[];state.learningItems=[];prefs.uiLanguage=['en','bn'].includes(prefs.uiLanguage)?prefs.uiLanguage:'en';setLocale(prefs.uiLanguage);applyI18n();log(`Personal IndexedDB hydration failed: ${e.message}. Finder/Quran remain available.`);}
}
async function init(){
  applyThemePaint(prefs.theme);setLocale(prefs.uiLanguage||'en');applyI18n();
  await initPersonalStorage();applyThemePaint(prefs.theme);renderThemes();populateTranslations();syncSettings();updatePersonalDataStatus();updateLearningStatus();ui.scriptSelect.value=prefs.script;ui.translationSelect.value=prefs.translation;refreshSaveIndicators();
  try{await loadFamiliarData();}catch(e){log(`Familiar-Ayah metadata warning: ${e.message}`);}
  initMatcher();loadReaderData().catch(e=>log(`Reader preload warning: ${e.message}`));
  if('serviceWorker'in navigator){navigator.serviceWorker.register('sw.js').then(async()=>{log('Service worker registered.');try{await navigator.serviceWorker.ready;}catch{}checkOfflineReadiness({requestPersist:false,quiet:true}).catch(()=>{});}).catch(e=>log(`Service worker registration failed: ${e.message}`));}
  setTop(t('finder.preparingVoice'),'busy');startAI();renderDiag();
  window.addEventListener('online',()=>renderDiag());window.addEventListener('offline',()=>renderDiag());
  window.addEventListener('pageshow',()=>applyThemePaint(prefs.theme));document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestAnimationFrame(()=>applyThemePaint(prefs.theme));});
  log(`AyahOnDevice ${BUILD_ID} booted. Local-first inference and verified-corpus display invariant active.`);
}
init();
