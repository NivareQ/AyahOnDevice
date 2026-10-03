const SHELL='ayahondevice-shell-v2.0-stable';
const STATIC=[
 './','./index.html','./styles.css','./app.js','./learning-core.js','./personal-store.js','./i18n.js','./locales/en.js','./locales/bn.js','./manifest.webmanifest','./matcher-core.js','./matcher-worker.js','./runtime-worker.js',
 './runtime/proven-04.js','./runtime/webgpu-2g.js','./runtime/webgpu-4g.js','./assets/icon-32.png','./assets/icon-128.png','./assets/icon-192.png','./assets/icon-512.png','./assets/AyahOnDevice.ico','./assets/fonts/DigitalKhattIndoPak.woff2',
 './data/matcher.json','./data/familiar-ayah.json','./data/arabic/uthmani.json','./data/arabic/indopak.json','./data/arabic/chapters.json',
 './data/translations/english-rwwad.json','./data/translations/english-saheeh.json','./data/translations/english-hilali-khan.json','./data/translations/english-pickthall.json','./data/translations/english-yusuf-ali.json',
 './data/translations/bengali-rwwad.json','./data/translations/bengali-zakaria.json'
];
self.addEventListener('install',e=>e.waitUntil(caches.open(SHELL).then(c=>c.addAll(STATIC)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if((k.startsWith('ayah-finder-shell-')||k.startsWith('ayahondevice-shell-'))&&k!==SHELL)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const u=new URL(e.request.url);
 if(u.origin===location.origin){e.respondWith((async()=>{const c=await caches.open(SHELL);const hit=await c.match(e.request,{ignoreSearch:true});if(hit)return hit;try{const r=await fetch(e.request);if(r.ok)c.put(e.request,r.clone());return r;}catch(err){return hit||Response.error();}})());}
});
