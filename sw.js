const CACHE='thermansi-v27';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon.svg','./sync.js?v=26','./merge-sync.js?v=26'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('thermansi-v')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||!request.url.startsWith(self.registration.scope))return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{
    if(response.status>=500)throw Error('Server unavailable');
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)))}
    return response;
  }).catch(()=>caches.open(CACHE).then(async cache=>await cache.match(request)||await cache.match('./index.html')||Response.error())));
  return;
 }
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));
});
