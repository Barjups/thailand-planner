/* Thai Planner: static shell only. Never cache script.google.com responses or user data. */
const CACHE_NAME='thai-planner-shell-v6';
const SCOPE='/thailand-planner/';
const BASE= SCOPE;
const EXTERNAL_ASSETS=[
  '/thailand-planner/app.js',
  '/thailand-planner/styles.css',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.0/Sortable.min.js'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(async cache=>{
    await cache.add(BASE);
    await Promise.allSettled(EXTERNAL_ASSETS.map(url=>cache.add(url)));
    self.skipWaiting();
  }));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('thai-planner-shell-')&&key!==CACHE_NAME).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.hostname==='script.google.com'||url.hostname.endsWith('.googleusercontent.com'))return;
  if(request.mode==='navigate'&&url.origin===self.location.origin){
    event.respondWith(fetch(request).then(async response=>{
      if(response.ok)(await caches.open(CACHE_NAME)).put(BASE,response.clone());
      return response;
    }).catch(()=>caches.match(BASE)));
    return;
  }
  if(EXTERNAL_ASSETS.includes(url.href)||url.origin===self.location.origin){
    event.respondWith(caches.match(request).then(cached=>{
      const network=fetch(request).then(async response=>{
        if(response.ok||response.type==='opaque'){
          (await caches.open(CACHE_NAME)).put(request,response.clone());
        }
        return response;
      });
      return cached||network;
    }));
  }
});
