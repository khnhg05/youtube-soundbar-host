(async function() {
    if(document.getElementById('myOptionBar')) return;

    // === UTILS ===
    function createBtn(label, onClick) {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.onclick = onClick;
        return btn;
    }

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
    const audioMap = {}; // id -> Audio object
    function playPause(opt){
        if(opt.type === 'file'){
            if(!opt.file) return alert('Chưa có file!');
            if(!audioMap[opt.id]){
                audioMap[opt.id] = new Audio(URL.createObjectURL(opt.file));
                audioMap[opt.id].loop = false;
                audioMap[opt.id].play();
            } else {
                const audio = audioMap[opt.id];
                if(audio.paused) audio.play();
                else audio.pause();
            }
        } else if(opt.type === 'youtube'){
            if(!opt.youtubePlayer) return alert('Player chưa tạo');
            const state = opt.youtubePlayer.getPlayerState();
            // 1 = playing, 2 = paused
            if(state===1) opt.youtubePlayer.pauseVideo();
            else opt.youtubePlayer.playVideo();
        }
    }

    // === CREATE OPTION ELEMENT ===
    async function createOptionElement(bar,opt){
        const btn = document.createElement('button');
        btn.textContent = opt.name;

        btn.onclick = () => playPause(opt);

        // nút edit
        const editBtn = document.createElement('span');
        editBtn.textContent = '...';
        editBtn.style.marginLeft = '5px';
        editBtn.style.cursor = 'pointer';
        editBtn.onclick = async (e)=>{
            e.stopPropagation();
            const newName = prompt('Tên mới:',opt.name);
            if(newName) opt.name = newName;

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
                    // tạo iframe YouTube ẩn
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

            btn.textContent = opt.name;
            btn.appendChild(editBtn);
        };
        btn.appendChild(editBtn);

        // nút xóa
        const delBtn = document.createElement('span');
        delBtn.textContent='🗑️';
        delBtn.style.marginLeft='5px';
        delBtn.style.cursor='pointer';
        delBtn.onclick=async (e)=>{
            e.stopPropagation();
            if(confirm('Xóa option này?')){
                await deleteOption(opt.id);
                btn.remove();
            }
        };
        btn.appendChild(delBtn);

        bar.appendChild(btn);
    }

    function parseYTID(url){
        const match = url.match(/[?&]v=([^&]+)/);
        return match? match[1]: url; // nếu là link đầy đủ hoặc chỉ id
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

    // load options từ DB
    const options = await loadOptions();
    for(let opt of options) createOptionElement(bar,opt);

    // nút thêm mới
    const addBtn = createBtn('+', async ()=>{
        const newOpt = {name:'New Option', type:'file', file:null};
        await saveOption(newOpt);
        createOptionElement(bar,newOpt);
    });
    bar.appendChild(addBtn);

    // nút đóng
    const closeBtn = document.createElement('span');
    closeBtn.textContent='✖';
    closeBtn.style.marginLeft='auto'; closeBtn.style.cursor='pointer';
    closeBtn.onclick = ()=> bar.remove();
    bar.appendChild(closeBtn);

})();
