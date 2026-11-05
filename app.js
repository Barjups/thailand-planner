function thaiToggleTheme() {
            const dark = document.documentElement.classList.toggle('dark');
            try { localStorage.setItem('thaiPlannerTheme', dark ? 'dark' : 'light'); } catch (e) {}
            const meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.content = dark ? '#0f172a' : '#ea580c';
        }
        (function () {
            const meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.content = document.documentElement.classList.contains('dark') ? '#0f172a' : '#ea580c';
        })();
        const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxEctxIJynpq1Cy4oF1wOI-75Mlwgyd_NL7IT3v8eIvArkQdXkgwpCQtAj_0jMMAVqDAw/exec";

        let tripData = { days: [], todos: [], notes: [], expenses: [], plannedExpenses: [], flights: [], settings: {tripStart:'2026-12-26',tripEnd:'2027-01-11'} };
        const THAI_DEFAULT_SETTINGS={tripStart:'2026-12-26',tripEnd:'2027-01-11'};

        function formatEUR(amount) {
            const num = parseFloat(amount) || 0;
            const parts = num.toFixed(2).split('.');
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            return parts.join(',') + "€";
        }

        function calculateCountdown() {
            const start=tripData.settings?.tripStart||THAI_DEFAULT_SETTINGS.tripStart;
            const departureDate = new Date(start+'T09:30:00');
            const today = new Date();
            const diffTime = departureDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const badge = document.getElementById('countdown-badge');
            if(badge) {
                if(diffDays > 0) {
                    badge.innerText = `${diffDays} giorni al viaggio`;
                } else if(diffDays === 0) {
                    badge.innerText = `Si parte oggi! ✈️`;
                } else {
                    const finish=tripData.settings?.tripEnd||THAI_DEFAULT_SETTINGS.tripEnd;
                    badge.innerText = Date.now()>new Date(finish+'T23:59:59').getTime()?'Viaggio concluso 🌴':'Buon viaggio in corso! 🌴';
                }
            }
        }

        function thaiOpenTripSettings(){
            const settings=tripData.settings||THAI_DEFAULT_SETTINGS;
            document.getElementById('thai-trip-start').value=settings.tripStart||THAI_DEFAULT_SETTINGS.tripStart;
            document.getElementById('thai-trip-end').value=settings.tripEnd||THAI_DEFAULT_SETTINGS.tripEnd;
            const modal=document.getElementById('thai-trip-settings-modal');modal.classList.remove('hidden');modal.classList.add('flex');
        }
        function thaiCloseTripSettings(){const modal=document.getElementById('thai-trip-settings-modal');modal.classList.add('hidden');modal.classList.remove('flex');}
        function thaiSaveTripSettings(event){
            event.preventDefault();
            const start=document.getElementById('thai-trip-start').value;
            const end=document.getElementById('thai-trip-end').value;
            if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<start){alert('Inserisci date valide: il rientro non può precedere la partenza.');return;}
            tripData.settings={...(tripData.settings||{}),tripStart:start,tripEnd:end};
            thaiCloseTripSettings();saveDataToSheet();renderApp();
        }
        function convertCurrency(source) {
            const eurInput = document.getElementById('eur-input');
            const thbInput = document.getElementById('thb-input');
            const rate = thaiExchangeRate(); 
            if(source === 'eur') {
                const val = parseFloat(eurInput.value);
                thbInput.value = isNaN(val) ? '' : (val * rate).toFixed(0);
            } else {
                const val = parseFloat(thbInput.value);
                eurInput.value = isNaN(val) ? '' : (val / rate).toFixed(2);
            }
        }

        const THAI_FX_CACHE='thai_fx_eur_thb_v2';
        let thaiFxStatus='cache',thaiFxFetching=false;
        function thaiExchangeRate(){
            try{let c=JSON.parse(localStorage.getItem(THAI_FX_CACHE)||'null'),n=Number(c?.rate);if(n>0&&n<1000)return n;}catch(e){}
            const n=Number(localStorage.getItem('thai_exchange_rate')||38.5);return n>0&&n<1000?n:38.5;
        }
        function thaiRenderExchangeRate(){
            const el=document.getElementById('thai-rate-label');if(!el)return;
            let c=null;try{c=JSON.parse(localStorage.getItem(THAI_FX_CACHE)||'null');}catch(e){}
            const label=thaiFxStatus==='loading'?'aggiornamento…':thaiFxStatus==='online'&&c?.date?'agg. '+c.date:c?.date?'ultimo dato '+c.date:'stima offline';
            el.textContent='1 € = '+thaiExchangeRate().toFixed(2)+' THB · '+label;
            el.title='Frankfurter: tasso di riferimento aggiornato giornalmente. Clicca per aggiornare.';
        }
        async function thaiUpdateExchangeRate(force=false){
            if(thaiFxFetching)return;
            let c=null;try{c=JSON.parse(localStorage.getItem(THAI_FX_CACHE)||'null');}catch(e){}
            if(!force&&c?.checkedAt&&Date.now()-c.checkedAt<3600000){thaiFxStatus='online';thaiRenderExchangeRate();return;}
            if(!navigator.onLine){thaiFxStatus='cache';thaiRenderExchangeRate();return;}
            thaiFxFetching=true;thaiFxStatus='loading';thaiRenderExchangeRate();
            try{
                const res=await fetch('https://api.frankfurter.dev/v2/rate/eur/thb',{cache:'no-store'});
                if(!res.ok)throw Error('HTTP '+res.status);
                const q=await res.json(),rate=Number(q.rate);
                if(!(rate>0&&rate<1000)||!/^\d{4}-\d{2}-\d{2}$/.test(String(q.date||'')))throw Error('Formato cambio non valido');
                localStorage.setItem(THAI_FX_CACHE,JSON.stringify({rate,date:q.date,checkedAt:Date.now()}));
                thaiFxStatus='online';
                const eur=document.getElementById('eur-input'),thb=document.getElementById('thb-input');
                if(eur?.value&&document.activeElement!==thb)convertCurrency('eur');
                else if(thb?.value&&document.activeElement!==eur)convertCurrency('thb');
            }catch(e){thaiFxStatus='cache';console.warn('Cambio non disponibile, uso quello memorizzato:',e);}
            finally{thaiFxFetching=false;thaiRenderExchangeRate();}
        }
        function thaiInstallToolsDismiss(){
            const menu=document.getElementById('thai-tools-menu');
            if(!menu||menu.dataset.dismissReady)return;
            menu.dataset.dismissReady='1';
            document.addEventListener('pointerdown',ev=>{if(menu.open&&!menu.contains(ev.target))menu.open=false;});
            document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&menu.open){menu.open=false;menu.querySelector('summary')?.focus();}});
        }
        function updateSyncStatus(status, colorClass) {
            const el = document.getElementById('sync-status');
            if(el) {
                el.innerText = status;
                el.className = `text-[10px] font-semibold px-2 py-0.5 rounded-full ${colorClass}`;
            }
        }

        function switchTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.tab-btn').forEach(el => {
                el.classList.remove('active', 'bg-brand-50', 'text-brand-600', 'dark:bg-brand-900/30');
                el.classList.add('text-slate-600', 'dark:text-slate-300');
            });
            document.getElementById('tab-' + tabId).classList.remove('hidden');
            document.querySelector(`[data-tab="${tabId}"]`).classList.add('active', 'bg-brand-50', 'text-brand-600', 'dark:bg-brand-900/30');
        }

        function closeExpenseModal() {
            document.getElementById('expense-modal').classList.add('hidden');
        }

        const THAI_STORAGE = 'thailandData2026_v5';
        const THAI_PENDING = 'thailandPending_v2';
        let thaiDirty = localStorage.getItem(THAI_PENDING) === '1';
        const THAI_SESSION_KEY='thaiPlannerSession_v1';
        const THAI_BASE_KEY='thaiPlannerSyncedBase_v1';
        let thaiToken=localStorage.getItem(THAI_SESSION_KEY)||'';
        function thaiTokenLooksCurrent(){try{const part=thaiToken.split('.')[0];const payload=JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/')));return Number(payload.exp)>Date.now();}catch(e){return false;}}
        let thaiLoginBusy=false;
        let thaiBase=null;
        try { thaiBase=JSON.parse(localStorage.getItem(THAI_BASE_KEY)||'null'); } catch(e){}
        function thaiStoreBase(data){
            thaiBase=structuredClone(data);
            try{localStorage.setItem(THAI_BASE_KEY,JSON.stringify(thaiBase));}catch(e){console.warn('Base sync non salvata',e);}
        }
        async function thaiLogout(){
            if(thaiDirty){alert('Ci sono modifiche da sincronizzare: attendi il salvataggio prima di uscire.');return;}
            const old=thaiToken;
            try{if(old)await thaiApi({action:'logout',_sessionToken:old});}
            catch(e){alert('Impossibile revocare la sessione sul server. Riprova quando sei online.');return;}
            thaiToken='';localStorage.removeItem(THAI_SESSION_KEY);localStorage.removeItem(THAI_STORAGE);localStorage.removeItem(THAI_BASE_KEY);thaiBase=null;tripData={days:[],todos:[],notes:[],expenses:[],plannedExpenses:[],flights:[]};renderApp();
            alert('Sessione revocata. Al prossimo accesso servirà il codice.');
        }
        async function thaiApi(input){
            const response=await fetch(GOOGLE_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({_sessionToken:thaiToken,...input}),cache:'no-store'});
            if(!response.ok)throw Error('HTTP '+response.status);
            return response.json();
        }
        async function thaiReadRemote(){return thaiApi({action:'read'});}
        async function thaiAskAccessKey(){
            if(thaiLoginBusy)return false;
            const key=prompt('Inserisci il codice di accesso Thai Planner (solo al primo accesso su questo dispositivo):');
            if(key===null || !key.trim())return false;
            thaiLoginBusy=true;
            try{
                const r=await fetch(GOOGLE_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'login',_accessKey:key.trim()})});
                const d=await r.json();
                if(d.status!=='success'||!d.token)throw Error(d.message||'Accesso non riuscito');
                thaiToken=d.token;localStorage.setItem(THAI_SESSION_KEY,thaiToken);
                return true;
            }catch(e){alert('Accesso non riuscito: '+e.message);return false;}
            finally{thaiLoginBusy=false;}
        }
        async function thaiAuthError(d){
            if(d && (d.status==='unauthorized'||d.status==='setup_required')){
                if(d.status==='setup_required'){alert(d.message);return true;}
                thaiToken='';localStorage.removeItem(THAI_SESSION_KEY);
                updateSyncStatus('🔒 Accesso richiesto','bg-amber-100 text-amber-800');
                if(await thaiAskAccessKey())setTimeout(()=>thaiDirty?thaiSyncPending():fetchDataFromSheet(),50);
                return true;
            }
            return false;
        }
        let thaiSaving = false;
        let thaiSequence = 0;
        let thaiContext = null;
        let thaiSyncTimer = null;
        let thaiConflict = false;
        let thaiLoadStarted = false;
        let thaiSyncError='';
        let thaiSummaryDay = 0;

        const thaiEsc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        function thaiUrl(value, isMap=false) {
            const raw = String(value ?? '').trim();
            if (!raw) return '';
            let candidate = raw;
            if (/^\/\//.test(candidate)) candidate = 'https:' + candidate;
            else if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate) &&
                     /^(?:www\.|(?:[a-z0-9-]+\.)+[a-z]{2,})(?:[\/:?#]|$)/i.test(candidate)) {
                candidate = 'https://' + candidate;
            } else if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
                return isMap ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(raw) : '';
            }
            try {
                const url = new URL(candidate);
                return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname ? url.href : '';
            } catch (_) { return ''; }
        }
        const thaiLink = (v, label='Apri link') => {
            const u = thaiUrl(v, label === 'Google Maps');
            return u ? `<a href="${thaiEsc(u)}" target="_blank" rel="noopener noreferrer" class="text-brand-600 underline font-semibold inline-flex items-center gap-1 py-1" aria-label="${thaiEsc(label)} (apri collegamento esterno)">${thaiEsc(label)} ↗</a>` : '';
        };
        const thaiHotelAddress = (address) => {
            const val=String(address??'').trim();
            if(!val)return '';
            const href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(val);
            return `<a href="${thaiEsc(href)}" target="_blank" rel="noopener noreferrer" class="thai-hotel-map-link" aria-label="Apri indirizzo hotel su Google Maps">📍 ${thaiEsc(val)} <span aria-hidden="true">↗</span></a>`;
        };
        const thaiBtn = (label, handler, cls='', title='') => `<button type="button" onclick="${handler}" class="thai-action ${cls}" ${title?`title="${thaiEsc(title)}"`:''}>${label}</button>`;
        const thaiValid = d => d && typeof d === 'object' && Array.isArray(d.days) && Array.isArray(d.todos) && Array.isArray(d.notes) && (d.expenses === undefined || Array.isArray(d.expenses)) && (d.plannedExpenses === undefined || Array.isArray(d.plannedExpenses)) && (d.flights === undefined || Array.isArray(d.flights));
        function thaiNormalize(d) {
            if(!d.settings||typeof d.settings!=='object')d.settings={};
            d.settings={...THAI_DEFAULT_SETTINGS,...d.settings};
            if (!Array.isArray(d.expenses)) d.expenses=[];
            if(!Array.isArray(d.plannedExpenses))d.plannedExpenses=[];
            if(!Array.isArray(d.flights))d.flights=[];
            d.days.forEach(day => { if(!Array.isArray(day.activities)) day.activities=[]; if(!Array.isArray(day.transports)) day.transports=[]; });
            return d;
        }
        function thaiPersist() {
            try { localStorage.setItem(THAI_STORAGE, JSON.stringify(tripData)); localStorage.setItem(THAI_PENDING, '1'); return true; }
            catch(e) { updateSyncStatus('⚠️ Memoria piena: esporta JSON', 'bg-red-100 text-red-700'); alert('Impossibile salvare nel telefono: esporta il JSON prima di proseguire.'); return false; }
        }
        function thaiShowSync() {
            document.getElementById('thai-conflict-button')?.classList.toggle('hidden',!thaiConflict);
            if(thaiConflict) updateSyncStatus('⚠️ Conflitto dati: esporta JSON', 'bg-red-100 text-red-700');
            else if(thaiDirty) updateSyncStatus(thaiSyncError || (navigator.onLine ? '💾 Modifiche da sincronizzare' : '📴 Salvato offline'), 'bg-sky-100 text-sky-800');
            else updateSyncStatus('✅ Sincronizzato', 'bg-emerald-100 text-emerald-700');
        }
        function initApp() {
            calculateCountdown();thaiRenderExchangeRate();thaiInstallToolsDismiss();thaiUpdateExchangeRate();
            setInterval(()=>{if(!document.hidden)thaiUpdateExchangeRate();},3600000);
            if('serviceWorker' in navigator)navigator.serviceWorker.register('/thailand-planner/sw.js').catch(e=>console.warn('Offline shell:',e));
            try { const cache=JSON.parse(localStorage.getItem(THAI_STORAGE)||'null'); if(thaiTokenLooksCurrent() && thaiValid(cache)) { tripData=thaiNormalize(cache); renderApp(); } } catch(e) { console.warn('Cache non valida',e); }
            if(thaiDirty) { thaiShowSync(); if(navigator.onLine) setTimeout(thaiSyncPending,500); }
            else fetchDataFromSheet();
            setInterval(()=>{if(!document.hidden && navigator.onLine && !thaiEditingVisible()){if(thaiDirty)thaiSyncPending();else fetchDataFromSheet();}},15000);
        }
        async function fetchDataFromSheet() {
            if(thaiDirty || thaiSaving) { thaiShowSync(); return; }
            if(thaiLoadStarted) return;
            thaiLoadStarted=true;
            updateSyncStatus('⌛ Caricamento...', 'bg-sky-100 text-sky-800');
            try {
                const data=await thaiReadRemote();
                if(await thaiAuthError(data))return;
                if(!thaiValid(data)) throw Error(data.message || 'Dati server non validi');
                if(thaiDirty) { thaiShowSync(); return; }
                if(thaiBase && Number(thaiBase._revision)===Number(data._revision)){thaiShowSync();return;}
                tripData=thaiNormalize(data);
                calculateCountdown();
                thaiStoreBase(tripData);
                localStorage.setItem(THAI_STORAGE,JSON.stringify(tripData));
                renderApp(); thaiShowSync();
            } catch(e) { console.warn('Lettura remota non riuscita',e); updateSyncStatus('📴 Dati locali / connessione assente','bg-sky-100 text-sky-800'); }
            finally { thaiLoadStarted=false; }
        }
        function saveDataToSheet() {
            thaiSequence++; thaiDirty=true;
            if(!thaiPersist()) return;
            thaiShowSync();
            clearTimeout(thaiSyncTimer);
            thaiSyncTimer=setTimeout(thaiSyncPending,350);
        }
        const THAI_SYNC_LISTS=['days','todos','notes','expenses','plannedExpenses','flights'];
        function thaiFingerprint(v){return JSON.stringify(v);}
        function thaiMergeArray(base,local,remote){
            if(thaiFingerprint(local)===thaiFingerprint(base))return remote;
            if(thaiFingerprint(remote)===thaiFingerprint(base))return local;
            if(thaiFingerprint(local)===thaiFingerprint(remote))return local;
            if(local.length<base.length || remote.length<base.length)return null;
            for(let i=0;i<base.length;i++){
                if(thaiFingerprint(local[i])!==thaiFingerprint(base[i]) || thaiFingerprint(remote[i])!==thaiFingerprint(base[i]))return null;
            }
            const addedLocal=local.slice(base.length), addedRemote=remote.slice(base.length);
            return [...base,...addedRemote,...addedLocal];
        }
        function thaiThreeWayMerge(base,local,remote){
            if(!base || !thaiValid(base))return null;
            const out=structuredClone(remote);
            for(const field of THAI_SYNC_LISTS){
                const merged=thaiMergeArray(base[field]||[],local[field]||[],remote[field]||[]);
                if(merged===null)return null;
                out[field]=merged;
            }
            for(const field of Object.keys(local)){
                if(THAI_SYNC_LISTS.includes(field)||field==='_revision')continue;
                const changedLocal=thaiFingerprint(local[field])!==thaiFingerprint(base[field]);
                const changedRemote=thaiFingerprint(remote[field])!==thaiFingerprint(base[field]);
                if(changedLocal&&changedRemote&&thaiFingerprint(local[field])!==thaiFingerprint(remote[field]))return null;
                if(changedLocal)out[field]=structuredClone(local[field]);
            }
            out._revision=remote._revision;
            return out;
        }
        async function thaiAutoMerge(localSnapshot,expectedSequence){
            if(!thaiBase)return false;
            const remote=await thaiReadRemote();
            if(await thaiAuthError(remote))return false;
            if(!thaiValid(remote))throw Error('Impossibile leggere il server');
            const merged=thaiThreeWayMerge(thaiBase,localSnapshot,remote);
            if(!merged || thaiSequence!==expectedSequence)return false;
            thaiStoreBase(remote);
            tripData=thaiNormalize(merged);
            thaiConflict=false;
            thaiDirty=true;thaiSequence++;
            thaiPersist();renderApp();
            return true;
        }
        async function thaiSyncPending() {
            if(!thaiDirty || thaiSaving || !navigator.onLine || thaiConflict) { thaiShowSync(); return; }
            thaiSaving=true;
            const seq=thaiSequence;
            const payload=JSON.stringify(tripData);
            updateSyncStatus('⌛ Invio modifiche...', 'bg-sky-100 text-sky-800');
            try {
                const res=await fetch(GOOGLE_SCRIPT_URL, {method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({...JSON.parse(payload),_sessionToken:thaiToken})});
                if(!res.ok) throw Error('HTTP '+res.status);
                const ack=await res.json();
                if(await thaiAuthError(ack))return;
                if(ack.status==='conflict') {
                    if(await thaiAutoMerge(JSON.parse(payload),seq)){thaiSyncError='';return;}
                    thaiConflict=true;
                    throw Error('Modifiche allo stesso elemento: usa Risolvi conflitto. I tuoi dati locali sono conservati.');
                }
                if(ack.status!=='success') throw Error(ack.message || 'Salvataggio non confermato');
                if(Number.isInteger(ack.revision)) tripData._revision=ack.revision;
                thaiStoreBase({...JSON.parse(payload),_revision:ack.revision});
                if(seq===thaiSequence) {
                    thaiSyncError='';thaiDirty=false;
                    localStorage.removeItem(THAI_PENDING);
                    localStorage.setItem(THAI_STORAGE,JSON.stringify(tripData));
                } else {
                    localStorage.setItem(THAI_STORAGE,JSON.stringify(tripData));
                }
                thaiShowSync();
            } catch(e) { console.warn('Salvataggio non confermato:',e);thaiSyncError='⚠️ Salvataggio non confermato'; thaiShowSync(); }
            finally { thaiSaving=false; if(thaiDirty && !thaiConflict && seq!==thaiSequence) setTimeout(thaiSyncPending,200); }
        }
        window.addEventListener('online',()=>{ thaiUpdateExchangeRate(true); if(thaiDirty) thaiSyncPending(); else fetchDataFromSheet(); });
        window.addEventListener('offline',thaiShowSync);
        document.addEventListener('visibilitychange',()=>{if(!document.hidden){thaiUpdateExchangeRate();if(thaiDirty)thaiSyncPending(); else fetchDataFromSheet();}});

        const THAI_FIELDS = {
          day:[['date','Data (es. 2026-12-27 oppure 27 dic)','text'],['title','Titolo tappa','text',true],['notes','Note della giornata','textarea'],['transport_details','Vecchia descrizione trasporti (puoi cancellarla)','textarea'],['link','Link prenotazione','url'],['cost','Costo generico precedente (senza categoria; cancellabile)','text']],
          activity:[['title','Attività','text',true],['start','Ora inizio','time'],['end','Ora fine','time'],['desc','Descrizione / note','textarea'],['cost','Costo totale attività','number'],['costCurrency','Valuta del costo','select',false,['THB','EUR']],['maps','Link Google Maps','url'],['link','Altro link','url']],
          transport:[['type','Mezzo di trasporto','select',false,['Aereo','Treno','Bus','Traghetto','Taxi','Auto','Altro']],['from','Partenza da','text',true],['to','Destinazione','text',true],['departure','Orario partenza','time'],['arrival','Orario arrivo','time'],['date','Data (facoltativa)','text'],['cost','Costo trasporto (€)','number'],['status','Stato','select',false,['Da prenotare','Prenotato','Completato']],['reference','Codice prenotazione','text'],['link','Link biglietto / prenotazione','url'],['notes','Note','textarea']],
          hotel:[['name','Nome hotel','text'],['address','Indirizzo','text'],['checkin','Check-in (data e ora)','text'],['checkout','Check-out (data e ora)','text'],['cost','Prezzo totale hotel (€)','number'],['cancellation','Condizioni di cancellazione (es. Gratis fino al 20/12)','text'],['status','Stato','select',false,['Da prenotare','Prenotato','Completato']],['reference','Codice prenotazione','text'],['link','Link Booking / struttura','url'],['notes','Note','textarea']],
          todo:[['text','Cosa devi fare?','textarea',true],['due','Scadenza (facoltativa)','date'],['owner','Assegnato a','select',false,['Entrambe','Barbara','Laura']]],
          note:[['title','Titolo nota','text',true],['text','Contenuto','textarea'],['link','Link utile','url']]
        };
        function thaiFieldHtml(spec, value) {
            const [key,label,type,required,options]=spec; const id='thai-field-'+key;
            const attributes=`id="${id}" name="${key}" class="thai-field" ${required?'required':''}`;
            const v=thaiEsc(value ?? '');
            let control;
            if(type==='textarea') control=`<textarea ${attributes} rows="3">${v}</textarea>`;
            else if(type==='select') control=`<select ${attributes}>${options.map(o=>`<option value="${thaiEsc(o)}" ${o===value?'selected':''}>${thaiEsc(o)}</option>`).join('')}</select>`;
            else control=`<input type="${type==='url'?'text':type}" ${attributes} ${type==='url'?'inputmode="url" autocapitalize="off" autocorrect="off"':''} value="${v}" ${type==='number'?'min="0" step="0.01"':''}>`;
            return `<div><label class="thai-label" for="${id}">${thaiEsc(label)}</label>${control}</div>`;
        }
        function thaiOpen(kind,dayIndex=-1,itemIndex=-1) {
            const titles={day:'Giornata',activity:'Attività',transport:'Spostamento',hotel:'Hotel',todo:'To Do',note:'Nota'};
            let item={}; const day=tripData.days[dayIndex];
            if(kind==='day') item=itemIndex>=0?day:{};
            else if(kind==='activity') item=day.activities[itemIndex]||{};
            else if(kind==='transport') item=day.transports[itemIndex]||{};
            else if(kind==='hotel') item={status:day.hotel_status==='Prenotato'?'Prenotato':'Da prenotare',link:day.link||'',cancellation:day.cancellation||'',...(day.hotel||{})};
            else if(kind==='todo') item=tripData.todos[itemIndex]||{};
            else if(kind==='note') item=tripData.notes[itemIndex]||{};
            thaiContext={kind,dayIndex,itemIndex};
            document.getElementById('thai-modal-title').textContent=(itemIndex>=0 || (kind==='hotel' && day.hotel) ? 'Modifica ':'Aggiungi ')+titles[kind];
            document.getElementById('thai-modal-fields').innerHTML=THAI_FIELDS[kind].map(f=>thaiFieldHtml(f,item[f[0]])).join('');
            const modal=document.getElementById('thai-modal'); modal.classList.remove('hidden');modal.classList.add('flex');
            modal.querySelector('input,textarea,select')?.focus();
        }
        function closeThaiModal(){const m=document.getElementById('thai-modal');m.classList.add('hidden');m.classList.remove('flex');thaiContext=null;}
        function thaiActivityForecastSync(activity,day){
            const amt=activity.cost===''||activity.cost==null?0:Number(activity.cost);
            const currency=activity.costCurrency==='THB'?'THB':'EUR';
            const id=activity._budgetId;
            const planned=tripData.plannedExpenses||[];
            const paid=tripData.expenses||[];
            const planIndex=id?planned.findIndex(x=>x._sourceId===id):-1;
            const paidEntry=id?paid.find(x=>x._sourceId===id):null;
            if(!Number.isFinite(amt)||amt<0)return;
            if(paidEntry){
                if(planIndex>=0)planned.splice(planIndex,1);
                return;
            }
            if(amt<=0){
                if(planIndex>=0)planned.splice(planIndex,1);
                return;
            }
            if(!activity._budgetId)activity._budgetId='activity-'+Date.now()+'-'+Math.random().toString(36).slice(2,9);
            const rate=currency==='THB'?thaiExchangeRate():1;
            const euro=Math.round((currency==='THB'?amt/rate:amt)*100)/100;
            const row={
                title:'Attività · '+(activity.title||activity.desc||day.title||'Senza nome'),
                amount:euro,category:'Attività',split:'uguale',
                _sourceId:activity._budgetId,
                _originalAmount:amt,_originalCurrency:currency,_conversionRate:rate
            };
            const existing=planned.findIndex(x=>x._sourceId===activity._budgetId);
            if(existing>=0)planned[existing]={...planned[existing],...row};
            else planned.push(row);
        }

        function thaiTransportForecastSync(transport, day){
            const amt=transport.cost==null||transport.cost===''?0:Number(transport.cost);
            if(!Number.isFinite(amt)||amt<0)return;
            if(!transport._budgetId&&amt>0)transport._budgetId='transport-'+Date.now()+'-'+Math.random().toString(36).slice(2,9);
            if(!transport._budgetId)return;
            const id=transport._budgetId;
            const planned=tripData.plannedExpenses||[];
            const existing=planned.findIndex(x=>x._sourceId===id);
            if((tripData.expenses||[]).some(x=>x._sourceId===id)||amt===0){
                if(existing>=0)planned.splice(existing,1);
                return;
            }
            const row={title:'Trasporto · '+(transport.from||'?')+' → '+(transport.to||'?'),amount:amt,category:'Trasporti',split:'uguale',_sourceId:id};
            if(existing>=0)planned[existing]={...planned[existing],...row};else planned.push(row);
        }
        function thaiRemoveBookingForecast(item){
            if(!item?._budgetId)return;
            tripData.plannedExpenses=(tripData.plannedExpenses||[]).filter(e=>e._sourceId!==item._budgetId);
            // Le spese effettivamente pagate restano nello storico anche se la prenotazione viene eliminata.
        }
        function thaiHotelForecastSync(hotel, day, dayIndex) {
            const amt = hotel.cost === '' || hotel.cost == null ? 0 : Number(hotel.cost);
            const id = hotel._budgetId;
            const planned = tripData.plannedExpenses || [];
            const paid = tripData.expenses || [];
            const planIndex = id ? planned.findIndex(x => x._sourceId === id) : -1;
            const paidEntry = id ? paid.find(x => x._sourceId === id) : null;

            if (!Number.isFinite(amt) || amt < 0) return;
            
            if (paidEntry) {
                if (planIndex >= 0) planned.splice(planIndex, 1);
                return;
            }

            if (amt <= 0) {
                if (planIndex >= 0) planned.splice(planIndex, 1);
                return;
            }

            if (!hotel._budgetId) {
                hotel._budgetId = 'hotel-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
            }

            const title = 'Hotel · ' + (hotel.name || day.title || ('Giorno ' + (day.id || dayIndex + 1)));
            const row = {
                title: title,
                amount: amt,
                category: 'Hotel',
                split: 'uguale',
                _sourceId: hotel._budgetId
            };

            const existing = planned.findIndex(x => x._sourceId === hotel._budgetId);
            if (existing >= 0) {
                planned[existing] = { ...planned[existing], ...row };
            } else {
                planned.push(row);
            }
        }

        function thaiRemoveHotelForecast(hotel){thaiRemoveBookingForecast(hotel);}
        function thaiRemoveActivityForecast(activity){thaiRemoveBookingForecast(activity);}
        function thaiActivityCostText(a){
            const n=Number(a?.cost);
            if(a?.cost==null||a.cost===''||!Number.isFinite(n)||n<=0)return '';
            const curr=a.costCurrency==='THB'?'THB':'EUR';
            const original=n.toLocaleString('it-IT',{minimumFractionDigits:curr==='EUR'?2:0,maximumFractionDigits:2});
            const planned=(tripData.plannedExpenses||[]).find(x=>x._sourceId===a._budgetId);
            const paid=(tripData.expenses||[]).some(x=>x._sourceId===a._budgetId);
            const extra=curr==='THB'&&planned?' · ≈ '+formatEUR(planned.amount):'';
            return '<p class="thai-activity-cost">💰 Costo previsto: '+original+' '+(curr==='EUR'?'€':'THB')+extra+(paid?' · Pagato':'')+'</p>';
        }
        function saveThaiModal(e){
            e.preventDefault(); if(!thaiContext) return;
            const {kind,dayIndex,itemIndex}=thaiContext;
            const data={};THAI_FIELDS[kind].forEach(([k,,type])=>{
                const raw=document.getElementById('thai-field-'+k).value.trim();
                data[k]=type==='number'?(raw===''?'':Number(raw)):raw;
            });
            for (const key of ['link','maps']) {
                if (data[key]) {
                    const url = thaiUrl(data[key], key === 'maps');
                    if (!url) { alert('Link non valido: inserisci un indirizzo web oppure, per Google Maps, il nome del luogo.'); return; }
                    data[key] = url;
                }
            }
            if(kind==='day') {
                if(itemIndex>=0) Object.assign(tripData.days[dayIndex],data);
                else tripData.days.push({id:Math.max(0,...tripData.days.map(x=>Number(x.id)||0))+1, ...data, activities:[],transports:[],hotel_status:'Da Prenotare',transport_status:'Da Prenotare'});
            } else if(kind==='activity') {
                const arr=tripData.days[dayIndex].activities;
                if(itemIndex>=0) arr[itemIndex]={...arr[itemIndex],...data};
                else thaiAppendActivity(tripData.days[dayIndex],data);
                thaiActivityForecastSync(itemIndex>=0?arr[itemIndex]:arr[arr.length-1],tripData.days[dayIndex]);
            } else if(kind==='transport') {
                const arr=tripData.days[dayIndex].transports;
                if(itemIndex>=0) arr[itemIndex]={...arr[itemIndex],...data}; else arr.push(data);
                thaiTransportForecastSync(itemIndex>=0?arr[itemIndex]:arr[arr.length-1],tripData.days[dayIndex]);
                tripData.days[dayIndex].transport_status=arr.length && arr.every(x=>x.status==='Prenotato'||x.status==='Completato')?'Prenotato':'Da Prenotare';
            } else if(kind==='hotel') {
                const day=tripData.days[dayIndex]; day.hotel={...(day.hotel||{}),...data};
                day.hotel_status=data.status==='Prenotato'||data.status==='Completato'?'Prenotato':'Da Prenotare';
                day.cancellation=data.cancellation || '';
                day.link=data.link || '';
                thaiHotelForecastSync(day.hotel, day, dayIndex);
            } else if(kind==='todo') {
                if(itemIndex>=0) tripData.todos[itemIndex]={...tripData.todos[itemIndex],...data}; else tripData.todos.push({...data,done:false});
            } else if(kind==='note') {
                if(itemIndex>=0) tripData.notes[itemIndex]={...tripData.notes[itemIndex],...data}; else tripData.notes.push(data);
            }
            closeThaiModal(); saveDataToSheet(); renderApp();
        }
        function openDayModal(i=-1){ thaiOpen('day',i,i); }
        function openActivityModal(d,a=-1){thaiOpen('activity',d,a);}
        function openTransportModal(d,t=-1){thaiOpen('transport',d,t);}
        function openHotelModal(d){thaiOpen('hotel',d);}
        function thaiDeleteHotel(dayIndex) {
            const day = tripData.days[dayIndex];
            if (!day) return;
            if (!confirm('Eliminare l’hotel da questa giornata? Verranno rimossi anche il link di prenotazione e le condizioni di cancellazione associate. Le altre informazioni non saranno modificate.')) return;
            thaiRemoveHotelForecast(day.hotel);
            delete day.hotel;
            delete day.hotel_status;
            delete day.cancellation;
            delete day.link;
            saveDataToSheet();
            renderApp();
        }

        // Sposta hotel, trasporti, singola attività o TUTTE le attività a un altro giorno
        let thaiMoveContext = null;
        function thaiOpenMove(kind, dayIndex, itemIndex=-1) {
            const source = tripData.days[dayIndex];
            if (!source || !['hotel','transport','activity','all_activities'].includes(kind)) return;
            if (kind === 'hotel' && !(source.hotel || source.link || source.cancellation || source.hotel_status === 'Prenotato')) return;
            if (kind === 'transport' && !(source.transports || [])[itemIndex]) return;
            if (kind === 'activity' && !(source.activities || [])[itemIndex]) return;
            if (kind === 'all_activities' && !(source.activities || []).length) return;
            if (tripData.days.length < 2) { alert('Aggiungi prima un altro giorno all’itinerario.'); return; }
            
            const destinations = tripData.days.map((d,i)=>({d,i})).filter(x=>x.i!==dayIndex);
            const select = document.getElementById('thai-move-destination');
            select.innerHTML = destinations.map(({d,i})=>`<option value="${i}">Giorno ${thaiEsc(d.id||i+1)} · ${thaiEsc(d.date||'')} · ${thaiEsc(d.title||'Tappa')}</option>`).join('');
            
            let label = '';
            if (kind === 'hotel') label = source.hotel?.name || 'Hotel';
            else if (kind === 'transport') label = thaiTransportLabel(source.transports[itemIndex]);
            else if (kind === 'activity') label = source.activities[itemIndex]?.title || source.activities[itemIndex]?.desc || 'Attività';
            else if (kind === 'all_activities') label = `${source.activities.length} attività del giorno`;

            const titles = {
                hotel: 'Sposta hotel',
                transport: 'Sposta spostamento',
                activity: 'Sposta attività',
                all_activities: 'Sposta tutte le attività'
            };
            document.getElementById('thai-move-title').textContent = titles[kind];
            document.getElementById('thai-move-description').textContent = label + ' · dal giorno ' + (source.date || source.id || dayIndex+1);
            
            thaiMoveContext = {kind, dayIndex, itemIndex};
            const modal = document.getElementById('thai-move-modal');
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            select.focus();
        }
        function thaiCloseMove() {
            const modal=document.getElementById('thai-move-modal');
            modal.classList.add('hidden');modal.classList.remove('flex');
            thaiMoveContext=null;
        }
        function thaiRecomputeTransportStatus(day) {
            const arr=day.transports||[];
            day.transport_status=arr.length && arr.every(t=>['Prenotato','Completato'].includes(t.status))?'Prenotato':'Da Prenotare';
        }
        function thaiConfirmMove(event) {
            event.preventDefault();
            if(!thaiMoveContext) return;
            const {kind, dayIndex, itemIndex} = thaiMoveContext;
            const to = Number(document.getElementById('thai-move-destination').value);
            if(!Number.isInteger(to) || to<0 || to>=tripData.days.length || to===dayIndex) return;
            const source = tripData.days[dayIndex], target = tripData.days[to];

            if(kind==='hotel') {
                if(target.hotel || target.link || target.cancellation || target.hotel_status==='Prenotato') {
                    alert('Il giorno scelto ha già un hotel. Spostalo o eliminalo prima per evitare sovrascritture.');
                    return;
                }
                if(source.hotel) target.hotel = source.hotel;
                for(const key of ['hotel_status','cancellation','link']) {
                    if(source[key]!==undefined) target[key] = source[key];
                    delete source[key];
                }
                delete source.hotel;
            } else if(kind==='transport') {
                const moved = source.transports.splice(itemIndex,1)[0];
                if(!moved) return;
                if(!Array.isArray(target.transports)) target.transports = [];
                target.transports.push(moved);
                thaiTransportForecastSync(moved,target);
                thaiRecomputeTransportStatus(source);
                thaiRecomputeTransportStatus(target);
            } else if(kind==='activity') {
                const moved = source.activities.splice(itemIndex,1)[0];
                if(!moved) return;
                if(!Array.isArray(target.activities)) target.activities = [];
                thaiAppendActivity(target,moved);
                thaiActivityForecastSync(moved, target);
            } else if(kind==='all_activities') {
                const movedList = source.activities.splice(0, source.activities.length);
                if(!Array.isArray(target.activities)) target.activities = [];
                movedList.forEach(act => {
                    thaiAppendActivity(target,act);
                    thaiActivityForecastSync(act, target);
                });
            }

            thaiCloseMove();
            saveDataToSheet();
            renderApp();
        }
        function openTodoModal(i=-1){thaiOpen('todo',-1,i);}
        function openNoteModal(i=-1){thaiOpen('note',-1,i);}
        function addActivityPrompt(d){openActivityModal(d);}
        function editActivityPrompt(d,a){openActivityModal(d,a);}
        function addTodoPrompt(){openTodoModal();}
        function editTodoPrompt(i){openTodoModal(i);}
        function addNotePrompt(){openNoteModal();}
        function editNotePrompt(i){openNoteModal(i);}
        function addDayPrompt(){openDayModal();}
        function editDayPrompt(i){openDayModal(i);}
        function toggleHotelStatus(i){openHotelModal(i);}
        function toggleTransportStatus(i){openTransportModal(i);}
        function thaiDelete(kind,d,i){
            if(!confirm(kind==='day'?'Eliminare tutta la giornata, incluse attività, hotel e trasporti? Verranno rimosse le previsioni collegate, ma le spese già pagate resteranno nel budget.':'Eliminare questo elemento?'))return;
            if(kind==='transport'){thaiRemoveBookingForecast(tripData.days[d].transports[i]);tripData.days[d].transports.splice(i,1);thaiRecomputeTransportStatus(tripData.days[d]);}
            else if(kind==='activity'){thaiRemoveActivityForecast(tripData.days[d].activities[i]);tripData.days[d].activities.splice(i,1);}
            else if(kind==='day'){const day=tripData.days[d];(day.activities||[]).forEach(thaiRemoveActivityForecast);(day.transports||[]).forEach(thaiRemoveBookingForecast);thaiRemoveHotelForecast(day.hotel);tripData.days.splice(d,1);}
            else if(kind==='todo')tripData.todos.splice(i,1);
            else if(kind==='note')tripData.notes.splice(i,1);
            else if(kind==='expense')tripData.expenses.splice(i,1);
            saveDataToSheet();renderApp();
        }
        function deleteDay(d){thaiDelete('day',d,0);}
        function deleteActivity(d,i){thaiDelete('activity',d,i);}
        function deleteTodo(i){thaiDelete('todo',0,i);}
        function deleteNote(i){thaiDelete('note',0,i);}
        function deleteExpense(i){thaiDelete('expense',0,i);}
        function thaiTransportLabel(t){return `${thaiEsc(t.type||'Trasporto')} · ${thaiEsc(t.from||'?')} → ${thaiEsc(t.to||'?')}`;}

        function thaiTripStartISO(){return tripData.settings?.tripStart||THAI_DEFAULT_SETTINGS.tripStart;}
        function thaiInferYear(month){
            const start=thaiTripStartISO(),year=Number(start.slice(0,4)),startMonth=Number(start.slice(5,7));
            return month<startMonth&&startMonth-month>=6?year+1:month>startMonth&&month-startMonth>=6?year-1:year;
        }
        function thaiDateKey(value) {
            if(!value) return null;
            const raw=String(value).trim().toLowerCase();
            let d,m,y;
            const iso=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
            const numeric=raw.match(/^(\d{1,2})[\/\.\-](\d{1,2})(?:[\/\.\-](\d{2,4}))?/);
            const months={gen:1,genn:1,jan:1,feb:2,febbraio:2,mar:3,apr:4,mag:5,may:5,giu:6,jun:6,lug:7,jul:7,ago:8,aug:8,set:9,sep:9,ott:10,oct:10,nov:11,dic:12,dec:12};
            const named=raw.match(/^(\d{1,2})\s+([a-zà-ÿ]+)(?:\s+(\d{4}))?/);
            if(iso){y=Number(iso[1]);m=Number(iso[2]);d=Number(iso[3]);}
            else if(numeric){d=Number(numeric[1]);m=Number(numeric[2]);y=numeric[3]?Number(numeric[3]):thaiInferYear(m);}
            else if(named){d=Number(named[1]);m=months[named[2].slice(0,3)];y=named[3]?Number(named[3]):thaiInferYear(m);}
            else return null;
            if(y<100)y+=2000;
            const ms=Date.UTC(y,m-1,d);
            const check=new Date(ms);
            return check.getUTCFullYear()===y && check.getUTCMonth()===m-1 && check.getUTCDate()===d ? ms : null;
        }
        function thaiHotelStaysForDay(dayIndex) {
            const days=tripData.days||[];
            const current=days[dayIndex];
            if(!current)return [];
            const currentDate=thaiDateKey(current.date);
            if(currentDate===null)return [];
            const results=[];
            for(let i=0;i<days.length;i++) {
                const hotel=days[i].hotel;
                if(!hotel || !hotel.name)continue;
                const start=thaiDateKey(hotel.checkin) ?? thaiDateKey(days[i].date);
                const end=thaiDateKey(hotel.checkout);
                if(start===null)continue;
                if(end!==null && end<=start)continue;
                if(end!==null && currentDate===end){
                    results.push({sourceIndex:i,hotel,checkout:true});
                } else if(currentDate>=start && (end===null ? currentDate===start : currentDate<end)) {
                    results.push({sourceIndex:i,hotel,checkout:false});
                }
            }
            return results.sort((x,y)=>Number(y.checkout)-Number(x.checkout));
        }
        function thaiHotelStayForDay(dayIndex) {
            const stays=thaiHotelStaysForDay(dayIndex);
            return stays.find(s=>!s.checkout) || stays[0] || null;
        }
        function thaiHotelNightLabel(h, dayDate) {
            const current=thaiDateKey(dayDate), start=thaiDateKey(h?.checkin), end=thaiDateKey(h?.checkout);
            if(current===null || start===null || current<start || (end!==null && current>=end))return '';
            const number=Math.round((current-start)/86400000)+1;
            const nights=end===null?null:Math.round((end-start)/86400000);
            if(nights!==null && number===nights)return 'Ultima notte · '+number+'ª notte';
            return number+'ª notte';
        }
        function thaiSharedHotelCard(stay, currentDate) {
            if (!stay) return '';
            const h=stay.hotel;
            const source=tripData.days[stay.sourceIndex];
            const isCheckin=!stay.checkout && thaiDateKey(h.checkin)!==null && thaiDateKey(h.checkin)===thaiDateKey(currentDate);
            const title=stay.checkout?'🧳 Check-out oggi':isCheckin?'🏨 Check-in oggi':(['Prenotato','Completato'].includes(h.status)?'🏨 Hotel prenotato':'🏨 Hotel previsto');
            const shortName=(h.name||'Hotel').split(' · ')[0];
            const nightLabel=thaiHotelNightLabel(h,currentDate);
            return `<details class="thai-linked-stay thai-section hotel-detail" aria-label="Soggiorno collegato dal giorno ${thaiEsc(source.id||stay.sourceIndex+1)}">
                <summary class="thai-linked-stay-summary">
                    <span class="thai-linked-stay-main"><strong>${title} · ${thaiEsc(shortName)}</strong><small>${thaiEsc(h.checkin||'Check-in da definire')} – ${thaiEsc(h.checkout||'Check-out da definire')} · Dal giorno ${thaiEsc(source.id||stay.sourceIndex+1)}</small></span>
                    ${nightLabel?`<span class="thai-night-tag">${thaiEsc(nightLabel)}</span>`:``}<span class="thai-linked-stay-hint">Dettagli <span class="thai-linked-stay-chevron" aria-hidden="true">▾</span></span>
                </summary>
                <div class="thai-linked-stay-details text-xs space-y-2">
                    ${h.address?`<p>${thaiHotelAddress(h.address)}</p>`:''}
                    <p>Check-in: ${thaiEsc(h.checkin||'non indicato')} · Check-out: ${thaiEsc(h.checkout||'non indicato')}</p>
                    ${h.status?`<p>Stato: ${thaiEsc(h.status)}</p>`:''}
                    ${h.cost!=='' && h.cost!=null?`<p>💶 Prezzo totale soggiorno: ${formatEUR(h.cost)} <span class="opacity-75">(totale soggiorno; previsione collegata al budget)</span></p>`:''}
                    ${h.cancellation?`<p>✅ Cancellazione: ${thaiEsc(h.cancellation)}</p>`:''}
                    <div class="flex gap-2 flex-wrap">${thaiBtn('✏️ Modifica prenotazione',`openHotelModal(${stay.sourceIndex})`)}${thaiLink(h.link,'Apri prenotazione')}</div>
                </div>
              </details>`;
        }

        // L'orario determina l'ordine solo finché non è stato salvato un ordine manuale.
        function thaiSortedActivities(day){
            const items=(day.activities||[]).map((a,j)=>({a,j}));
            const manual=items.some(({a})=>Number.isInteger(a.order)&&a.order>=0);
            if(manual){
                return items.sort((x,y)=>{
                    const xo=Number.isInteger(x.a.order)&&x.a.order>=0?x.a.order:Number.MAX_SAFE_INTEGER;
                    const yo=Number.isInteger(y.a.order)&&y.a.order>=0?y.a.order:Number.MAX_SAFE_INTEGER;
                    return xo-yo||x.j-y.j;
                });
            }
            return items.sort((x,y)=>{
                if(x.a.start&&y.a.start&&x.a.start!==y.a.start)return x.a.start.localeCompare(y.a.start);
                if(x.a.start&&!y.a.start)return -1;
                if(!x.a.start&&y.a.start)return 1;
                return x.j-y.j;
            });
        }
        function thaiHasManualActivityOrder(day){
            return (day.activities||[]).some(a=>Number.isInteger(a.order)&&a.order>=0);
        }
        function thaiAppendActivity(day,activity){
            if(thaiHasManualActivityOrder(day)){
                const sorted=thaiSortedActivities(day).map(x=>x.a);
                sorted.forEach((a,i)=>a.order=i);
                activity.order=sorted.length;
                day.activities=sorted;
            }
            day.activities.push(activity);
        }
        function thaiRenderSummary(){
            const el=document.getElementById('day-summary'); if(!el)return;
            if(!tripData.days.length){el.innerHTML='<p class="text-sm">Aggiungi una giornata per iniziare a pianificare.</p>';return;}
            if(thaiSummaryDay>=tripData.days.length)thaiSummaryDay=0;
            const d=tripData.days[thaiSummaryDay];
            const acts=thaiSortedActivities(d).map(item=>item.a);
            el.innerHTML=`<div class="flex flex-wrap items-center justify-between gap-2"><h3 class="font-bold text-sm">📍 Riepilogo della giornata</h3><select aria-label="Seleziona giornata" onchange="thaiSummaryDay=Number(this.value);thaiRenderSummary()" class="bg-white dark:bg-slate-700 border rounded-lg p-1.5 text-xs">${tripData.days.map((x,i)=>`<option value="${i}" ${i===thaiSummaryDay?'selected':''}>${thaiEsc(x.date||'Giorno '+x.id)} — ${thaiEsc(x.title||'Tappa')}</option>`).join('')}</select></div>
            <div class="mt-2 text-xs space-y-1"><p>🏨 ${thaiEsc(d.hotel?.name||thaiHotelStayForDay(thaiSummaryDay)?.hotel?.name||d.hotel_status||'Hotel non inserito')}</p><p>🚆 ${(d.transports||[]).length} spostamenti · 🗓️ ${acts.length} attività</p>${acts.length?acts.map(a=>`<p>• ${thaiEsc(a.start||'—')} ${thaiEsc(a.title||a.desc||'Attività')}</p>`).join(''):'<p>Nessuna attività in programma.</p>'}</div>`;
        }
        function renderItinerary(){
            thaiRenderSummary();
            const el=document.getElementById('days-container');
            if(!tripData.days.length){el.innerHTML='<div class="p-4 bg-sky-50 text-sky-800 rounded-xl text-sm">Nessuna giornata presente. Usa “Aggiungi Giorno”.</div>';return;}
            el.innerHTML=tripData.days.map((d,i)=>{
                const activities=thaiSortedActivities(d);
                const transport=(d.transports||[]);
                const hotel=d.hotel;
                const linkedStays=thaiHotelStaysForDay(i).filter(stay=>stay.sourceIndex!==i);
                const checkoutStays=linkedStays.filter(stay=>stay.checkout);
                const otherStays=linkedStays.filter(stay=>!stay.checkout);
                return `<article class="day-card bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3" data-day-index="${i}">
                  <div class="flex justify-between items-start gap-2"><div class="flex gap-2 items-start"><span class="day-drag-handle cursor-grab p-1 text-slate-400">☷</span><div><p class="text-[11px] font-bold text-brand-600">GIORNO ${thaiEsc(d.id)} · ${thaiEsc(d.date||'')}</p><h3 class="font-bold">${thaiEsc(d.title||'Tappa')}</h3></div></div><div class="flex gap-2">${thaiBtn('✏️',`openDayModal(${i})`)}${thaiBtn('🗑️',`deleteDay(${i})`)}</div></div>
                  <div class="flex flex-wrap gap-2">${thaiBtn(hotel || d.link || d.cancellation || d.hotel_status === 'Prenotato' ? '🏨 Gestisci hotel' : '🏨 Aggiungi hotel',`openHotelModal(${i})`)}${thaiBtn('🛫 Aggiungi volo interno',`thaiEditFlight(-1,${i})`)}${thaiBtn('🚆 Aggiungi spostamento',`openTransportModal(${i})`)}${thaiBtn('+ Aggiungi attività',`openActivityModal(${i})`)}</div>
                  ${thaiDomesticForDay(i)}${checkoutStays.map(stay=>thaiSharedHotelCard(stay,d.date)).join('')}
                  ${(hotel?.name) ? `<div class="thai-section hotel-detail text-xs space-y-2"><div class="flex items-center justify-between flex-wrap gap-2"><p class="font-bold">🏨 ${hotel?.checkin && thaiDateKey(hotel.checkin)===thaiDateKey(d.date)?'Check-in oggi · ':''}Hotel ${thaiEsc(hotel?.status||d.hotel_status||'Da prenotare')}</p><span class="flex flex-wrap gap-2"><button type="button" onclick="thaiOpenMove('hotel',${i})" class="thai-action" aria-label="Sposta hotel in un altro giorno">↔️ Sposta hotel</button><button type="button" onclick="thaiDeleteHotel(${i})" class="rounded-lg border border-rose-300 dark:border-rose-700 px-3 py-2 text-rose-700 dark:text-rose-200 font-semibold hover:bg-rose-50 dark:hover:bg-rose-900/30" aria-label="Elimina hotel dalla giornata">🗑️ Elimina hotel</button></span></div>${hotel?.name?`<p class="thai-hotel-name"><strong>${thaiEsc(hotel.name)}</strong></p>`:''}${thaiHotelNightLabel(hotel,d.date)?`<span class="thai-night-tag">${thaiEsc(thaiHotelNightLabel(hotel,d.date))}</span>`:''}${hotel?.address?`<p>${thaiHotelAddress(hotel.address)}</p>`:''}${hotel?.checkin?`<p>Check-in: ${thaiEsc(hotel.checkin)}</p>`:''}${hotel?.checkout?`<p>Check-out: ${thaiEsc(hotel.checkout)}</p>`:''}${hotel?.reference?`<p>Prenotazione: ${thaiEsc(hotel.reference)}</p>`:''}${hotel?.cost !== undefined && hotel?.cost !== null && hotel?.cost !== '' ? `<p class="font-bold text-sm">💶 Prezzo totale hotel: ${formatEUR(hotel.cost)} <span class="font-normal opacity-75">(previsione collegata al budget)</span></p>` : ''}${thaiLink(hotel?.link||d.link,'Apri prenotazione')}${hotel?.notes?`<p>${thaiEsc(hotel.notes)}</p>`:''}${(hotel?.cancellation||d.cancellation)?`<p class="mt-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-700 px-2.5 py-2 text-emerald-800 dark:text-emerald-200"><b>✅ Condizioni di cancellazione hotel:</b> ${thaiEsc(hotel?.cancellation||d.cancellation)}</p>`:''}</div>` : ''}
                  ${otherStays.map(stay=>thaiSharedHotelCard(stay,d.date)).join('')}
                  
                  ${(transport.length || d.transport_details)?`<div class="thai-section transport-detail text-xs space-y-2"><h4 class="font-bold">🚆 Spostamenti</h4>${d.transport_details?`<div class="thai-legacy"><div class="flex flex-wrap justify-between items-center gap-2"><span class="font-semibold">📌 Descrizione trasporto importata</span><div class="flex gap-1">${thaiBtn('✏️ Modifica',`openDayModal(${i})`)}${thaiBtn('Rimuovi',`thaiClearLegacy(${i},\'transport_details\')`)}</div></div><p class="whitespace-pre-wrap mt-1">${thaiEsc(d.transport_details)}</p><p class="thai-help">È un testo salvato nel vecchio itinerario, non un biglietto o una spesa. Puoi rimuoverlo dopo aver creato lo spostamento qui sopra.</p></div>`:''}${transport.map((t,j)=>`<div class="border-t border-slate-200 dark:border-slate-700 pt-2"><div class="flex flex-wrap justify-between gap-2"><span class="font-semibold">${thaiTransportLabel(t)}</span><span>${thaiBtn('↔️ Sposta',`thaiOpenMove('transport',${i},${j})`)} ${thaiBtn('✏️',`openTransportModal(${i},${j})`)} ${thaiBtn('🗑️',`thaiDelete('transport',${i},${j})`)}</span></div><p>${thaiEsc(t.date||'')} ${thaiEsc(t.departure||'')} → ${thaiEsc(t.arrival||'')} · ${thaiEsc(t.status||'Da prenotare')}</p>${t.cost!==''&&t.cost!=null?`<p>Costo: ${formatEUR(t.cost)} </p>`:''}${t.reference?`<p>Rif.: ${thaiEsc(t.reference)}</p>`:''}${t.notes?`<p>${thaiEsc(t.notes)}</p>`:''}${thaiLink(t.link,'Biglietto / prenotazione')}</div>`).join('')}</div>`:''}
                  ${d.cost?`<div class="thai-legacy text-xs"><div class="flex flex-wrap items-center justify-between gap-2"><b>💶 Importo del vecchio itinerario: ${thaiEsc(d.cost)}</b><div class="flex gap-1">${thaiBtn('✏️ Modifica',`openDayModal(${i})`)}${thaiBtn('Rimuovi',`thaiClearLegacy(${i},'cost')`)}</div></div><p class="thai-help">È un valore generico importato: non è stato attribuito a hotel, trasporti o budget. Se è una spesa reale, registrala in Budget & Costi, poi rimuovi questo valore.</p></div>`:''}
                  ${d.notes?`<div class="text-xs bg-slate-50 dark:bg-slate-700/30 rounded-xl p-3 space-y-1"><p>📝 Note giornata: ${thaiEsc(d.notes)}</p></div>`:''}
                  
                  <div class="activities-container space-y-2">
                    ${activities.length > 1 ? `<div class="flex justify-end">${thaiBtn('↔️ Sposta tutte le attività',`thaiOpenMove('all_activities',${i})`,'','Sposta tutte le attività di questo giorno in un altro')}</div>` : ''}
                    ${activities.map(({a,j})=>`<div class="activity-detail bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs flex justify-between gap-2" data-activity-index="${j}"><div class="flex gap-2 items-start min-w-0 flex-1"><span class="activity-drag-handle p-1 text-slate-400 hover:text-slate-600 select-none cursor-grab" title="Trascina per riordinare" aria-label="Trascina per riordinare le attività">☷</span><div class="min-w-0 flex-1"><p class="font-semibold">${a.start?`<span class="text-brand-600">${thaiEsc(a.start)}${a.end?'–'+thaiEsc(a.end):''} · </span>`:''}${thaiEsc(a.title||a.desc||'Attività')}</p>${a.desc&&a.title?`<p class="mt-1 whitespace-pre-wrap">${thaiEsc(a.desc)}</p>`:''}${thaiActivityCostText(a)}<div class="flex gap-3 mt-1">${thaiLink(a.maps,'Google Maps')} ${thaiLink(a.link,'Apri link')}</div></div></div><div class="flex gap-1 items-start shrink-0">${thaiBtn('↔️',`thaiOpenMove('activity',${i},${j})`,'','Sposta questa attività in un altro giorno')}${thaiBtn('✏️',`openActivityModal(${i},${j})`)}${thaiBtn('🗑️',`deleteActivity(${i},${j})`)}</div></div>`).join('')||'<p class="text-xs text-slate-400">Nessuna attività aggiunta.</p>'}
                  </div>
                  ${thaiBtn('+ Aggiungi attività',`openActivityModal(${i})`)}
                </article>`;
            }).join('');
        }
        function renderTodos(){
            const all=tripData.todos||[];
            const done=all.filter(t=>t.done).length;
            const percent=all.length?Math.round(done/all.length*100):0;
            const summary=document.getElementById('todo-progress-summary');
            if(summary)summary.innerHTML=`<div class="thai-todo-toolbar"><span class="text-sm font-bold">${done} di ${all.length} completate</span><span class="text-xs opacity-75">Trascina ☷ per riordinare</span></div><div class="thai-todo-progress" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100" aria-label="To Do completate"><div style="width:${percent}%"></div></div>`;
            document.getElementById('todo-list').innerHTML=all.map((t,i)=>`<div class="thai-todo-row ${t.done?'is-done':''}" data-todo-index="${i}">
              <span class="todo-drag-handle thai-todo-drag" role="img" aria-label="Trascina per riordinare" title="Trascina per riordinare">☷</span>
              <input class="thai-todo-check" type="checkbox" id="thai-todo-${i}" ${t.done?'checked':''} onchange="toggleTodo(${i});renderApp()" aria-label="Completa ${thaiEsc(t.text||'attività')}" />
              <label for="thai-todo-${i}" class="thai-todo-main"><span class="thai-todo-text ${t.done?'line-through':''}">${thaiEsc(t.text||'Da fare')}</span>
                ${(t.due||t.owner)?`<span class="thai-todo-meta">${t.due?`<span class="thai-todo-chip">📅 ${thaiEsc(t.due)}</span>`:''}${t.owner?`<span class="thai-todo-chip">👤 ${thaiEsc(t.owner)}</span>`:''}</span>`:''}
              </label>
              <button type="button" class="thai-todo-action" onclick="openTodoModal(${i})" title="Modifica" aria-label="Modifica To Do">✏️</button>
              <button type="button" class="thai-todo-action danger" onclick="deleteTodo(${i})" title="Elimina" aria-label="Elimina To Do">🗑️</button>
            </div>`).join('')||'<p class="text-sm opacity-75 p-3">Nessuna attività da fare. Aggiungi la prima!</p>';
        }
        
        function renderNotes() {
            const container = document.getElementById('notes-container');
            if (!container) return;

            const notes = tripData.notes || [];

            container.innerHTML = notes.map((n, i) => {
                const url = thaiUrl(n.link);
                const shown = String(n.link || '').trim();

                const linked = url
                    ? `<a href="${thaiEsc(url)}" target="_blank" rel="noopener noreferrer" class="text-brand-600 dark:text-teal-200 underline break-all inline-block py-1" title="Apri il collegamento esterno">${thaiEsc(shown)} ↗</a>`
                    : '';

                return `
                  <article class="thai-note-card bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900 rounded-xl p-3 text-sm space-y-2">
                    <div class="flex items-start gap-2">
                      <span class="note-drag-handle" title="Trascina per riordinare" aria-label="Trascina per riordinare">☷</span>
                      <strong class="flex-1 min-w-0 text-sky-900 dark:text-sky-100 font-bold break-words">${thaiEsc(n.title || 'Nota')}</strong>
                      <div class="thai-note-actions flex gap-1 shrink-0">
                        <button type="button" class="thai-note-order-btn" onclick="thaiMoveNote(${i}, -1)" ${i === 0 ? 'disabled' : ''} title="Sposta in alto" aria-label="Sposta nota in alto">↑</button>
                        <button type="button" class="thai-note-order-btn" onclick="thaiMoveNote(${i}, 1)" ${i === notes.length - 1 ? 'disabled' : ''} title="Sposta in basso" aria-label="Sposta nota in basso">↓</button>
                        ${thaiBtn('✏️', `openNoteModal(${i})`)}
                        ${thaiBtn('🗑️', `deleteNote(${i})`)}
                      </div>
                    </div>
                    ${n.text ? `<p class="whitespace-pre-wrap break-words text-slate-800 dark:text-slate-100">${thaiEsc(n.text)}</p>` : ''}
                    ${linked}
                  </article>
                `;
            }).join('') || '<p class="text-sm text-slate-400">Nessuna nota.</p>';
        }
        
        function thaiMoveNote(index, direction) {
            const notes = tripData.notes || [];
            const target = index + direction;
            if (index < 0 || target < 0 || target >= notes.length) return;
            const moved = notes.splice(index, 1)[0];
            notes.splice(target, 0, moved);
            saveDataToSheet();
            renderApp();
        }

        function thaiExpenseIcon(category){
            return ({'Hotel':'🏨','Cibo':'🍜','Trasporti':'🚆','Attività':'🎟️','Shopping':'🛍️','Altro':'🧾'})[category||'Altro'] || '🧾';
        }
        function thaiOpenForecast(i=-1){
            const e=i>=0?tripData.plannedExpenses[i]:{};
            document.getElementById('forecast-edit-index').value=i;
            document.getElementById('forecast-title').value=e.title||'';
            document.getElementById('forecast-amount').value=e.amount??'';
            document.getElementById('forecast-category').value=e.category||'Altro';
            document.getElementById('forecast-split').value=e.split||'uguale';
            document.getElementById('thai-forecast-title').textContent=i>=0?'Modifica previsione':'Spesa futura prevista';
            const m=document.getElementById('thai-forecast-modal');m.classList.remove('hidden');m.classList.add('flex');
            document.getElementById('forecast-title').focus();
        }
        function thaiCloseForecast(){const m=document.getElementById('thai-forecast-modal');m.classList.add('hidden');m.classList.remove('flex');}
        function thaiSaveForecast(event){
            event.preventDefault();
            const title=document.getElementById('forecast-title').value.trim();
            const raw=document.getElementById('forecast-amount').value;
            const amount=Number(raw);
            if(!title||raw===''||!Number.isFinite(amount)||amount<0){alert('Inserisci nome e costo valido');return;}
            const i=Number(document.getElementById('forecast-edit-index').value);
            const val={title,amount,category:document.getElementById('forecast-category').value,split:document.getElementById('forecast-split').value};
            if(i>=0)tripData.plannedExpenses[i]={...tripData.plannedExpenses[i],...val};else tripData.plannedExpenses.push(val);
            thaiCloseForecast();saveDataToSheet();renderApp();
        }
        function thaiDeleteForecast(i){
            if(!confirm('Eliminare questa previsione?'))return;
            tripData.plannedExpenses.splice(i,1);saveDataToSheet();renderApp();
        }
        function thaiForecastPaid(i){
            if(!confirm('Spostare questa previsione nelle spese già pagate?'))return;
            const item=tripData.plannedExpenses[i];if(!item)return;
            const paidBy=prompt('Chi ha pagato questa spesa? Scrivi Barbara oppure Laura:','Barbara');
            if(paidBy===null)return;
            const payer=paidBy.trim().toLowerCase()==='laura'?'Laura':paidBy.trim().toLowerCase()==='barbara'?'Barbara':null;
            if(!payer){alert('Inserisci Barbara o Laura.');return;}
            tripData.expenses.push({title:item.title,amount:item.amount,category:item.category,split:item.split,payer,_sourceId:item._sourceId});
            tripData.plannedExpenses.splice(i,1);saveDataToSheet();renderApp();
        }
        function thaiRenderForecast(paid,shares){
            const items=tripData.plannedExpenses||[];
            const unpaid=items.reduce((sum,item)=>sum+(Number(item.amount)||0),0);
            let b=shares.Barbara,l=shares.Laura;
            items.forEach(e=>{const amount=Number(e.amount)||0;const bs=e.split==='Barbara'?amount:e.split==='Laura'?0:amount/2;b+=bs;l+=amount-bs;});
            const put=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=formatEUR(v);};
            put('thai-forecast-paid',paid);put('thai-forecast-unpaid',unpaid);put('thai-forecast-total',paid+unpaid);
            put('thai-forecast-half',(paid+unpaid)/2);put('thai-forecast-barbara',b);put('thai-forecast-laura',l);
            document.getElementById('thai-forecast-list').innerHTML=items.map((e,i)=>`<article class="thai-forecast-row"><span class="thai-forecast-icon text-xl" aria-hidden="true">${thaiExpenseIcon(e.category)}</span><div class="flex-1 min-w-0"><strong class="block break-words">${thaiEsc(e.title)}</strong><span class="text-xs opacity-80">${thaiEsc(e.category||'Altro')} · ${e.split==='uguale'?'50/50':thaiEsc(e.split)}</span></div><strong>${formatEUR(e.amount)}</strong><div class="thai-forecast-actions"><button type="button" onclick="thaiOpenForecast(${i})">✏️ Modifica</button><button type="button" onclick="thaiForecastPaid(${i})">✓ Pagata</button><button type="button" onclick="thaiDeleteForecast(${i})">🗑️ Elimina</button></div></article>`).join('')||'<p class="text-xs opacity-80">Non hai ancora inserito spese future. Le prenotazioni nell’itinerario non vengono conteggiate automaticamente.</p>';
        }
        function renderBudget(){
            const arr=tripData.expenses||[];let total=0,barbPaid=0,lauraPaid=0,barbOwes=0;
            const byCategory={};
            arr.forEach(e=>{const amt=Number(e.amount)||0;total+=amt;byCategory[e.category||'Altro']=(byCategory[e.category||'Altro']||0)+amt;
                if(e.payer==='Laura')lauraPaid+=amt;else barbPaid+=amt;
                if(e.split==='Barbara')barbOwes+=amt;else if(e.split==='Laura'){}else barbOwes+=amt/2;
            });
            const shares={Barbara:0,Laura:0};
            const categoryShares={};
            arr.forEach(e=>{
                const amount=Number(e.amount)||0;
                const category=e.category||'Altro';
                if(!categoryShares[category])categoryShares[category]={Barbara:0,Laura:0};
                const b=e.split==='Barbara'?amount:e.split==='Laura'?0:amount/2;
                const l=amount-b;
                shares.Barbara+=b;shares.Laura+=l;
                categoryShares[category].Barbara+=b;
                categoryShares[category].Laura+=l;
            });
            thaiRenderForecast(total,shares);
            document.getElementById('personal-budget-summary').innerHTML=`
              <div class="budget-stat budget-barbara" aria-label="Costo del viaggio per Barbara"><div class="budget-stat-head"><span class="budget-stat-icon" aria-hidden="true">🐨</span><span>Spesa di Barbara</span></div><strong class="budget-stat-value">${formatEUR(shares.Barbara)}</strong><p class="budget-stat-note">Quota personale del totale</p></div>
              <div class="budget-stat budget-laura" aria-label="Costo del viaggio per Laura"><div class="budget-stat-head"><span class="budget-stat-icon" aria-hidden="true">🥙</span><span>Spesa di Laura</span></div><strong class="budget-stat-value">${formatEUR(shares.Laura)}</strong><p class="budget-stat-note">Quota personale del totale</p></div>`;
            document.getElementById('personal-category-summary').innerHTML=`
              <p class="font-bold mb-2">Ripartizione per categoria</p>
              <div class="thai-category-grid grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-2 items-center">
                <span class="text-slate-500 dark:text-slate-300">Categoria</span><b class="text-right">Barbara</b><b class="text-right">Laura</b>
                ${Object.entries(categoryShares).sort((a,b)=>a[0].localeCompare(b[0],'it')).map(([cat,v])=>`<span>${thaiExpenseIcon(cat)} ${thaiEsc(cat)}</span><span class="text-right tabular-nums">${formatEUR(v.Barbara)}</span><span class="text-right tabular-nums">${formatEUR(v.Laura)}</span>`).join('')||'<span class="col-span-3 text-slate-500 dark:text-slate-300">Nessuna spesa registrata.</span>'}
              </div>`;
            document.getElementById('total-budget-sum').textContent=formatEUR(total);
            document.getElementById('budget-half-barbara').textContent=formatEUR(total/2);
            document.getElementById('budget-half-laura').textContent=formatEUR(total/2);
            const balance=barbPaid-barbOwes;
            const result=Math.abs(balance)<0.005?'Siete pari ✨':balance>0?`Laura deve a Barbara: <b>${formatEUR(balance)}</b>`:`Barbara deve a Laura: <b>${formatEUR(-balance)}</b>`;
            document.getElementById('split-summary-box').innerHTML=`
              <section class="budget-stat budget-barbara" aria-label="Totale pagato da Barbara"><div class="budget-stat-head"><span class="budget-stat-icon" aria-hidden="true">🐨</span><span>Barbara ha pagato</span></div><strong class="budget-stat-value">${formatEUR(barbPaid)}</strong><p class="budget-stat-note">Spese anticipate</p></section>
              <section class="budget-stat budget-laura" aria-label="Totale pagato da Laura"><div class="budget-stat-head"><span class="budget-stat-icon" aria-hidden="true">🥙</span><span>Laura ha pagato</span></div><strong class="budget-stat-value">${formatEUR(lauraPaid)}</strong><p class="budget-stat-note">Spese anticipate</p></section>
              <section class="budget-stat budget-balance" aria-label="Saldo tra viaggiatrici"><div class="budget-stat-head"><span class="budget-stat-icon" aria-hidden="true">⚖️</span><span>Situazione debiti</span></div><div class="budget-stat-result">${result}</div><p class="budget-stat-note">Saldo calcolato sulle spese</p></section>`;
            const category=document.getElementById('expense-category-filter')?.value||'all';
            const filtered=arr.map((e,i)=>({e,i})).filter(({e})=>category==='all'||(e.category||'Altro')===category);
            const fs=filtered.reduce((sum,{e})=>sum+(Number(e.amount)||0),0);
            document.getElementById('expense-filter-sum').textContent=`${filtered.length} spese · ${formatEUR(fs)}`;
            document.getElementById('expenses-list').innerHTML=filtered.map(({e,i})=>`
              <article class="thai-expense-card rounded-xl p-3" data-thai-fold-key="expense:${i}">
                <div class="thai-fold-header thai-expense-head">
                  <span class="thai-expense-icon" aria-hidden="true">${thaiExpenseIcon(e.category)}</span>
                  <div class="thai-expense-main min-w-0">
                    <strong class="thai-expense-name">${thaiEsc(e.title||'Spesa')}</strong>
                    <span class="thai-expense-meta">${thaiEsc(e.category||'Altro')} · Pagato da ${thaiEsc(e.payer||'Barbara')}</span>
                  </div>
                  <strong class="thai-expense-amount">${formatEUR(e.amount)}</strong>
                  <button class="thai-fold-toggle thai-expense-chevron" type="button" aria-label="Mostra o nascondi i dettagli della spesa ${thaiEsc(e.title||'Spesa')}" title="Mostra o nascondi i dettagli">▾</button>
                </div>
                <div class="thai-fold-body thai-expense-details">
                  <div class="thai-expense-split"><span>Ripartizione:</span> <strong>${e.split==='uguale'?'50% Barbara · 50% Laura':'100% '+thaiEsc(e.split||'Barbara')}</strong></div>
                  <div class="thai-expense-actions">
                    <button type="button" class="thai-expense-edit" onclick="openExpenseModal(${i})">✏️ Modifica</button>
                    <button type="button" class="thai-expense-delete" onclick="deleteExpense(${i})">🗑️ Elimina</button>
                  </div>
                </div>
              </article>`).join('')||'<p class="text-xs text-slate-400">Nessuna spesa in questa categoria.</p>';
        }
        function openExpenseModal(i=-1){
            document.getElementById('expense-edit-index').value=i;
            const exp=i>=0?tripData.expenses[i]:{};
            document.getElementById('modal-title').textContent=i>=0?'Modifica Spesa':'Nuova Spesa';
            document.getElementById('exp-title-input').value=exp.title||'';
            document.getElementById('exp-amount-input').value=exp.amount??'';
            document.getElementById('exp-payer-input').value=exp.payer||'Barbara';
            document.getElementById('exp-split-input').value=exp.split||'uguale';
            document.getElementById('exp-category-input').value=exp.category||'Altro';
            const m=document.getElementById('expense-modal');m.classList.remove('hidden');
        }
        function saveExpenseModal(){
            const title=document.getElementById('exp-title-input').value.trim();
            const raw=document.getElementById('exp-amount-input').value;
            const amount=Number(raw);
            if(!title||raw===''||!Number.isFinite(amount)||amount<0){alert('Inserisci descrizione e importo valido.');return;}
            const i=Number(document.getElementById('expense-edit-index').value);
            const x={title,amount,payer:document.getElementById('exp-payer-input').value,split:document.getElementById('exp-split-input').value,category:document.getElementById('exp-category-input').value};
            if(i>=0)tripData.expenses[i]={...tripData.expenses[i],...x};else tripData.expenses.push(x);
            closeExpenseModal();saveDataToSheet();renderApp();
        }
        function thaiClearLegacy(dayIndex,field){
            if(!['transport_details','cost'].includes(field) || !tripData.days[dayIndex]) return;
            const name=field==='cost'?'il vecchio importo':'la vecchia descrizione del trasporto';
            if(!confirm(`Rimuovere ${name} da questa giornata? La modifica verrà sincronizzata con il database.`))return;
            tripData.days[dayIndex][field]='';
            saveDataToSheet();renderApp();
        }
        function renderApp(){calculateCountdown();renderItinerary();renderBudget();renderTodos();renderNotes();thaiRenderFlights();thaiRenderToday();thaiInstallFolds();initDragAndDrop();}
        let thaiSortable, thaiTodoSortable, thaiNotesSortable, thaiActivitySortables = [];
        function initDragAndDrop(){
            if(!window.Sortable)return;
            const el=document.getElementById('days-container');
            if(thaiSortable){thaiSortable.destroy();thaiSortable=null;}
            if(el)thaiSortable=new Sortable(el,{handle:'.day-drag-handle',animation:150,onEnd:evt=>{
                if(evt.oldIndex===evt.newIndex)return;
                const moved=tripData.days.splice(evt.oldIndex,1)[0];tripData.days.splice(evt.newIndex,0,moved);
                saveDataToSheet();renderApp();
            }});
            const todos=document.getElementById('todo-list');
            if(thaiTodoSortable){thaiTodoSortable.destroy();thaiTodoSortable=null;}
            if(todos)thaiTodoSortable=new Sortable(todos,{handle:'.todo-drag-handle',animation:150,delayOnTouchOnly:true,delay:120,touchStartThreshold:5,onEnd:evt=>{
                if(evt.oldIndex===evt.newIndex)return;
                const moved=tripData.todos.splice(evt.oldIndex,1)[0];tripData.todos.splice(evt.newIndex,0,moved);
                saveDataToSheet();renderApp();
            }});
            
            const notesContainer = document.getElementById('notes-container');
            if (thaiNotesSortable) {
                thaiNotesSortable.destroy();
                thaiNotesSortable = null;
            }
            if (notesContainer) {
                thaiNotesSortable = new Sortable(notesContainer, {
                    draggable: '.thai-note-card',
                    handle: '.note-drag-handle',
                    animation: 150,
                    delayOnTouchOnly: true,
                    delay: 120,
                    touchStartThreshold: 5,
                    onEnd: evt => {
                        if (evt.oldIndex === evt.newIndex || evt.oldIndex == null || evt.newIndex == null) return;
                        const moved = tripData.notes.splice(evt.oldIndex, 1)[0];
                        tripData.notes.splice(evt.newIndex, 0, moved);
                        saveDataToSheet();
                        renderApp();
                    }
                });
            }

            thaiActivitySortables.forEach(s => s.destroy());
            thaiActivitySortables = [];
            document.querySelectorAll('#days-container .day-card').forEach(dayCard => {
                const dayIdx = parseInt(dayCard.dataset.dayIndex, 10);
                // I blocchi espandibili inseriscono un .thai-fold-body: è QUESTO il genitore delle card.
                const wrapper = dayCard.querySelector('.activities-container');
                const container = wrapper?.querySelector(':scope > .thai-fold-body') || wrapper;
                if (container) {
                    const sortable = new Sortable(container, {
                        draggable: '.activity-detail',
                        handle: '.activity-drag-handle',
                        animation: 150,
                        delayOnTouchOnly: true,
                        delay: 120,
                        touchStartThreshold: 5,
                        fallbackOnBody: true,
                        forceFallback: true,
                        fallbackTolerance: 4,
                        onEnd: function(evt) {
                            if (evt.oldIndex === evt.newIndex || evt.oldIndex == null || evt.newIndex == null) return;
                            const day = tripData.days[dayIdx];
                            if (!day || !day.activities) return;
                            const cards = container.querySelectorAll(':scope > .activity-detail');
                            const reorderedActivities = [];
                            cards.forEach((card, newIdx) => {
                                const originalIdx = parseInt(card.dataset.activityIndex, 10);
                                const act = day.activities[originalIdx];
                                if (act) {
                                    act.order = newIdx;
                                    reorderedActivities.push(act);
                                }
                            });
                            day.activities = reorderedActivities;
                            saveDataToSheet();
                            renderApp();
                        }
                    });
                    thaiActivitySortables.push(sortable);
                }
            });
        }
        async function exportJSONData(){
            const raw=JSON.stringify(tripData,null,2);
            try{await navigator.clipboard.writeText(raw);alert('JSON copiato negli appunti.');}
            catch(e){const blob=new Blob([raw],{type:'application/json'});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download='thai-planner-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
        }
        function importJSONPrompt(){
            const raw=prompt('Incolla il JSON da importare:');if(!raw)return;
            try{let d=JSON.parse(raw);if(Array.isArray(d))d={days:d,todos:[],notes:[],expenses:[]};if(!thaiValid(d))throw Error('Formato dati non valido');
                if(!confirm('Importare il JSON e sostituire tutti i dati attuali? Prima esporta una copia dei tuoi dati.'))return;
                tripData=thaiNormalize(d);thaiConflict=false;saveDataToSheet();renderApp();alert('Dati importati localmente. Controlla lo stato di sincronizzazione prima di chiudere.');
            }catch(e){alert('JSON non valido: '+e.message);}
        }
        async function thaiRefresh(){
            if(thaiDirty) {
                if(thaiConflict) { thaiShowSync(); return; }
                await thaiSyncPending();
                return;
            }
            await fetchDataFromSheet();
        }

        (function thaiInstallPullToRefresh(){
            const indicator = document.getElementById('thai-pull-indicator');
            if (!indicator) return;
            const threshold = 76;
            let startY = 0, startX = 0, distance = 0;
            let tracking = false, refreshing = false;
            const atPageTop = () => window.scrollY <= 2 && document.documentElement.scrollTop <= 2;
            const modalVisible = () => !document.getElementById('thai-modal')?.classList.contains('hidden') || !document.getElementById('expense-modal')?.classList.contains('hidden');
            function show(distance, message){
                indicator.textContent = message;
                indicator.style.opacity = '1';
                indicator.style.transform = 'translate(-50%,' + Math.min(18, -35 + distance * 0.7) + 'px)';
            }
            function hide(){
                indicator.style.opacity = '0';
                indicator.style.transform = 'translate(-50%,-110%)';
            }
            document.addEventListener('touchstart', function(e){
                tracking = false; distance = 0;
                if (refreshing || e.touches.length !== 1 || window.innerWidth >= 768 || !atPageTop() || modalVisible() || e.target.closest('input,textarea,select,[contenteditable="true"],.thai-modal-panel,.activity-drag-handle,.day-drag-handle,.todo-drag-handle,.note-drag-handle')) return;
                startY = e.touches[0].clientY; startX = e.touches[0].clientX; tracking = true;
            }, {passive:true});
            document.addEventListener('touchmove', function(e){
                if (!tracking || refreshing || e.touches.length !== 1) return;
                const dy = e.touches[0].clientY - startY;
                const dx = Math.abs(e.touches[0].clientX - startX);
                if (dy <= 0 || dx > dy || !atPageTop()) { tracking = false; hide(); return; }
                distance = Math.min(120,dy * 0.65);
                if (e.cancelable && distance > 8) e.preventDefault();
                if (distance > 8) show(distance, distance >= threshold ? '↻ Rilascia per aggiornare' : '↓ Trascina per aggiornare');
            }, {passive:false});
            document.addEventListener('touchend', async function(){
                if (!tracking) return;
                tracking = false;
                if (distance < threshold || refreshing) { hide(); return; }
                refreshing = true; show(95, '↻ Aggiornamento...');
                try { await thaiRefresh(); }
                finally { refreshing = false; distance = 0; hide(); }
            }, {passive:true});
            document.addEventListener('touchcancel', function(){tracking=false;distance=0;hide();}, {passive:true});
        })();

        let thaiConflictRemote=null;
        const THAI_MERGE_FIELDS=[['days','Itinerario, hotel e trasporti'],['todos','To Do'],['notes','Note'],['expenses','Spese pagate'],['plannedExpenses','Spese future previste'],['flights','Voli']];
        async function thaiResolveConflict(){
            if(!thaiConflict)return;
            try{
                const data=await thaiReadRemote();
                if(!thaiValid(data))throw Error(data.message||'Risposta non valida');
                thaiConflictRemote=thaiNormalize(data);
                const container=document.getElementById('thai-conflict-choices');
                container.innerHTML=THAI_MERGE_FIELDS.map(([key,label])=>{
                    const local=tripData[key]||[];
                    const remote=thaiConflictRemote[key]||[];
                    const changed=JSON.stringify(local)!==JSON.stringify(remote);
                    return `<label class="block rounded-lg border border-slate-300 dark:border-slate-600 p-3 space-y-1"><strong class="block">${thaiEsc(label)}</strong><span class="text-xs">Telefono: ${local.length} elementi · Server: ${remote.length} elementi ${changed?'· ⚠️ Diversi':'· Uguali'}</span><select class="thai-field" data-thai-conflict-field="${key}"><option value="remote">Mantieni versione sul server</option><option value="local" ${changed?'selected':''}>Mantieni versione su questo telefono</option></select></label>`;
                }).join('');
                const m=document.getElementById('thai-conflict-modal');m.classList.remove('hidden');m.classList.add('flex');
            }catch(err){alert('Impossibile confrontare le versioni: '+err.message+'\nEsporta il JSON locale e riprova.');}
        }
        function thaiCloseConflictModal(){const m=document.getElementById('thai-conflict-modal');m.classList.add('hidden');m.classList.remove('flex');}
        async function thaiApplyConflictResolution(){
            if(!thaiConflictRemote)return;
            if(!confirm('Confermi la scelta? Per ciascuna sezione verrà conservata una sola versione. Il backup locale verrà scaricato prima del salvataggio.'))return;
            await thaiDownloadBackup();
            const resolved=structuredClone(thaiConflictRemote);
            document.querySelectorAll('[data-thai-conflict-field]').forEach(select=>{
                const field=select.dataset.thaiConflictField;
                if(select.value==='local')resolved[field]=structuredClone(tripData[field]||[]);
            });
            resolved._revision=thaiConflictRemote._revision;
            tripData=thaiNormalize(resolved);
            thaiConflict=false;thaiDirty=true;thaiSequence++;
            thaiCloseConflictModal();thaiPersist();renderApp();thaiShowSync();thaiSyncPending();
        }
        function thaiDownloadBackup(){
            const data=JSON.stringify(tripData,null,2);
            const blob=new Blob([data],{type:'application/json'});
            const url=URL.createObjectURL(blob);
            const a=document.createElement('a');a.href=url;a.download='thai-planner-copia-locale-'+new Date().toISOString().slice(0,10)+'.json';
            document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
            return Promise.resolve();
        }

        const THAI_FOLDS_KEY='thai_planner_fold_preferences_v1';
        let thaiFoldChoices={};
        try{thaiFoldChoices=JSON.parse(localStorage.getItem(THAI_FOLDS_KEY)||'{}')||{};}catch(e){thaiFoldChoices={};}
        function thaiRememberFolds(){try{localStorage.setItem(THAI_FOLDS_KEY,JSON.stringify(thaiFoldChoices));}catch(e){}}
        function thaiFoldState(key){return Object.prototype.hasOwnProperty.call(thaiFoldChoices,key)?!!thaiFoldChoices[key]:!!thaiFoldChoices.__all;}
        function thaiUpdateFold(shell,key,body,btn){
            const closed=thaiFoldState(key);body.hidden=closed;
            shell.classList.toggle('thai-fold-collapsed',closed);
            btn.setAttribute('aria-expanded',String(!closed));
            btn.textContent=key.startsWith('expense:')?(closed?'▾':'▴'):(closed?'▾ Espandi':'▴ Comprimi');
            btn.title=closed?'Espandi il blocco':'Comprimi il blocco';
        }
        function thaiWrapFold(shell,key,title,opts={}){
            if(!shell||shell.dataset.thaiFoldKey)return;
            shell.dataset.thaiFoldKey=key;
            const body=document.createElement('div');
            body.className='thai-fold-body';
            const header=document.createElement('div');header.className='thai-fold-header';
            const heading=document.createElement('span');heading.className='font-semibold text-sm';
            heading.textContent=title;
            const btn=document.createElement('button');btn.type='button';btn.className='thai-fold-toggle';
            btn.setAttribute('aria-label','Comprimi o espandi '+title);
            header.append(heading,btn);
            while(shell.firstChild)body.appendChild(shell.firstChild);
            shell.append(header,body);
            btn.addEventListener('click',()=>{thaiFoldChoices[key]=!thaiFoldState(key);thaiRememberFolds();thaiUpdateFold(shell,key,body,btn);});
            thaiUpdateFold(shell,key,body,btn);
        }
        function thaiDayFold(card,key){
            if(card.dataset.thaiFoldKey)return;
            card.dataset.thaiFoldKey=key;
            const header=card.firstElementChild;
            if(!header)return;
            header.classList.add('thai-day-header');
            const body=document.createElement('div');body.className='thai-fold-body space-y-3';
            while(header.nextSibling)body.appendChild(header.nextSibling);
            card.appendChild(body);
            const btn=document.createElement('button');btn.type='button';btn.className='thai-fold-toggle';
            btn.setAttribute('aria-label','Comprimi o espandi la giornata');
            const right=header.lastElementChild || header;
            right.classList.add('thai-day-actions');
            btn.classList.add('thai-day-collapse-action');
            right.appendChild(btn);
            btn.addEventListener('click',()=>{thaiFoldChoices[key]=!thaiFoldState(key);thaiRememberFolds();thaiUpdateFold(card,key,body,btn);});
            thaiUpdateFold(card,key,body,btn);
        }
        function thaiInstallFolds(){
            document.querySelectorAll('#days-container > .day-card').forEach((card,i)=>{
                const day=tripData.days[i]||{};
                const key='day:'+String(day.id||i);
                const hotel=card.querySelector('.hotel-detail');
                if(hotel && !hotel.classList.contains('thai-linked-stay'))thaiWrapFold(hotel,key+':hotel','🏨 Hotel');
                const transport=card.querySelector('.transport-detail');
                if(transport)thaiWrapFold(transport,key+':transports','🚆 Spostamenti');
                const activities=card.querySelector('.activity-detail')?.parentElement;
                if(activities)thaiWrapFold(activities,key+':activities','🗓️ Attività');
                thaiDayFold(card,key);
            });
            const flight=document.querySelector('.flight-card');
            if(flight)thaiWrapFold(flight,'flights','✈️ Voli');
            const travellers=document.querySelector('.travellers-card');
            if(travellers)thaiWrapFold(travellers,'travellers','👥 Le viaggiatrici');
            const budget=document.querySelector('#tab-budget > div');
            if(budget){
                const forecast=budget.querySelector('#thai-forecast-panel');
                if(forecast)thaiWrapFold(forecast,'budget:forecast','🔮 Previsione del viaggio');
                const estimate=budget.querySelector('section[aria-label="Stima budget a testa"]');
                if(estimate)thaiWrapFold(estimate,'budget:estimate','🌊 Stima a testa');
                const balances=budget.querySelector('#thai-budget-balance-panel');
                if(balances)thaiWrapFold(balances,'budget:balances','⚖️ Pagamenti e debiti');
                const personal=budget.querySelector('section[aria-label="Quanto costa il viaggio a persona"]');
                if(personal)thaiWrapFold(personal,'budget:personal','💳 Spesa a persona');
            }
            document.querySelectorAll('#expenses-list > .thai-expense-card').forEach(node=>{
                const key=node.dataset.thaiFoldKey;
                const body=node.querySelector('.thai-fold-body');
                const btn=node.querySelector('.thai-expense-chevron');
                if(!body||!btn)return;
                btn.addEventListener('click',()=>{
                    thaiFoldChoices[key]=!thaiFoldState(key);
                    thaiRememberFolds();
                    thaiUpdateFold(node,key,body,btn);
                });
                thaiUpdateFold(node,key,body,btn);
            });
        }
        function thaiSetAllFolds(collapsed){
            thaiFoldChoices={__all:!!collapsed};
            document.querySelectorAll('[data-thai-fold-key]').forEach(shell=>{
                const key=shell.dataset.thaiFoldKey;
                const body=Array.from(shell.children).find(el=>el.classList.contains('thai-fold-body'));
                const header=Array.from(shell.children).find(el=>el.classList.contains('thai-fold-header'))||shell.firstElementChild;
                const btn=header?.querySelector('.thai-fold-toggle');
                if(body&&btn)thaiUpdateFold(shell,key,body,btn);
            });
            document.querySelectorAll('details.thai-linked-stay').forEach(detail=>{detail.open=!collapsed;});
            thaiRememberFolds();
        }

        let thaiFlightEditIndex=-1;
        function thaiEditingVisible(){return ['thai-modal','expense-modal','thai-forecast-modal','thai-flight-modal','thai-backups-modal','thai-conflict-modal','thai-trip-settings-modal'].some(id=>{const e=document.getElementById(id);return e&&!e.classList.contains('hidden');}) || !!document.activeElement?.closest('input,textarea,select,[contenteditable="true"]');}
        function thaiFlightModalClose(){const m=document.getElementById('thai-flight-modal');m.classList.add('hidden');m.classList.remove('flex');}
        const THAI_FLIGHT_FIELDS=['route','company','number','date','arrivalDate','depart','arrive','from','to','fromTerminal','toTerminal','duration','baggage','price','paidBy','reference','link','notes'];
        function thaiEditFlight(i=-1,dayIndex=-1){
            thaiFlightEditIndex=i;
            const f=i>=0?(tripData.flights||[])[i]||{}:{};
            THAI_FLIGHT_FIELDS.forEach(field=>{const el=document.getElementById('thai-flight-'+field);if(el)el.value=field==='route'?'Interno':(f[field]??'');});
            if(i<0&&dayIndex>=0){const d=tripData.days[dayIndex];const key=thaiDateAsISO(d?.date);if(key)document.getElementById('thai-flight-date').value=key;}
            const m=document.getElementById('thai-flight-modal');m.classList.remove('hidden');m.classList.add('flex');
        }
        function thaiDateAsISO(s){
            if(!s)return '';
            const x=String(s).trim();if(/^\d{4}-\d\d-\d\d$/.test(x))return x;
            const m=x.match(/^(\d{1,2})\s*(?:[\/-]|\s+)\s*(\d{1,2}|gen(?:naio)?|feb(?:braio)?|mar(?:zo)?|apr(?:ile)?|mag(?:gio)?|giu(?:gno)?|lug(?:lio)?|ago(?:sto)?|set(?:tembre)?|ott(?:obre)?|nov(?:embre)?|dic(?:embre)?)\s*(?:[\/-]|\s+)?\s*(\d{4})?$/i);
            if(!m)return '';
            const months=['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];const mo=/^\d+$/.test(m[2])?Number(m[2]):months.findIndex(x=>m[2].toLowerCase().startsWith(x))+1;
            if(!(mo>=1&&mo<=12))return '';
            const year=m[3]||String(thaiInferYear(mo));
            const result=`${year}-${String(mo).padStart(2,'0')}-${m[1].padStart(2,'0')}`;
            return thaiDateKey(result)===null?'':result;
        }
        function thaiFlightDayIndex(f){
            const iso=thaiDateAsISO(f.date);
            if(!iso)return -1;
            const days=tripData.days||[];
            const exact=days.findIndex(d=>thaiDateAsISO(d.date)===iso);
            if(exact>=0)return exact;
            const sameDay=days.map((d,i)=>({date:thaiDateAsISO(d.date),i})).filter(x=>x.date&&x.date.slice(5)===iso.slice(5));
            return sameDay.length===1?sameDay[0].i:-1;
        }
        function thaiDomesticForDay(index){return (tripData.flights||[]).map((f,i)=>({f,i})).filter(x=>!x.f.international && thaiFlightDayIndex(x.f)===index).map(({f,i})=>`<div class="rounded-xl border border-sky-300 dark:border-sky-700 bg-sky-50 dark:bg-sky-950/30 p-3 space-y-2 text-xs"><div class="flex items-center justify-between gap-2"><b>🛫 ${thaiEsc(f.company||'Volo interno')} ${thaiEsc(f.number||'')}</b><div class="flex gap-1">${thaiBtn('✏️',`thaiEditFlight(${i})`)}${thaiBtn('🗑️',`thaiDeleteFlight(${i})`)}</div></div><div class="flex items-center justify-between gap-2"><div><b class="text-base">${thaiEsc(f.from||'—')}</b><p>${thaiEsc(f.date||'')} ${thaiEsc(f.depart||'')}</p></div><span>✈️ ${thaiEsc(f.duration||'')}</span><div class="text-right"><b class="text-base">${thaiEsc(f.to||'—')}</b><p>${thaiEsc(f.arrivalDate||f.date||'')} ${thaiEsc(f.arrive||'')}</p></div></div>${f.reference?`<p>PNR: <b>${thaiEsc(f.reference)}</b></p>`:''}${f.baggage?`<p>🧳 ${thaiEsc(f.baggage)}</p>`:''}${f.price?`<p>💶 ${thaiEsc(f.price)} € ${thaiEsc(f.paidBy||'')}</p>`:''}${thaiLink(f.link,'Apri prenotazione')}</div>`).join('');}
        function thaiSaveFlight(e){
            e.preventDefault();const f={international:false};THAI_FLIGHT_FIELDS.forEach(field=>{const el=document.getElementById('thai-flight-'+field);if(el)f[field]=el.value.trim();});f.route='Interno';
            if(!f.from||!f.to||!f.date){alert('Inserisci aeroporti e data di partenza.');return;}
            if(f.link){f.link=thaiUrl(f.link);if(!f.link){alert('Link non valido');return;}}
            if(thaiFlightEditIndex>=0){if(tripData.flights[thaiFlightEditIndex]?.international){alert('I voli internazionali sono gestiti separatamente.');return;}tripData.flights[thaiFlightEditIndex]={...tripData.flights[thaiFlightEditIndex],...f};}else tripData.flights.push(f);
            thaiFlightModalClose();saveDataToSheet();renderApp();
        }
        function thaiDeleteFlight(i){if(tripData.flights?.[i]?.international)return;if(!confirm('Eliminare questo volo interno?'))return;tripData.flights.splice(i,1);saveDataToSheet();renderApp();}
        async function thaiImportSaudia(){
            if(thaiDirty){alert('Completa prima la sincronizzazione.');return;}
            if(!confirm('Importare i 4 voli Saudia confermati nel database? Non verranno cancellati i voli già salvati.'))return;
            try{const res=await thaiApi({action:'seedSaudia',_revision:tripData._revision});if(await thaiAuthError(res))return;if(res.status!=='success')throw Error(res.message||'Importazione non riuscita');await fetchDataFromSheet();alert('Voli Saudia importati nel database.');}catch(err){alert('Importazione non riuscita: '+err.message);}
        }
        function thaiRenderFlights(){
            const el=document.getElementById('thai-flights-list'),dom=document.getElementById('thai-domestic-list');if(!el)return;
            const intl=(tripData.flights||[]).filter(f=>f.international).slice().sort((a,b)=>(a.date+' '+a.depart).localeCompare(b.date+' '+b.depart));
            const intBlock=(a,title,theme)=>`<div class="rounded-xl border ${theme} p-3 space-y-2"><b>${title}</b>${a.map((f,i)=>`<div class="space-y-1"><div class="flex justify-between gap-2"><b>${thaiEsc(f.from||'')} → ${thaiEsc(f.to||'')}</b><span>${thaiEsc(f.duration||'')}</span></div><div>SV ${thaiEsc(String(f.number||'').replace(/^SV\s*/i,''))} · ${thaiEsc(f.date||'')} · ${thaiEsc(f.depart||'')} → ${thaiEsc(f.arrive||'')}</div><div class="opacity-80">Terminal ${thaiEsc(f.fromTerminal||'—')} → ${thaiEsc(f.toTerminal||'—')}</div></div>${i===0?`<div class="text-center rounded-lg bg-black/5 dark:bg-white/10 p-2 font-semibold">🕒 Scalo a Riad · ${thaiEsc(title.startsWith('ANDATA')?'10h':'6h 45m')}</div>`:''}`).join('')}</div>`;
            if(intl.length){
                const outbound=intl.filter(f=>f.route==='Andata'),inbound=intl.filter(f=>f.route==='Ritorno');
                el.innerHTML=`${outbound.length?intBlock(outbound,'ANDATA','border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20'):''}${inbound.length?intBlock(inbound,'RITORNO','border-violet-300 dark:border-violet-800 bg-violet-50/60 dark:bg-violet-950/20'):''}<div class="pt-1"><span class="opacity-70">PNR · </span><b class="text-base">${thaiEsc(intl[0].reference||'—')}</b></div>`;
            }else el.innerHTML='<p class="opacity-80">Voli Saudia non ancora importati nel database.</p><button type="button" class="thai-action mt-2" onclick="thaiImportSaudia()">Importa voli Saudia prenotati</button>';
            const domestic=(tripData.flights||[]).map((f,i)=>({f,i})).filter(x=>!x.f.international);
            if(dom)dom.innerHTML=domestic.length?domestic.sort((a,b)=>(a.f.date||'').localeCompare(b.f.date||'')).map(({f,i})=>`<button type="button" class="w-full text-left p-2 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-amber-200 dark:border-amber-800" onclick="thaiGoToDomestic(${i})"><b>${thaiEsc(f.date||'')}</b> · ${thaiEsc(f.from||'')} → ${thaiEsc(f.to||'')}<p>${thaiEsc(f.depart||'')} · ${thaiEsc(f.company||'')} ${thaiEsc(f.number||'')}</p></button>`).join(''):'<p class="opacity-75">Nessun volo interno. Aggiungili dopo la prenotazione.</p>';
        }
        function thaiGoToDomestic(i){const f=tripData.flights?.[i];if(!f)return;const n=thaiFlightDayIndex(f);switchTab('itinerary');if(n>=0){const cards=document.querySelectorAll('#days-container > .day-card');cards[n]?.scrollIntoView({behavior:'smooth',block:'start'});}else if(confirm('La data di partenza del volo ('+(f.date||'non indicata')+') non coincide con una giornata dell’itinerario. Vuoi correggere la data del volo?'))thaiEditFlight(i);}
        async function thaiShowBackups(){
            if(thaiDirty){alert('Attendi che le modifiche locali siano sincronizzate.');return;}
            try{
                const d=await thaiApi({action:'backups'});if(await thaiAuthError(d))return;if(d.status!=='success')throw Error(d.message||'Errore backup');
                const modal=document.getElementById('thai-backups-modal');const list=document.getElementById('thai-backups-list');
                list.innerHTML=(d.backups||[]).map(b=>`<div class="flex items-center justify-between gap-3 p-2 border-b border-slate-200 dark:border-slate-700"><span>Rev. ${Number(b.revision)||0} · ${thaiEsc(String(b.date||'').slice(0,19))}</span><button type="button" class="thai-action" onclick="thaiRestoreBackup(${Number(b.row)})">Ripristina</button></div>`).join('')||'<p>Nessun backup disponibile.</p>';
                modal.classList.remove('hidden');
            }catch(e){alert('Backup non disponibili: '+e.message);}
        }
        async function thaiRestoreBackup(row){
            if(thaiDirty){alert('Hai modifiche non sincronizzate. Salvale prima.');return;}
            if(!confirm('Ripristinare questo backup? La versione attuale verrà salvata nei BACKUPS. La modifica sarà visibile su tutti i dispositivi.'))return;
            exportJSONData();
            try{const d=await thaiApi({action:'restore',row,_revision:tripData._revision});if(d.status!=='success')throw Error(d.message||'Ripristino non completato');document.getElementById('thai-backups-modal').classList.add('hidden');await fetchDataFromSheet();alert('Backup ripristinato e dati aggiornati.');}
            catch(e){alert('Ripristino non riuscito: '+e.message);}
        }
        function thaiLinkBookingCost(kind,dayIndex,itemIndex=-1){
            const day=tripData.days[dayIndex];if(!day)return;
            if(kind==='hotel'&&day.hotel)thaiHotelForecastSync(day.hotel,day,dayIndex);
            if(kind==='transport'&&day.transports?.[itemIndex])thaiTransportForecastSync(day.transports[itemIndex],day);
            saveDataToSheet();renderApp();
        }
        function thaiRenderToday(){
            const picker=document.getElementById('thai-today-day'),out=document.getElementById('thai-today-content');if(!picker||!out)return;
            const current=picker.value;const now=new Date();const todayUTC=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
            const active=tripData.days.findIndex(d=>thaiDateKey(d.date)===todayUTC);
            picker.innerHTML=(tripData.days||[]).map((d,i)=>`<option value="${i}">${thaiEsc(d.date||'Giorno '+(i+1))} · ${thaiEsc(d.title||'')}</option>`).join('');
            const selected=current!==''&&Number(current)<tripData.days.length?Number(current):Math.max(active,0);
            picker.value=String(selected);const d=tripData.days[selected];if(!d){out.innerHTML='<p>Nessuna giornata disponibile.</p>';return;}
            const stays=thaiHotelStaysForDay(selected);
            const htmlStays=stays.map(st=>`<div class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">${st.checkout?'🧳 Check-out':thaiDateKey(st.hotel.checkin)===thaiDateKey(d.date)?'🏨 Check-in':'🏨 Pernottamento'} · <strong>${thaiEsc(st.hotel.name||'Hotel')}</strong>${st.hotel.address?`<p>${thaiHotelAddress(st.hotel.address)}</p>`:''}</div>`).join('');
            const transports=(d.transports||[]).map(t=>`<div class="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30">🚆 <strong>${thaiEsc(t.type||'Trasporto')} ${thaiEsc(t.from||'')} → ${thaiEsc(t.to||'')}</strong><p>${thaiEsc(t.departure||'')} – ${thaiEsc(t.arrival||'')}</p></div>`).join('');
            const acts=thaiSortedActivities(d).map(item=>item.a).map(a=>`<div class="p-3 rounded-xl bg-violet-50 dark:bg-violet-950/30">${thaiEsc(a.start||'')} <strong>${thaiEsc(a.title||a.desc||'Attività')}</strong> ${thaiLink(a.maps,'Google Maps')}</div>`).join('');
            const todos=(tripData.todos||[]).filter(t=>!t.done&&t.due&&thaiDateKey(t.due)===thaiDateKey(d.date)).map(t=>`<div class="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30">☑ ${thaiEsc(t.text)}</div>`).join('');
            out.innerHTML=`<div class="bg-white dark:bg-slate-800 rounded-2xl border p-4 space-y-3"><h3 class="text-lg font-bold">${thaiEsc(d.title||'Tappa')}</h3>${htmlStays}${thaiDomesticForDay(selected)}${transports}${acts}${todos||''}${!htmlStays&&!transports&&!acts&&!todos?'<p>Nessuna attività registrata.</p>':''}</div>`;
        }
