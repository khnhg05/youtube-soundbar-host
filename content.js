(async function () {
    if (document.getElementById("myOptionBar")) return;

    /* ========================== UTILS ============================= */
    function createBtn(label, onClick) {
        const btn = document.createElement("button");
        btn.textContent = label;
        btn.onclick = onClick;
        return btn;
    }

    const playingTabs = new Set();
    const SELECTED_COLOR = "#1e7f1e"; // selected màu tối hơn

    /* ====================== INDEXEDDB LOGIC ======================== */
    function openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open("YTOptionBarDB", 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains("options")) {
                    const store = db.createObjectStore("options", {
                        keyPath: "id",
                        autoIncrement: true
                    });
                    store.createIndex("name", "name", { unique: false });
                }
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function saveOption(opt) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction("options", "readwrite");
            tx.objectStore("options").put(opt);
            tx.oncomplete = resolve;
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async function loadOptions() {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction("options", "readonly");
            const req = tx.objectStore("options").getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function deleteOption(id) {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction("options", "readwrite");
            tx.objectStore("options").delete(id);
            tx.oncomplete = resolve;
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    /* ======================= AUDIO/YT HANDLER ======================= */
    const audioMap = {};

    function parseYTID(url) {
        const match = url.match(/[?&]v=([^&]+)/);
        return match ? match[1] : url;
    }

    function applyColors(btn, opt) {
        if (playingTabs.has(btn)) {
            btn.style.background = opt.playColor || "lime";
        } else if (btn.classList.contains("selected")) {
            btn.style.background = SELECTED_COLOR;
        } else {
            btn.style.background = opt.color || "#555";
        }
    }

    function playPause(opt, tabBtn) {
        let isPlaying = false;

        if (opt.type === "file") {
            if (!opt.file) return alert("Chưa có file!");
            if (!audioMap[opt.id]) {
                audioMap[opt.id] = new Audio(URL.createObjectURL(opt.file));
                audioMap[opt.id].loop = false;
                audioMap[opt.id].volume = opt.volume ?? 1;
                audioMap[opt.id].play();
                isPlaying = true;
            } else {
                const audio = audioMap[opt.id];
                if (audio.paused) {
                    audio.play();
                    isPlaying = true;
                } else {
                    audio.pause();
                    isPlaying = false;
                }
            }
        } else if (opt.type === "youtube") {
            if (!opt.youtubePlayer) return alert("Player chưa tạo");
            const state = opt.youtubePlayer.getPlayerState();
            if (state === 1) {
                opt.youtubePlayer.pauseVideo();
                isPlaying = false;
            } else {
                opt.youtubePlayer.playVideo();
                isPlaying = true;
            }

            if (opt.volume != null) opt.youtubePlayer.setVolume(opt.volume * 100);
        }

        // cập nhật trạng thái play
        if (isPlaying) playingTabs.add(tabBtn);
        else playingTabs.delete(tabBtn);

        applyColors(tabBtn, opt);
    }

    /* ======================= CREATE OPTION ========================== */
    async function createOptionElement(bar, opt, insertAfter = null) {
        const btn = document.createElement("button");
        btn.textContent = opt.name;
        btn.style.background = opt.color || "#444";
        btn.style.color = "#fff";
        btn.style.border = "none";
        btn.style.padding = "5px 8px";
        btn.style.borderRadius = "4px";
        btn.style.display = "flex";
        btn.style.alignItems = "center";
        btn.style.gap = "5px";
        btn.style.position = "relative";
        btn._optRef = opt;

        // volume slider
        const volInput = document.createElement("input");
        volInput.type = "range";
        volInput.min = 0;
        volInput.max = 1;
        volInput.step = 0.01;
        volInput.value = opt.volume ?? 1;
        volInput.style.width = "50px";
        volInput.oninput = () => {
            opt.volume = parseFloat(volInput.value);
            if (audioMap[opt.id]) audioMap[opt.id].volume = opt.volume;
            if (opt.youtubePlayer) opt.youtubePlayer.setVolume(opt.volume * 100);
            saveOption(opt);
        };
        btn.appendChild(volInput);

        // menu button
        const menuBtn = document.createElement("span");
        menuBtn.textContent = "⋮";
        menuBtn.classList.add("menu-btn");
        menuBtn.style.cursor = "pointer";
        menuBtn.style.padding = "5px 8px";
        menuBtn.style.userSelect = "none";
        btn.appendChild(menuBtn);

        // popup menu
        const menu = document.createElement("div");
        menu.classList.add("menu-popup");
        menu.style.display = "none";
        menu.style.position = "fixed";
        menu.style.flexDirection = "column";
        menu.style.background = "#333";
        menu.style.border = "1px solid #555";
        menu.style.padding = "5px";
        menu.style.borderRadius = "4px";
        menu.style.zIndex = 99999999;

        function makeItem(label, handler) {
            const item = document.createElement("div");
            item.textContent = label;
            item.style.cursor = "pointer";
            item.style.padding = "4px 6px";
            item.onmouseenter = () => (item.style.background = "#444");
            item.onmouseleave = () => (item.style.background = "none");
            item.onclick = handler;
            return item;
        }

        menu.appendChild(makeItem("Sửa tên", (e) => {
            e.stopPropagation();
            const newName = prompt("Tên mới:", opt.name);
            if (newName) {
                opt.name = newName;
                btn.childNodes[0].nodeValue = newName;
                saveOption(opt);
            }
            menu.style.display = "none";
        }));

        menu.appendChild(makeItem("Đổi màu", (e) => {
            e.stopPropagation();
            const newColor = prompt("Màu nền:", opt.color || "#444");
            if (newColor) {
                opt.color = newColor;
                applyColors(btn, opt);
                saveOption(opt);
            }
            menu.style.display = "none";
        }));

        menu.appendChild(makeItem("Màu khi phát", (e) => {
            e.stopPropagation();
            const choice = prompt("Chọn màu (lime/yellow/orange/red/cyan/magenta):", opt.playColor || "lime");
            const ok = ["lime", "yellow", "orange", "red", "cyan", "magenta"];
            if (choice && ok.includes(choice)) {
                opt.playColor = choice;
                saveOption(opt);
            }
            menu.style.display = "none";
        }));

        menu.appendChild(makeItem("Upload file / YouTube", async (e) => {
            e.stopPropagation();
            const choice = confirm("OK = Upload file audio\nCancel = Nhập link YouTube");
            if (choice) {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "audio/*";
                input.onchange = () => {
                    opt.type = "file";
                    opt.file = input.files[0];
                    saveOption(opt);
                };
                input.click();
            } else {
                const url = prompt("Link YouTube:");
                if (url) {
                    opt.type = "youtube";
                    opt.youtubeURL = url;
                    const id = `yt-${opt.id}`;
                    const div = document.createElement("div");
                    div.style.display = "none";
                    div.id = id;
                    document.body.appendChild(div);

                    function createPlayer() {
                        opt.youtubePlayer = new YT.Player(id, { height: "0", width: "0", videoId: parseYTID(url) });
                    }

                    if (window.YT && YT.Player) createPlayer();
                    else {
                        const tag = document.createElement("script");
                        tag.src = "https://www.youtube.com/iframe_api";
                        window.onYouTubeIframeAPIReady = createPlayer;
                        document.body.appendChild(tag);
                    }
                    saveOption(opt);
                }
            }
            menu.style.display = "none";
        }));

        menu.appendChild(makeItem("Xóa", async (e) => {
            e.stopPropagation();
            if (confirm("Xóa option này?")) {
                await deleteOption(opt.id);
                btn.remove();
            }
            menu.style.display = "none";
        }));

        btn.appendChild(menu);

        // toggle menu + clamp
        menuBtn.onclick = (e) => {
            e.stopPropagation();
            if (menu.style.display === "flex") {
                menu.style.display = "none";
                return;
            }
            menu.style.display = "flex";
            const r = menuBtn.getBoundingClientRect();
            const mW = menu.offsetWidth;
            const mH = menu.offsetHeight;
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            let left = r.right - mW;
            let top = r.bottom + 4;

            if (left < 6) left = 6;
            if (left + mW > vw - 6) left = vw - mW - 6;
            if (top + mH > vh) top = r.top - mH - 6;
            if (top < 6) top = 6;

            menu.style.left = left + "px";
            menu.style.top = top + "px";
        };

        // chọn tab
        btn.addEventListener("click", (e) => {
            if (e.target.classList.contains("menu-btn")) return;

            bar.querySelectorAll("button.selected").forEach(b => {
                b.classList.remove("selected");
                applyColors(b, b._optRef);
            });

            btn.classList.add("selected");
            applyColors(btn, opt);

            playPause(opt, btn);
        });

        const addBtn = bar.querySelector("#addBtn");
        if (insertAfter && insertAfter !== addBtn) bar.insertBefore(btn, insertAfter.nextSibling);
        else bar.insertBefore(btn, addBtn);

        return btn;
    }

    /* ========================= CREATE BAR ============================ */
    const bar = document.createElement("div");
    bar.id = "myOptionBar";
    bar.style.position = "fixed";
    bar.style.bottom = "0";
    bar.style.left = "0";
    bar.style.width = "100%";
    bar.style.background = "#222";
    bar.style.color = "#fff";
    bar.style.padding = "8px";
    bar.style.zIndex = 9999;
    bar.style.display = "flex";
    bar.style.flexWrap = "wrap";
    bar.style.gap = "8px";
    bar.style.fontFamily = "Arial,sans-serif";
    bar.style.boxShadow = "0 -2px 6px rgba(0,0,0,0.3)";
    document.body.appendChild(bar);
    document.body.style.paddingBottom = "80px";

    // minimize button floating
    const minBtn = document.createElement("div");
    minBtn.textContent = "🗕";
    minBtn.style.position = "fixed";
    minBtn.style.right = "12px";
    minBtn.style.bottom = "70px";
    minBtn.style.background = "#222";
    minBtn.style.padding = "6px 12px";
    minBtn.style.borderRadius = "6px";
    minBtn.style.cursor = "pointer";
    minBtn.style.zIndex = 100000;
    minBtn.style.boxShadow = "0 0 6px rgba(0,0,0,0.4)";
    document.body.appendChild(minBtn);

    minBtn.onclick = () => {
        const collapsed = bar.getAttribute("data-minimized") === "1";
        if (collapsed) {
            bar.style.height = "auto";
            bar.style.overflow = "visible";
            bar.removeAttribute("data-minimized");
        } else {
            bar.style.height = "32px";
            bar.style.overflow = "hidden";
            bar.setAttribute("data-minimized", "1");
        }
    };

    // add button
    const addBtn = createBtn("+", async () => {
        const selectedBtn = bar.querySelector("button.selected") || null;
        const newOpt = { name: "New Option", type: "file", file: null, volume: 1, color: "#444", playColor: "lime" };
        await saveOption(newOpt);
        const newBtn = await createOptionElement(bar, newOpt, selectedBtn);

        bar.querySelectorAll("button.selected").forEach((b) => b.classList.remove("selected"));
        newBtn.classList.add("selected");
        applyColors(newBtn, newOpt);
    });
    addBtn.id = "addBtn";
    bar.appendChild(addBtn);

    // load options
    const options = await loadOptions();
    for (let opt of options) createOptionElement(bar, opt);

    // click ra ngoài để đóng menu
    document.addEventListener("click", () => {
        document.querySelectorAll(".menu-popup").forEach(m => m.style.display = "none");
    });
})();
