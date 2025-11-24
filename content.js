(async function () {
    if (document.getElementById("myOptionBar")) return;

    // === UTILS ===
    function createBtn(label, onClick) {
        const btn = document.createElement("button");
        btn.textContent = label;
        btn.onclick = onClick;
        return btn;
    }

    const playingTabs = new Set(); // các tab đang phát

    // === INDEXEDDB LOGIC ===
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
            tx.oncomplete = () => resolve();
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
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    // === AUDIO MANAGER ===
    const audioMap = {};

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

        // hiệu ứng mở
        tabBtn.style.boxShadow = "0 0 10px 2px yellow";
        setTimeout(() => (tabBtn.style.boxShadow = ""), 500);

        // cập nhật màu tab play
        if (isPlaying) {
            playingTabs.add(tabBtn);
            tabBtn.style.background = opt.playColor || "lime";
        } else {
            playingTabs.delete(tabBtn);
            tabBtn.style.background = opt.color || "#444";
        }
    }

    function parseYTID(url) {
        const match = url.match(/[?&]v=([^&]+)/);
        return match ? match[1] : url;
    }

    // === CREATE OPTION ELEMENT ===
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

        // CLICK TAB = chọn + play/pause
        btn.onclick = (e) => {
            e.stopPropagation();

            // clear selected cũ
            bar.querySelectorAll("button.selected").forEach((b) =>
                b.classList.remove("selected")
            );

            btn.classList.add("selected");
            playPause(opt, btn);
        };

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
        menuBtn.style.cursor = "pointer";
        menuBtn.style.marginLeft = "5px";
        btn.appendChild(menuBtn);

        // POPUP MENU
        const menu = document.createElement("div");
        menu.style.display = "none";
        menu.style.position = "fixed";
        menu.style.flexDirection = "column";
        menu.style.background = "#333";
        menu.style.border = "1px solid #555";
        menu.style.padding = "5px";
        menu.style.zIndex = 99999999;

        function makeMenuItem(label, handler) {
            const item = document.createElement("div");
            item.textContent = label;
            item.style.cursor = "pointer";
            item.onclick = handler;
            return item;
        }

        menu.appendChild(
            makeMenuItem("Sửa tên", (e) => {
                e.stopPropagation();
                const newName = prompt("Tên mới:", opt.name);
                if (newName) {
                    opt.name = newName;
                    btn.childNodes[0].nodeValue = newName;
                    saveOption(opt);
                }
                menu.style.display = "none";
            })
        );

        menu.appendChild(
            makeMenuItem("Đổi màu", (e) => {
                e.stopPropagation();
                const newColor = prompt("Màu nền:", opt.color || "#444");
                if (newColor) {
                    opt.color = newColor;
                    btn.style.background = newColor;
                    saveOption(opt);
                }
                menu.style.display = "none";
            })
        );

        menu.appendChild(
            makeMenuItem("Màu khi phát", (e) => {
                e.stopPropagation();
                const colors = ["lime", "yellow", "orange", "red", "cyan", "magenta"];
                const choice = prompt(
                    "Chọn màu (lime/yellow/orange/red/cyan/magenta):",
                    opt.playColor || "lime"
                );
                if (choice && colors.includes(choice)) {
                    opt.playColor = choice;
                    saveOption(opt);
                }
                menu.style.display = "none";
            })
        );

        menu.appendChild(
            makeMenuItem("Upload file / YouTube", async (e) => {
                e.stopPropagation();
                const choice = confirm(
                    "OK = Upload file audio\nCancel = Nhập link YouTube"
                );
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
                    const url = prompt("Nhập link YouTube:");
                    if (url) {
                        opt.type = "youtube";
                        opt.youtubeURL = url;

                        const div = document.createElement("div");
                        div.style.display = "none";
                        const id = `ytplayer-${opt.id}`;
                        div.id = id;
                        document.body.appendChild(div);

                        function createPlayer() {
                            opt.youtubePlayer = new YT.Player(id, {
                                height: "0",
                                width: "0",
                                videoId: parseYTID(url)
                            });
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
            })
        );

        menu.appendChild(
            makeMenuItem("Xóa", async (e) => {
                e.stopPropagation();
                if (confirm("Xóa option này?")) {
                    await deleteOption(opt.id);
                    btn.remove();
                }
                menu.style.display = "none";
            })
        );

        btn.appendChild(menu);

        // MỞ POPUP MENU (luôn nổi)
menuBtn.onclick = (e) => {
    e.stopPropagation();

    // show menu tạm để lấy kích thước
    menu.style.display = "flex";
    menu.style.position = "fixed";
    menu.style.zIndex = 99999999;

    const r = btn.getBoundingClientRect();
    const mW = menu.offsetWidth;
    const mH = menu.offsetHeight;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    // vị trí mặc định
    let top = r.bottom + 5;
    let left = r.left;

    // === CLAMP X (ngang) ===
    if (left + mW > viewportW) {
        left = viewportW - mW - 8; // tránh mép 8px
    }
    if (left < 0) left = 8;

    // === CLAMP Y (dọc) ===
    if (top + mH > viewportH) {
        top = r.top - mH - 5; // đổi popup lên trên nút
    }
    if (top < 0) top = 8;

    menu.style.top = top + "px";
    menu.style.left = left + "px";
};


        document.addEventListener("click", (e) => {
            if (!menu.contains(e.target) && e.target !== menuBtn) {
                menu.style.display = "none";
            }
        });

        // ==== INSERT TAB LOGIC ====
        const addBtn = bar.querySelector("#addBtn");

        if (insertAfter && insertAfter !== addBtn) {
            bar.insertBefore(btn, insertAfter.nextSibling);
        } else {
            bar.insertBefore(btn, addBtn);
        }

        return btn;
    }

    // === CREATE BAR ===
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

    // MINIMIZE BUTTON
    const minBtn = document.createElement("span");
    minBtn.textContent = "🗕";
    minBtn.style.cursor = "pointer";
    minBtn.style.marginLeft = "auto";
    minBtn.onclick = () => {
        if (bar.style.height === "30px") {
            bar.style.height = "auto";
            bar.style.overflow = "visible";
        } else {
            bar.style.height = "30px";
            bar.style.overflow = "hidden";
        }
    };
    bar.appendChild(minBtn);

    // ADD BUTTON
    const addBtn = createBtn("+", async () => {
        const selectedBtn = bar.querySelector("button.selected") || null;
        const newOpt = {
            name: "New Option",
            type: "file",
            file: null,
            volume: 1,
            color: "#444"
        };
        await saveOption(newOpt);

        const newBtn = await createOptionElement(bar, newOpt, selectedBtn);

        // đánh dấu selected tab mới tạo
        bar.querySelectorAll("button.selected").forEach((b) =>
            b.classList.remove("selected")
        );
        newBtn.classList.add("selected");
    });
    addBtn.id = "addBtn";
    bar.appendChild(addBtn);

    // LOAD OPTIONS
    const options = await loadOptions();
    for (let opt of options) createOptionElement(bar, opt);
})();
