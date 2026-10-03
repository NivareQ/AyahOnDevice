const DB_NAME='ayahondevice-personal';
const DB_VERSION=1;
const STORE_NAMES=['saved','history','learning','preferences','meta'];
const LEGACY_PREFS=[
  ['theme','ayah.theme'],['script','ayah.script'],['translation','ayah.translation'],
  ['footnotes','ayah.footnotes'],['engine','ayah.engine'],['modelMode','ayah.modelMode']
];
const MAX_HISTORY=500;
const MAX_LEARNING=1000;
const LEGACY_CLEANUP_KEYS=['ayah.saved','ayah.script','ayah.translation','ayah.footnotes','ayah.engine','ayah.modelMode'];

function requestPromise(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('IndexedDB request failed'));});}
function txPromise(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted'));tx.onerror=()=>{};});}
function openDb(){
  return new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB)return reject(new Error('IndexedDB is unavailable'));
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains('saved'))db.createObjectStore('saved',{keyPath:'key'});
      if(!db.objectStoreNames.contains('history')){const s=db.createObjectStore('history',{keyPath:'id',autoIncrement:true});s.createIndex('at','at');}
      if(!db.objectStoreNames.contains('learning'))db.createObjectStore('learning',{keyPath:'fingerprintId'});
      if(!db.objectStoreNames.contains('preferences'))db.createObjectStore('preferences',{keyPath:'key'});
      if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('IndexedDB could not be opened'));
    req.onblocked=()=>reject(new Error('IndexedDB upgrade is blocked by another AyahOnDevice tab'));
  });
}

export class PersonalStore{
  constructor(){this.db=null;this.available=false;this.error=null;}
  async init({normalizeSaved=(x)=>x}={}){
    try{this.db=await openDb();this.db.onversionchange=()=>this.close();this.available=true;this.error=null;await this.#migrateLegacy(normalizeSaved);return true;}
    catch(e){this.available=false;this.error=e;try{this.db?.close();}catch{}this.db=null;return false;}
  }
  async #migrateLegacy(normalizeSaved){
    const tx0=this.db.transaction('meta','readonly'),done0=txPromise(tx0);const marker=await requestPromise(tx0.objectStore('meta').get('legacyMigration'));await done0;
    if(marker?.complete){this.#cleanupLegacyLocalStorage();return;}
    let saved=[];try{const raw=JSON.parse(localStorage.getItem('ayah.saved')||'[]');if(Array.isArray(raw))saved=raw.map(normalizeSaved).filter(Boolean).slice(0,200);}catch{}
    const prefs=[];for(const [key,legacyKey] of LEGACY_PREFS){const raw=localStorage.getItem(legacyKey);if(raw===null)continue;prefs.push({key,value:key==='footnotes'?raw==='1':raw});}
    const tx=this.db.transaction(['saved','preferences','meta'],'readwrite'),done=txPromise(tx),ss=tx.objectStore('saved'),ps=tx.objectStore('preferences'),ms=tx.objectStore('meta');
    try{
      for(const row of saved)ss.put(row);for(const row of prefs)ps.put(row);ms.put({key:'legacyMigration',complete:true,schema:DB_VERSION,migratedSaved:saved.length,migratedPreferences:prefs.length,at:Date.now()});await done;
    }catch(e){try{tx.abort();}catch{}throw e;}
    this.#cleanupLegacyLocalStorage();
  }
  #cleanupLegacyLocalStorage(){try{for(const key of LEGACY_CLEANUP_KEYS)localStorage.removeItem(key);}catch{}}
  #need(){if(!this.available||!this.db)throw this.error||new Error('Personal storage is unavailable');return this.db;}
  async getPreferences(){const db=this.#need(),tx=db.transaction('preferences','readonly'),done=txPromise(tx),rows=await requestPromise(tx.objectStore('preferences').getAll());await done;return Object.fromEntries(rows.map(x=>[x.key,x.value]));}
  async setPreferences(values){const db=this.#need(),tx=db.transaction('preferences','readwrite'),done=txPromise(tx),s=tx.objectStore('preferences');for(const [key,value] of Object.entries(values))s.put({key,value});await done;}
  async getSaved(){const db=this.#need(),tx=db.transaction('saved','readonly'),done=txPromise(tx),rows=await requestPromise(tx.objectStore('saved').getAll());await done;return rows.sort((a,b)=>(Number(b.at)||0)-(Number(a.at)||0));}
  async putSaved(row){const db=this.#need(),tx=db.transaction('saved','readwrite'),done=txPromise(tx);tx.objectStore('saved').put(row);await done;}
  async replaceSaved(rows){const db=this.#need(),tx=db.transaction('saved','readwrite'),done=txPromise(tx),s=tx.objectStore('saved');s.clear();for(const row of rows.slice(0,200))s.put(row);await done;}
  async deleteSaved(key){const db=this.#need(),tx=db.transaction('saved','readwrite'),done=txPromise(tx);tx.objectStore('saved').delete(key);await done;}
  async getHistory(){const db=this.#need(),tx=db.transaction('history','readonly'),done=txPromise(tx),rows=await requestPromise(tx.objectStore('history').getAll());await done;return rows.sort((a,b)=>(Number(b.at)||0)-(Number(a.at)||0));}
  async addHistory(row){
    const db=this.#need(),tx=db.transaction('history','readwrite'),done=txPromise(tx),s=tx.objectStore('history'),id=await requestPromise(s.add(row));await done;
    const trimTx=db.transaction('history','readwrite'),trimDone=txPromise(trimTx),ts=trimTx.objectStore('history'),keys=await requestPromise(ts.getAllKeys());const extra=Math.max(0,keys.length-MAX_HISTORY);for(let i=0;i<extra;i++)ts.delete(keys[i]);await trimDone;return id;
  }
  async updateHistoryConfirmation(id,confirmation){const db=this.#need(),rtx=db.transaction('history','readonly'),rdone=txPromise(rtx),row=await requestPromise(rtx.objectStore('history').get(id));await rdone;if(!row)throw new Error('History entry not found');row.confirmation=confirmation??null;const wtx=db.transaction('history','readwrite'),wdone=txPromise(wtx);wtx.objectStore('history').put(row);await wdone;return row;}
  async deleteHistory(id){const db=this.#need(),tx=db.transaction('history','readwrite'),done=txPromise(tx);tx.objectStore('history').delete(id);await done;}
  async clearHistory(){const db=this.#need(),tx=db.transaction('history','readwrite'),done=txPromise(tx);tx.objectStore('history').clear();await done;}
  async getLearning(){const db=this.#need(),tx=db.transaction('learning','readonly'),done=txPromise(tx),rows=await requestPromise(tx.objectStore('learning').getAll());await done;return rows;}
  async putLearning(row){const db=this.#need(),tx=db.transaction('learning','readwrite'),done=txPromise(tx);tx.objectStore('learning').put(row);await done;const trimTx=db.transaction('learning','readwrite'),trimDone=txPromise(trimTx),s=trimTx.objectStore('learning'),rows=await requestPromise(s.getAll());if(rows.length>MAX_LEARNING){rows.sort((a,b)=>(Number(a.updatedAt)||0)-(Number(b.updatedAt)||0));for(const old of rows.slice(0,rows.length-MAX_LEARNING))s.delete(old.fingerprintId);}await trimDone;return row;}
  async deleteLearning(fingerprintId){const db=this.#need(),tx=db.transaction('learning','readwrite'),done=txPromise(tx);tx.objectStore('learning').delete(fingerprintId);await done;}
  async clearLearning(){const db=this.#need(),tx=db.transaction('learning','readwrite'),done=txPromise(tx);tx.objectStore('learning').clear();await done;}
  async replaceLearning(rows=[]){const db=this.#need(),tx=db.transaction('learning','readwrite'),done=txPromise(tx),s=tx.objectStore('learning');s.clear();for(const row of rows.slice(0,MAX_LEARNING))s.put(row);await done;}
  async replacePersonalData({saved=[],history=[],learning=[],preferences={}}={}){
    const db=this.#need(),tx=db.transaction(['saved','history','learning','preferences','meta'],'readwrite'),done=txPromise(tx),ss=tx.objectStore('saved'),hs=tx.objectStore('history'),ls=tx.objectStore('learning'),ps=tx.objectStore('preferences'),ms=tx.objectStore('meta');
    try{
      ss.clear();hs.clear();ls.clear();ps.clear();
      for(const row of saved.slice(0,200))ss.put(row);
      const historyRows=history.slice(-MAX_HISTORY).map(row=>{const {id,...copy}=row||{};return copy;}).sort((a,b)=>(Number(a.at)||0)-(Number(b.at)||0));for(const row of historyRows)hs.add(row);
      for(const row of learning.slice(0,MAX_LEARNING))ls.put(row);
      for(const [key,value] of Object.entries(preferences))ps.put({key,value});
      ms.put({key:'lastRestore',schema:2,at:Date.now(),saved:saved.length,history:historyRows.length,learning:learning.length});
      await done;
    }catch(e){try{tx.abort();}catch{}try{await done;}catch{}throw e;}
  }
  async resetPersonalData(){const db=this.#need(),tx=db.transaction(STORE_NAMES,'readwrite'),done=txPromise(tx);for(const name of STORE_NAMES)tx.objectStore(name).clear();tx.objectStore('meta').put({key:'legacyMigration',complete:true,schema:DB_VERSION,resetAt:Date.now()});await done;}
  close(){try{this.db?.close();}catch{}this.db=null;this.available=false;}
}
export function deletePersonalDatabase(){
  return new Promise((resolve,reject)=>{
    try{const req=indexedDB.deleteDatabase(DB_NAME);req.onsuccess=()=>resolve(true);req.onerror=()=>reject(req.error||new Error('Personal database could not be deleted'));req.onblocked=()=>reject(new Error('Personal database reset is blocked by another AyahOnDevice tab'));}catch(e){reject(e);}
  });
}
export const personalStore=new PersonalStore();
export {DB_NAME,DB_VERSION,MAX_HISTORY,MAX_LEARNING,LEGACY_CLEANUP_KEYS};
