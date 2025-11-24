(async function() {
    if (document.getElementById('myOptionBar')) return;

    // ------------------------------
    // === UTILS ===
    function createBtn(label, onClick) {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.onclick = onClick;
        return btn;
    }

    // ------------------------------
    // === INDEXEDDB LOGIC ===
    function openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('YTOptionBarDB', 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('options')) {
                    const store = db.createObjectStore('options', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('name', 'name', { unique: false });
                }
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function saveOption(opt) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('options', 'readwrite');
            const store = tx.objectStore('options');
            store.put(opt);
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async function loadOptions() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('options', 'readonly');
            const store = tx.objectStore('options');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function deleteOption(id) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('options', 'readwrite');
            tx.objectStore('options').delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    // ------------------------------
    // === AUDIO MANAGER ===
    function playAudio(blob) {
        if (!blob) return alert('Chưa có âm thanh!');
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play();
    }

    // ------------------------------
    // === CREATE OPTION BUTTON ===
    async function createOptionElement(bar, opt) {
        const btn = document.createElement('button');
        btn.textContent = opt.name;

        btn.onclick = () => playAudio(opt.file);

        // nút edit "..."
        const editBtn = document.createElement('span');
        editBtn.textContent = '...';
        editBtn.style.marginLeft = '5px';
        editBtn.style.cursor = 'pointer';

        editBtn.onclick = (e) => {
            e.stopPropagation();

            const newName = prompt('Nhập tên mới:', opt.name);
            if (newName) opt.name = newName;

            // upload file
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'audio/*';
            input.onchange = () => {
                const file = input.files[0];
                opt.file = file; // lưu Blob trực tiếp
                saveOption(opt);
            };
            input.click();

            btn.textContent = opt.name;
            btn.appendChild(editBtn);
            saveOption(opt);
        };

        btn.appendChild(editBtn);
        bar.appendChild(btn);
    }

    // ------------------------------
    // === CREATE BAR ===
    const bar = document.createElement('div');
    bar.id = 'myOptionBar';
    bar.style.position = 'fixed';
    bar.style.bottom = '0';
    bar.style.left = '0';
    bar.style.width = '100%';
    bar.style.background = '#222';
    bar.style.color = '#fff';
    bar.style.padding = '8px';
    bar.style.zIndex = 9999;
    bar.style.display = 'flex';
    bar.style.flexWrap = 'wrap';
    bar.style.gap = '8px';
    bar.style.fontFamily = 'Arial, sans-serif';
    bar.style.boxShadow = '0 -2px 6px rgba(0,0,0,0.3)';

    document.body.appendChild(bar);
    document.body.style.paddingBottom = '60px'; // tránh che nội dung

    // load option từ DB
    const options = await loadOptions();
    for (let opt of options) {
        createOptionElement(bar, opt);
    }

    // nút thêm option mới
    const addBtn = createBtn('+', async () => {
        const newOpt = { name: 'New Option', file: null };
        await saveOption(newOpt);
        createOptionElement(bar, newOpt);
    });
    bar.appendChild(addBtn);

    // nút đóng
    const closeBtn = document.createElement('span');
    closeBtn.textContent = '✖';
    closeBtn.style.marginLeft = 'auto';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => bar.remove();
    bar.appendChild(closeBtn);

})();
