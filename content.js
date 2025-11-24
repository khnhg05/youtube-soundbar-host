(async function() {
    if(document.getElementById('myOptionBar')) return;

    // === UTILS ===
    function createBtn(label, onClick) {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.onclick = onClick;
        return btn;
    }

    const playingTabs = new Set(); // các tab đang play

    // === INDEXEDDB LOGIC ===
    function openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('YTOptionBarDB', 1);
            req.onupgradeneeded = e => {
                const db = e.target.result;
                if(!db.objectStoreNames.contains('options')){
                    const store = db.createObjectStore('options', { keyPath:'id', autoIncrement:true });
                    store.createIndex('name','name',{unique:false});
                }
            };
            req.onsuccess = e => resolve(e.target.result);
            req.onerror = e => reject(e.target.error);
        });
    }

    async function saveOption(opt){ 
        const db = await openDB();
        return new Promise((resolve,reject)=>{
            const tx = db.transaction('options','readwrite');
            tx.objectStore('options').put(opt);
            tx.oncomplete=()=>resolve();
            tx.onerror=e=>reject(e.target.error);
        });
    }

    async function loadOptions(){
        const db = await openDB();
        return new Promise((resolve,reject)=>{
            const tx = db.transaction('options','readonly');
            const req = tx.objectStore('options').getAll();
            req.onsuccess = ()=>resolve(req.result);
            req.onerror = e=>reject(e.target.error);
        });
    }

    async function deleteOption(id){
        const db = await openDB();
        return new Promise((resolve,reject)=>{
            const tx = db.transaction('options','readwrite');
            tx.objectStore('options').delete(id);
            tx.oncomplete=()=>resolve();
            tx.onerror=e=>reject(e.target.error);
        });
    }

    // === AUDIO MANAGER ===
    const audioMap = {}; 
    function playPause(opt, tabBtn){
        let isPlaying = false;
        if(opt.type === 'file'){
            if(!opt.file) return alert('Chưa có file!');
            if(!audioMap[opt.id]){
                audioMap[opt.id] = new Audio(URL.createObjectURL(opt.file));
                audioMap[opt.id].loop = false;
                audioMap[opt.id].volume = opt.volume ?? 1;
                audioMap[opt.id].play();
                isPlaying = true;
            } else {
                const audio = audioMap[opt.id];
                if(audio.paused) { audio.play(); isPlaying=true; }
                else { audio.pause(); isPlaying=false; }
            }
        } else if(opt.type === 'youtube'){
            if(!opt.youtubePlayer) return alert('Player chưa tạo');
            const state = opt.youtubePlayer.getPlayerState();
            if(state===1){ opt.youtubePlayer.pauseVideo(); isPlaying=false; }
            else { opt.youtubePlayer.playVideo(); isPlaying=true; }
            if(opt.volume != null) opt.youtubePlayer.setVolume(opt.volume*100);
        }

        // === SIGNAL when opening ===
        tabBtn.style.boxShadow = '0 0 10px 2px yellow';
        setTimeout(()=>tabBtn.style.boxShadow='', 500);

        // === Set playing color ===
        if(isPlaying){
            playingTabs.add(tabBtn);
            tabBtn.style.background = opt.playColor || 'lime';
        } else {
            playingTabs.delete(tabBtn);
            tabBtn.style.background = opt.color || '#444';
        }
    }

    function parseYTID(url){
        const match = url.match(/[?&]v=([^&]+)/);
        return match? match[1]: url;
    }

    // === CREATE OPTION ELEMENT ===
    async function createOptionElement(bar,opt,insertAfter=null){
        const btn = document.createElement('button');
        btn.textContent = opt.name;
        btn.style.background = opt.color || '#444';
        btn.style.color = '#fff';
        btn.style.border = 'none';
        btn.style.padding = '5px 8px';
        btn.style.borderRadius = '4px';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.gap = '5px';
        btn.style.position='relative';

        btn.onclick = () => playPause(opt, btn);

        // volume slider
        const volInput = document.createElement('input');
        volInput.type='range'; volInput.min=0; volInput.max=1; volInput.step=0.01;
        volInput.value = opt.volume ?? 1;
        volInput.style.width='50px';
        volInput.oninput = ()=> {
            opt.volume = parseFloat(volInput.value);
            if(audioMap[opt.id]) audioMap[opt.id].volume = opt.volume;
            if(opt.youtubePlayer) opt.youtubePlayer.setVolume(opt.volume*100);
            saveOption(opt);
        };
        btn.appendChild(volInput);

        // menu button
        const menuBtn = document.createElement('span');
        menuBtn.textContent='⋮';
        menuBtn.style.cursor='pointer';
        menuBtn.style.marginLeft='5px';
        btn.appendChild(menuBtn);

        const menu = document.createElement('div');
        menu.style.position='absolute';
        menu.style.top='100%';
        menu.style.left='0';
        menu.style.background='#333';
        menu.style.border='1px solid #555';
        menu.style.padding='5px';
        menu.style.display='none';
        menu.style.flexDirection='column';
        menu.style.zIndex=9999;

        const renameOpt = document.createElement('div');
        renameOpt.textContent='Sửa tên';
        renameOpt.style.cursor='pointer';
        renameOpt.onclick = async (e)=>{
            e.stopPropagation();
            const newName = prompt('Tên mới:', opt.name);
            if(newName) { opt.name = newName; btn.childNodes[0].nodeValue = newName; saveOption(opt); }
            menu.style.display='none';
        };
        menu.appendChild(renameOpt);

        const colorOpt = document.createElement('div');
        colorOpt.textContent='Đổi màu';
        colorOpt.style.cursor='pointer';
        colorOpt.onclick = async (e)=>{
            e.stopPropagation();
            const newColor = prompt('Màu nền (hex hoặc tên):', opt.color||'#444');
            if(newColor){ opt.color = newColor; btn.style.background = newColor; saveOption(opt); }
            menu.style.display='none';
        };
        menu.appendChild(colorOpt);

        // play color dropdown
        const playColorOpt = document.createElement('div');
        playColorOpt.textContent='Chọn màu khi đang phát';
        playColorOpt.style.cursor='pointer';
        playColorOpt.onclick = (e)=>{
            e.stopPropagation();
            const colors = ['lime','yellow','orange','red','cyan','magenta'];
            const choice = prompt('Nhập màu khi phát (lime/yellow/orange/red/cyan/magenta):', opt.playColor||'lime');
            if(choice && colors.includes(choice)){
                opt.playColor = choice;
                saveOption(opt);
            }
            menu.style.display='none';
        };
        menu.appendChild(playColorOpt);

        const uploadOpt = document.createElement('div');
        uploadOpt.textContent='Upload file / YouTube';
        uploadOpt.style.cursor='pointer';
        uploadOpt.onclick = async (e)=>{
            e.stopPropagation();
            const choice = confirm('Chọn OK để upload file audio, Cancel để nhập link YouTube');
            if(choice){
                const input = document.createElement('input');
                input.type='file'; input.accept='audio/*';
                input.onchange = ()=>{ opt.type='file'; opt.file = input.files[0]; saveOption(opt); };
                input.click();
            } else {
                const url = prompt('Nhập link YouTube:');
                if(url){
                    opt.type='youtube'; opt.youtubeURL = url;
                    const div = document.createElement('div');
                    div.style.display='none';
                    const id = `ytplayer-${opt.id}`;
                    div.id = id; document.body.appendChild(div);
                    if(window.YT && YT.Player){
                        opt.youtubePlayer = new YT.Player(id,{height:'0',width:'0',videoId:parseYTID(url)});
                    } else {
                        const tag = document.createElement('script');
                        tag.src="https://www.youtube.com/iframe_api";
                        document.body.appendChild(tag);
                        window.onYouTubeIframeAPIReady = ()=>{
                            opt.youtubePlayer = new YT.Player(id,{height:'0',width:'0',videoId:parseYTID(url)});
                        }
                    }
                    saveOption(opt);
                }
            }
            menu.style.display='none';
        };
        menu.appendChild(uploadOpt);

        const delOpt = document.createElement('div');
        delOpt.textContent='Xóa';
        delOpt.style.cursor='pointer';
        delOpt.onclick=async (e)=>{
            e.stopPropagation();
            if(confirm('Xóa option này?')){
                await deleteOption(opt.id);
                btn.remove();
            }
            menu.style.display='none';
        };
        menu.appendChild(delOpt);

        btn.appendChild(menu);

        menuBtn.onclick = (e)=>{
            e.stopPropagation();
            menu.style.display = menu.style.display==='flex'?'none':'flex';
        };

        document.addEventListener('click', ()=> menu.style.display='none');

        if(insertAfter && insertAfter.nextSibling)
            bar.insertBefore(btn, insertAfter.nextSibling);
        else
            bar.insertBefore(btn, bar.querySelector('#addBtn'));

        return btn;
    }

    // === CREATE BAR ===
    const bar = document.createElement('div');
    bar.id='myOptionBar';
    bar.style.position='fixed';
    bar.style.bottom='0'; bar.style.left='0'; bar.style.width='100%';
    bar.style.background='#222'; bar.style.color='#fff'; bar.style.padding='8px';
    bar.style.zIndex=9999; bar.style.display='flex'; bar.style.flexWrap='wrap';
    bar.style.gap='8px'; bar.style.fontFamily='Arial,sans-serif';
    bar.style.boxShadow='0 -2px 6px rgba(0,0,0,0.3)';
    document.body.appendChild(bar);
    document.body.style.paddingBottom='80px';

    // nút minimize / maximize
    const minBtn = document.createElement('span');
    minBtn.textContent='🗕';
    minBtn.style.cursor='pointer';
    minBtn.style.marginLeft='auto';
    minBtn.onclick = ()=>{
        if(bar.style.height==='30px'){
            bar.style.height='auto';
            bar.style.overflow='visible';
        } else {
            bar.style.height='30px';
            bar.style.overflow='hidden';
        }
    };
    bar.appendChild(minBtn);

    // nút thêm mới
    const addBtn = createBtn('+', async ()=>{
        const selectedBtn = bar.querySelector('button.selected') || null;
        const newOpt = {name:'New Option', type:'file', file:null, volume:1, color:'#444'};
        await saveOption(newOpt);
        const newBtn = await createOptionElement(bar,newOpt,selectedBtn);
        newBtn.classList.add('selected');
    });
    addBtn.id='addBtn';
    bar.appendChild(addBtn);

    // load options từ DB
    const options = await loadOptions();
    for(let opt of options) createOptionElement(bar,opt);

})();
