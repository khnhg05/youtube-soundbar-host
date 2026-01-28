/**
 * YouTube Option Bar
 * A persistent audio/video control bar for managing multiple media sources
 */

(async function () {
  if (document.getElementById("myOptionBar")) return;

  /* ========================== CONSTANTS ============================= */
  const CONFIG = {
    KEYBOARD: {
      DEFAULT_KEYS: ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'z', 'x', 'c', 'v', 'b', 'n', 'm']
    },
    COLORS: {
      DEFAULT: "#666",
      DEFAULT_PLAY: "lime",
      BACKGROUND_PALETTE: [
        "#1a1a1a",
        "#2d2d2d",
        "#404040",
        "#555555",
        "#6b6b6b",
        "#1e3a8a",
        "#1e40af",
        "#2563eb",
        "#3b82f6",
        "#60a5fa",
        "#166534",
        "#16a34a",
        "#22c55e",
        "#4ade80",
        "#86efac",
        "#991b1b",
        "#dc2626",
        "#ef4444",
        "#f87171",
        "#fca5a5",
        "#78350f",
        "#a16207",
        "#ca8a04",
        "#eab308",
        "#facc15",
        "#581c87",
        "#7e22ce",
        "#a855f7",
        "#c084fc",
        "#e9d5ff",
        "#831843",
        "#be123c",
        "#e11d48",
        "#f43f5e",
        "#fb7185",
      ],
      PLAY_PALETTE: [
        "#00ff00",
        "#32cd32",
        "#7fff00",
        "#adff2f",
        "#ffff00",
        "#ffd700",
        "#ffcc00",
        "#ff9900",
        "#ff0000",
        "#ff4500",
        "#ff6347",
        "#ff7f50",
        "#00ffff",
        "#00ced1",
        "#1e90ff",
        "#4169e1",
        "#ff00ff",
        "#da70d6",
        "#ee82ee",
        "#dda0dd",
      ],
    },
    DB: {
      NAME: "YTOptionBarDB",
      VERSION: 1,
      STORE_NAME: "options",
    },
    DEFAULT_VOLUME: 1,
    MENU_Z_INDEX: 99999999,
  };

  /* ========================== STATE ============================= */
  class AppState {
    constructor() {
      this.audioMap = new Map();
      this.playingTabs = new Set();
      this.keyboardMap = new Map(); // key -> option button
      this.optionButtons = []; // track order for auto-assignment
    }

    getAudio(id) {
      return this.audioMap.get(id);
    }
    setAudio(id, audio) {
      this.audioMap.set(id, audio);
    }
    deleteAudio(id) {
      const audio = this.audioMap.get(id);
      if (audio) {
        audio.pause();
        audio.src = "";
        this.audioMap.delete(id);
      }
    }

    isPlaying(btn) {
      return this.playingTabs.has(btn);
    }
    setPlaying(btn, playing) {
      if (playing) this.playingTabs.add(btn);
      else this.playingTabs.delete(btn);
    }

    // Keyboard shortcut management
    assignKeyToOption(optionButton, key = null) {
      // Remove any existing key assignment for this option
      for (const [k, btn] of this.keyboardMap) {
        if (btn === optionButton) {
          this.keyboardMap.delete(k);
          break;
        }
      }

      // Auto-assign if no key specified
      if (!key) {
        const index = this.optionButtons.indexOf(optionButton);
        if (index >= 0 && index < CONFIG.KEYBOARD.DEFAULT_KEYS.length) {
          key = CONFIG.KEYBOARD.DEFAULT_KEYS[index];
        }
      }

      if (key) {
        this.keyboardMap.set(key.toLowerCase(), optionButton);
        return key;
      }
      return null;
    }

    removeOptionFromKeyboard(optionButton) {
      for (const [key, btn] of this.keyboardMap) {
        if (btn === optionButton) {
          this.keyboardMap.delete(key);
          break;
        }
      }
      const index = this.optionButtons.indexOf(optionButton);
      if (index >= 0) {
        this.optionButtons.splice(index, 1);
      }
    }

    addOptionButton(optionButton) {
      this.optionButtons.push(optionButton);
      return this.assignKeyToOption(optionButton);
    }

    getKeyForOption(optionButton) {
      for (const [key, btn] of this.keyboardMap) {
        if (btn === optionButton) return key;
      }
      return null;
    }
  }

  const state = new AppState();

  /* ========================== DATABASE ============================= */
  class Database {
    static async open() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(CONFIG.DB.NAME, CONFIG.DB.VERSION);

        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(CONFIG.DB.STORE_NAME)) {
            const store = db.createObjectStore(CONFIG.DB.STORE_NAME, {
              keyPath: "id",
              autoIncrement: true,
            });
            store.createIndex("name", "name");
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    static async save(option) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(CONFIG.DB.STORE_NAME, "readwrite");
        const req = tx.objectStore(CONFIG.DB.STORE_NAME).put(option);
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
      });
    }

    static async loadAll() {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(CONFIG.DB.STORE_NAME, "readonly");
        const req = tx.objectStore(CONFIG.DB.STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    static async delete(id) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(CONFIG.DB.STORE_NAME, "readwrite");
        tx.objectStore(CONFIG.DB.STORE_NAME).delete(id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    }
  }

  /* ========================== MEDIA ============================= */
  class MediaPlayer {
    static async play(option, button) {
      if (option.type === "file") return this.playAudio(option, button);
      alert("Chỉ hỗ trợ file MP3");
      return false;
    }

    static updateProgressUI(button, audio) {
      if (!button || !audio) return;
      const bar = button.querySelector('.progress-fill');
      const point = button.querySelector('.progress-point');
      const timeText = button.querySelector('.time-display');

      if (audio.duration) {
        const percent = (audio.currentTime / audio.duration) * 100;
        if (bar) bar.style.width = `${percent}%`;
        if (point) point.style.left = `${percent}%`;
        if (timeText) {
          const format = (s) => {
            const m = Math.floor(s / 60);
            const sec = Math.floor(s % 60);
            return `${m}:${sec.toString().padStart(2, '0')}`;
          };
          timeText.textContent = `${format(audio.currentTime)} / ${format(audio.duration)}`;
        }
      }
    }

    static preload(option, button) {
      if (!option.file) return;

      let audio = state.getAudio(option.id);
      if (!audio) {
        audio = new Audio(URL.createObjectURL(option.file));
        audio.preload = 'metadata'; // Hint to load metadata
        state.setAudio(option.id, audio);
      }

      // Update UI whenever time changes (seeking, playing, etc)
      const update = () => this.updateProgressUI(button, audio);
      audio.ontimeupdate = update;

      // Initial show
      if (audio.readyState >= 1) {
        update();
      } else {
        audio.addEventListener('loadedmetadata', update, { once: true });
      }
    }

    static playAudio(option, button) {
      if (!option.file) {
        alert("Không có file!");
        return false;
      }

      let audio = state.getAudio(option.id);
      if (!audio) {
        // Should be created by preload, but just in case
        this.preload(option, button);
        audio = state.getAudio(option.id);
        if (!audio) return false;
      }

      // Ensure volume is always up to date
      audio.volume = option.volume ?? CONFIG.DEFAULT_VOLUME;

      // Animation loop for smooth UI updates (60fps)
      const animate = () => {
        if (audio.paused) return;
        this.updateProgressUI(button, audio);
        requestAnimationFrame(animate);
      };

      const playing = !audio.paused;
      if (playing) {
        audio.pause();
      } else {
        // Restart logic
        // If user manually sought, play from there. Otherwise restart.
        if (!audio._manualSeek) {
          audio.currentTime = 0;
        }
        audio._manualSeek = false; // Reset flag after use

        audio.play().then(() => {
          requestAnimationFrame(animate);
        }).catch(err => {
          console.error("Failed to play audio:", err);
          alert("Không thể phát file audio!");
        });
      }

      // Reset progress on end
      audio.onended = () => {
        if (button) {
          const bar = button.querySelector('.progress-fill');
          const point = button.querySelector('.progress-point');
          const timeText = button.querySelector('.time-display');

          if (bar) bar.style.width = '0%';
          if (point) point.style.left = '0%';
          if (timeText && audio.duration) {
            // Reset to 0:00 / total
            const format = (s) => {
              const m = Math.floor(s / 60);
              const sec = Math.floor(s % 60);
              return `${m}:${sec.toString().padStart(2, '0')}`;
            };
            timeText.textContent = `0:00 / ${format(audio.duration)}`;
          }

          // Update UI state to paused
          state.setPlaying(button, false);
          UIUtils.applyButtonColors(button, option);
        }
      };

      state.setPlaying(button, !playing);
      return !playing;
    }

    static stop(option) {
      const audio = state.getAudio(option.id);
      if (audio) audio.pause();
    }

    static cleanup(option) {
      if (option.type === "file") state.deleteAudio(option.id);
    }
  }

  /* ========================== UI UTILS ============================= */
  class UIUtils {
    static applyButtonColors(button, option) {
      button.style.background = state.isPlaying(button)
        ? option.playColor || CONFIG.COLORS.DEFAULT_PLAY
        : CONFIG.COLORS.DEFAULT;
    }

    static createMenuItem(label, handler) {
      const el = document.createElement("div");
      el.textContent = label;
      el.style.cssText = `
        padding: 4px 8px; cursor: pointer; color:#fff;
      `;
      el.onmouseenter = () => (el.style.background = "#444");
      el.onmouseleave = () => (el.style.background = "transparent");
      el.onclick = (e) => {
        e.stopPropagation();
        handler();
        el.closest(".menu-popup").style.display = "none";
      };
      return el;
    }

    static positionMenu(menu, trigger) {
      const r = trigger.getBoundingClientRect();
      let left = r.right - menu.offsetWidth;
      let top = r.bottom + 4;

      if (left < 6) left = 6;
      if (top + menu.offsetHeight > innerHeight - 6)
        top = r.top - menu.offsetHeight - 6;

      menu.style.left = left + "px";
      menu.style.top = top + "px";
    }
  }

  /* ========================== REMOTE AUTH ============================= */
  class AuthManager {
    static get API_URL() {
      return "https://script.google.com/macros/s/AKfycbySxY8hYEPnRkaDrv0P0HkMVfk_etzNzttT2Q1CZC_aTjmMsEOLx1T7C3v84_78TtG2/exec";
    }

    static async getDeviceId() {
      return new Promise((resolve) => {
        chrome.storage.local.get(["device_id"], (r) => {
          if (r.device_id) {
            resolve(r.device_id);
          } else {
            // Generate random ID: timestamp + random string
            const newId = "DEV-" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5).toUpperCase();
            chrome.storage.local.set({ device_id: newId }, () => resolve(newId));
          }
        });
      });
    }

    static async checkStatus() {
      try {
        const id = await this.getDeviceId();
        const res = await fetch(`${this.API_URL}?action=check&deviceId=${id}`);
        const data = await res.json();
        return data.status || "ERROR"; // NEW, PENDING, APPROVED, REVOKED
      } catch (e) {
        console.error("Auth Check Failed:", e);
        return "OFFLINE"; // Fallback logic (block or allow?) -> Let's Block for security
      }
    }

    static async sendRequest(note) {
      // RATE LIMIT CHECK
      const lastReq = await new Promise(r => chrome.storage.local.get("last_auth_req", q => r(q.last_auth_req || 0)));
      const now = Date.now();
      if (now - lastReq < 30000) {
        const wait = Math.ceil((30000 - (now - lastReq)) / 1000);
        alert(`Vui lòng chờ ${wait} giây để gửi lại yêu cầu!`);
        return false;
      }

      const id = await this.getDeviceId();
      const payload = {
        deviceId: id,
        note: note,
        user_agent: navigator.userAgent
      };

      const startT = Date.now();
      const res = await fetch(this.API_URL, {
        method: "POST",
        // mode: "no-cors", // Use standard CORS since we have host_permissions
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const endT = Date.now();

      // Check for server errors
      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const responseData = await res.json().catch(() => ({}));
      if (responseData.error) {
        alert("Server Error: " + responseData.error);
        return false;
      }

      chrome.storage.local.set({ last_auth_req: now });
      return endT - startT;
    }
  }

  class LockUI {
    static async startFlow(onUnlock) {
      const overlay = document.createElement("div");
      overlay.id = "auth-overlay";
      overlay.style.cssText = `
        position: fixed; inset: 0; background: #1a1a1a;
        z-index: 2147483647; display: flex; flex-direction: column;
        align-items: center; justify-content: center; color: white;
        font-family: sans-serif;
      `;
      document.body.appendChild(overlay);

      const render = (html) => {
        overlay.innerHTML = `
          <div style="background:rgba(45, 45, 45, 0.75); backdrop-filter: blur(16px); padding:30px; border-radius:16px; border:1px solid rgba(255,255,255,0.1); max-width:400px; text-align:center; box-shadow:0 8px 32px 0 rgba(0, 0, 0, 0.37);">
            <h2 style="margin-top:0; color:#3b82f6; text-shadow: 0 0 10px rgba(59, 130, 246, 0.5);">MLA Soundbar Access Request</h2>
            ${html}
          </div>
        `;
      };

      const checkAndRender = async () => {
        render("<p>Đang kiểm tra quyền truy cập...</p>");
        const status = await AuthManager.checkStatus();
        const devId = await AuthManager.getDeviceId();

        if (status === "APPROVED") {
          overlay.remove();
          onUnlock();
          return;
        }

        if (status === "PENDING") {
          render(`
                <p style="font-size:1.1em">Yêu cầu đang chờ duyệt.</p>
                <div style="background:#333; padding:10px; border-radius:6px; margin:15px 0; font-family:monospace;">${devId}</div>
                <p style="color:#aaa; font-size:0.9em">Vui lòng liên hệ Admin.</p>
                <button id="auth-reload" style="cursor:pointer; padding:10px 20px; background:#2563eb; color:white; border:none; border-radius:6px;">
                  Kiểm tra lại
                </button>
             `);
          document.getElementById("auth-reload").onclick = checkAndRender;
          setTimeout(() => { if (document.body.contains(overlay)) checkAndRender(); }, 10000);
        } else if (status === "REVOKED") {
          render(`
                <h3 style="color:#ef4444">Truy cập bị chặn (REVOKED)</h3>
                <p>Thiết bị này đã bị Admin thu hồi quyền.</p>
                <div style="font-family:monospace; color:#666; font-size:12px; margin-top:10px">${devId}</div>
             `);
        } else {
          render(`
                <p>Thiết bị chưa được đăng ký.</p>
                <div style="text-align:left; margin:15px 0;">
                    <label style="display:block; font-size:12px; margin-bottom:5px; color:#aaa">Ghi chú (Tên bạn/Lý do):</label>
                    <input id="auth-note" type="text" placeholder="Ví dụ: Laptop công ty..." style="width:100%; box-sizing:border-box; padding:8px; border-radius:4px; border:1px solid #555; background:#111; color:white;">
                </div>
                <button id="auth-req" style="width:100%; cursor:pointer; padding:10px; background:#16a34a; color:white; border:none; border-radius:6px; font-weight:bold;">
                  Gửi Yêu Cầu
                </button>
                <div style="font-family:monospace; color:#444; font-size:10px; margin-top:15px">ID: ${devId}</div>
             `);

          document.getElementById("auth-req").onclick = async () => {
            const note = document.getElementById("auth-note").value;
            if (!note.trim()) { alert("Vui lòng nhập ghi chú!"); return; }

            render("<p>Đang gửi yêu cầu...</p>");
            const duration = await AuthManager.sendRequest(note);
            if (duration) alert(`Gửi yêu cầu thành công! Thời gian: ${duration}ms`);
            checkAndRender();
          };
        }
      };

      checkAndRender();
    }
  }

  /* ========================== OPTION BUTTON ============================= */
  class OptionButton {
    constructor(bar, option) {
      this.bar = bar;
      this.option = option;
      this.element = null;
      this.menu = null;
      this.keyboardKey = null;
    }

    async create() {
      // Register this button and get auto-assigned key
      this.keyboardKey = state.addOptionButton(this);

      const btn = document.createElement("button");
      btn.style.cssText = `
        background:${this.option.color || CONFIG.COLORS.DEFAULT};
        color:#fff; border:none; padding:5px 8px; padding-bottom: 9px; border-radius:4px;
        display:flex; align-items:center; gap:5px; position:relative; overflow: hidden;
      `;
      btn._optRef = this.option;

      const keySpan = document.createElement("span");
      keySpan.style.cssText = `
        background:rgba(0,0,0,0.3); padding:2px 4px; border-radius:3px;
        font-size:10px; min-width:12px; text-align:center;
      `;
      keySpan.textContent = this.keyboardKey || '';
      btn.appendChild(keySpan);

      const nameSpan = document.createElement("span");
      nameSpan.textContent = this.option.name;
      btn.appendChild(nameSpan);

      const vol = this.createVolumeSlider();
      btn.appendChild(vol);

      const menuBtn = this.createMenuButton();
      btn.appendChild(menuBtn);

      // Create Progress Bar
      const progressContainer = document.createElement("div");
      progressContainer.style.cssText = `
        position: absolute; bottom: 0; left: 0; right: 0; height: 12px;
        background: transparent; z-index: 10; cursor: pointer;
      `;
      // background for visual bar
      const barBg = document.createElement("div");
      barBg.style.cssText = `
         position: absolute; bottom: 0; left: 0; right: 0; height: 4px;
         background: rgba(0,0,0,0.3); pointer-events: none;
      `;
      progressContainer.appendChild(barBg);

      const progressFill = document.createElement("div");
      progressFill.classList.add('progress-fill');
      progressFill.style.cssText = `
        position: absolute; bottom: 0; left: 0;
        width: 0%; height: 4px; background: rgba(255,255,255,0.7);
        pointer-events: none;
      `;
      progressContainer.appendChild(progressFill);

      const progressPoint = document.createElement("div");
      progressPoint.classList.add('progress-point');
      progressPoint.style.cssText = `
        position: absolute; bottom: -2px; left: 0%; transform: translateX(-50%);
        width: 8px; height: 8px; background: #444; border: 1px solid #fff; border-radius: 50%;
        box-shadow: 0 0 2px rgba(0,0,0,0.5); pointer-events: none;
      `;
      progressContainer.appendChild(progressPoint);

      btn.appendChild(progressContainer);

      // Seek functionality
      progressContainer.onclick = (e) => {
        e.stopPropagation();
        const rect = progressContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = Math.max(0, Math.min(1, x / rect.width));

        const audio = state.getAudio(this.option.id);
        if (audio && audio.duration) {
          audio.currentTime = percent * audio.duration;
          audio._manualSeek = true; // Flag to tell playAudio to resume
        }
      };

      // Time Display
      const timeDisplay = document.createElement("div");
      timeDisplay.classList.add('time-display');
      timeDisplay.textContent = "0:00 / 0:00";
      timeDisplay.style.cssText = `
        position: absolute; bottom: 8px; right: 4px;
        font-size: 9px; color: rgba(255,255,255,0.9);
        pointer-events: none;
        background: rgba(0,0,0,0.4);
        padding: 1px 3px; border-radius: 3px;
      `;
      btn.appendChild(timeDisplay);

      this.element = btn;

      this.menu = await this.createMenu(nameSpan, keySpan);

      btn.onclick = (e) => {
        if (e.target.classList.contains("menu-btn")) return;
        this.handleClick();
      };

      // Preload metadata to show duration
      MediaPlayer.preload(this.option, btn);

      return btn;
    }

    createVolumeSlider() {
      const s = document.createElement("input");
      s.type = "range";
      s.min = 0;
      s.max = 1;
      s.step = 0.01;
      s.value = this.option.volume ?? CONFIG.DEFAULT_VOLUME;
      s.style.width = "50px";

      s.oninput = () => {
        this.option.volume = parseFloat(s.value);
        const audio = state.getAudio(this.option.id);
        if (audio) audio.volume = this.option.volume;
        Database.save(this.option);
      };

      return s;
    }

    createMenuButton() {
      const b = document.createElement("span");
      b.textContent = "⋮";
      b.classList.add("menu-btn");
      b.style.cssText = `
        cursor:pointer; padding:5px; user-select:none;
      `;
      b.onclick = (e) => {
        e.stopPropagation();
        this.toggleMenu();
      };
      return b;
    }

    async createMenu(nameSpan, keySpan) {
      const m = document.createElement("div");
      m.classList.add("menu-popup");
      m.style.cssText = `
        display:none; position:fixed;
        background: rgba(30, 30, 30, 0.85); backdrop-filter: blur(12px);
        border:1px solid rgba(255,255,255,0.15); padding:5px; border-radius:8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        z-index:${CONFIG.MENU_Z_INDEX};
      `;
      document.body.appendChild(m);

      m.appendChild(
        UIUtils.createMenuItem("Sửa tên", () => this.handleRename(nameSpan))
      );
      m.appendChild(
        UIUtils.createMenuItem("Đổi phím tắt", () => this.handleChangeKey(keySpan))
      );
      m.appendChild(
        UIUtils.createMenuItem("Đổi màu nền", () => this.handleChangeColor())
      );
      m.appendChild(
        UIUtils.createMenuItem("Màu khi phát", () =>
          this.handleChangePlayColor()
        )
      );
      m.appendChild(
        UIUtils.createMenuItem("Upload file MP3", () =>
          this.handleChangeMedia()
        )
      );
      m.appendChild(UIUtils.createMenuItem("Xóa", () => this.handleDelete()));

      return m;
    }

    toggleMenu() {
      const open = this.menu.style.display === "flex";
      document
        .querySelectorAll(".menu-popup")
        .forEach((m) => (m.style.display = "none"));
      if (!open) {
        this.menu.style.display = "flex";
        UIUtils.positionMenu(
          this.menu,
          this.element.querySelector(".menu-btn")
        );
      }
    }

    handleClick() {
      this.bar.querySelectorAll("button.selected").forEach((btn) => {
        btn.classList.remove("selected");
        UIUtils.applyButtonColors(btn, btn._optRef);
      });

      this.element.classList.add("selected");
      MediaPlayer.play(this.option, this.element);
      UIUtils.applyButtonColors(this.element, this.option);
    }

    async handleRename(nameSpan) {
      const newName = prompt("Tên mới:", this.option.name);
      if (newName?.trim()) {
        this.option.name = newName.trim();
        nameSpan.textContent = this.option.name;
        await Database.save(this.option);
      }
    }

    async handleChangeKey(keySpan) {
      const currentKey = state.getKeyForOption(this) || '';
      const newKey = prompt(`Phím tắt hiện tại: "${currentKey}"\nNhập phím tắt mới (a-z, 0-9):`, currentKey);

      if (newKey === null) return; // user cancelled

      if (newKey === '') {
        // Remove custom key, revert to auto-assignment
        const autoKey = state.assignKeyToOption(this);
        keySpan.textContent = autoKey || '';
        this.keyboardKey = autoKey;
      } else if (/^[a-z0-9]$/i.test(newKey)) {
        const key = newKey.toLowerCase();
        // Check if key is already used
        if (state.keyboardMap.has(key)) {
          alert(`Phím "${key}" đã được sử dụng!`);
          return;
        }
        state.assignKeyToOption(this, key);
        keySpan.textContent = key;
        this.keyboardKey = key;
      } else {
        alert('Chỉ chấp nhận 1 ký tự (a-z, 0-9)');
      }
    }

    async handleChangeColor() {
      this.showColorPicker(
        "Chọn màu nền",
        CONFIG.COLORS.BACKGROUND_PALETTE,
        async (color) => {
          this.option.color = color;
          this.element.style.background = color;
          await Database.save(this.option);
        }
      );
    }

    async handleChangePlayColor() {
      this.showColorPicker(
        "Màu khi phát",
        CONFIG.COLORS.PLAY_PALETTE,
        async (color) => {
          this.option.playColor = color;
          await Database.save(this.option);
        }
      );
    }

    showColorPicker(title, palette, onSelect) {
      const overlay = document.createElement("div");
      overlay.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,0.7);
        z-index:${CONFIG.MENU_Z_INDEX}; display:flex;
        align-items:center; justify-content:center;
      `;
      overlay.onclick = () => overlay.remove();

      const picker = document.createElement("div");
      picker.style.cssText = `
        background: rgba(30, 30, 30, 0.85); backdrop-filter: blur(12px);
        border:1px solid rgba(255,255,255,0.15);
        border-radius:16px; padding:20px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      `;
      picker.onclick = (e) => e.stopPropagation();

      const titleEl = document.createElement("div");
      titleEl.textContent = title;
      titleEl.style.cssText = `
        color:#fff; font-size:16px; font-weight:bold; margin-bottom:16px;
      `;
      picker.appendChild(titleEl);

      const grid = document.createElement("div");
      grid.style.cssText = `
        display:grid; grid-template-columns:repeat(5,1fr);
        gap:8px; margin-bottom:16px;
      `;

      palette.forEach((color) => {
        const s = document.createElement("button");
        s.style.cssText = `
          width:40px; height:40px; background:${color};
          border:2px solid #444; border-radius:6px; cursor:pointer;
        `;
        s.onclick = () => {
          onSelect(color);
          overlay.remove();
        };
        grid.appendChild(s);
      });

      picker.appendChild(grid);

      const custom = document.createElement("input");
      custom.type = "color";
      custom.style.cssText = `
        width:60px; height:35px; cursor:pointer;
      `;
      custom.onchange = () => {
        onSelect(custom.value);
        overlay.remove();
      };

      picker.appendChild(custom);
      overlay.appendChild(picker);
      document.body.appendChild(overlay);
    }

    async handleChangeMedia() {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".mp3";

      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;

        // Cleanup old audio before setting new file
        MediaPlayer.cleanup(this.option);

        this.option.file = file;
        await Database.save(this.option);

        // Preload new file
        MediaPlayer.preload(this.option, this.element);
      };

      input.click();
    }

    async handleDelete() {
      MediaPlayer.cleanup(this.option);
      await Database.delete(this.option.id);
      state.removeOptionFromKeyboard(this);
      this.element.remove();
      this.menu.remove();
    }
  }

  /* ========================== MAIN BAR ============================= */
  async function initBar() {
    // Wait for Remote Auth
    await new Promise(resolve => LockUI.startFlow(resolve));

    const bar = document.createElement("div");
    bar.id = "myOptionBar";
    bar.style.cssText = `
      position:fixed; bottom:0; left:0; right:0; height:50px;
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.35);
      padding:6px; display:flex; gap:8px;
      align-items:center; z-index:9999999; 
      flex-wrap: wrap; align-content: flex-start; overflow-y: auto;
      transition: height 0.1s;
    `;

    document.body.appendChild(bar);

    // RESIZE HANDLE
    const handle = document.createElement("div");
    handle.style.cssText = `
        position: absolute; top: 0; left: 0; right: 0; height: 5px;
        cursor: ns-resize; z-index: 10000000;
    `;
    // Add a visual hint
    const handleLine = document.createElement("div");
    handleLine.style.cssText = `
         width: 100px; height: 3px; background: rgba(255,255,255,0.3);
         border-radius: 2px; margin: 1px auto;
    `;
    handle.appendChild(handleLine);
    handle.onmouseenter = () => handleLine.style.background = "rgba(255,255,255,0.6)";
    handle.onmouseleave = () => handleLine.style.background = "rgba(255,255,255,0.3)";

    bar.appendChild(handle);

    // Drag Logic
    let isDragging = false;
    let startY = 0;
    let startHeight = 0;

    handle.onmousedown = (e) => {
      isDragging = true;
      startY = e.clientY;
      startHeight = bar.offsetHeight;
      document.body.style.cursor = 'ns-resize';
      e.preventDefault();
    };

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const delta = startY - e.clientY; // Drag up increases height
      let newHeight = startHeight + delta;

      // Approximate row height ~ 54px (50px min + gaps)
      const rowHeight = 54;
      const minHeight = 50;
      const maxHeight = window.innerHeight; // Max limit

      // Snap logic
      if (newHeight < minHeight) newHeight = minHeight;
      if (newHeight > maxHeight) newHeight = maxHeight;

      // Calculate target rows
      const rows = Math.round(newHeight / rowHeight);
      let snappedHeight = Math.max(minHeight, rows * rowHeight + (rows > 1 ? 6 : 0)); // Adjust for padding

      if (snappedHeight > maxHeight) snappedHeight = maxHeight;

      bar.style.height = `${snappedHeight}px`;

      // Update minimize button position if visible
      if (!minimized) {
        minimizeBtn.style.bottom = `${snappedHeight + 2}px`;
      }
    });

    const stopDrag = () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = '';
      }
    };
    document.addEventListener('mouseup', stopDrag);

    // PAUSE ALL BUTTON

    // PAUSE ALL BUTTON
    const pauseAllBtn = document.createElement("button");
    pauseAllBtn.textContent = "⏸";
    pauseAllBtn.style.cssText = `
  font-size:20px; padding:0 12px; height:36px;
  cursor:pointer; background:#444; color:white; border:none;
  border-radius:4px;
`;
    pauseAllBtn.onclick = () => {
      // Pause all playing audio
      for (const audio of state.audioMap.values()) {
        audio.pause();
      }

      // Reset tất cả nút đang sáng
      state.playingTabs.forEach((btn) => {
        state.setPlaying(btn, false);
        UIUtils.applyButtonColors(btn, btn._optRef);
      });

      state.playingTabs.clear();
    };

    bar.appendChild(pauseAllBtn);
    // MINIMIZE BUTTON (absolute floating)
    const minimizeBtn = document.createElement("button");
    minimizeBtn.textContent = "—";
    minimizeBtn.style.cssText = `
  position: fixed;
  bottom: 52px;          /* nằm ngay trên soundbar */
  right: 20px;
  z-index: 999999999;
  font-size: 18px;
  padding: 6px 12px;
  background: #444;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0,0,0,0.25);
`;
    document.body.appendChild(minimizeBtn);

    let minimized = false;

    minimizeBtn.onclick = () => {
      minimized = !minimized;

      if (minimized) {
        // Thu soundbar xuống ngoài màn hình
        bar.style.transform = "translateY(100%)";
        minimizeBtn.textContent = "▢";
        minimizeBtn.style.bottom = "10px";   // chuyển gần mép dưới
      } else {
        bar.style.transform = "translateY(0)";
        minimizeBtn.textContent = "—";
        // Place button just above the bar
        minimizeBtn.style.bottom = `${bar.offsetHeight + 2}px`;
      }
    };

    const addBtn = document.createElement("button");
    addBtn.textContent = "+";
    addBtn.style.cssText = `
      font-size:20px; padding:0 10px; height:36px; cursor:pointer;
      background: #444; color: #fff; border: none; border-radius: 4px;
    `;
    addBtn.onclick = async () => {
      try {
        const option = {
          id: Date.now(),
          name: "New",
          type: "file",
          volume: 1,
          color: CONFIG.COLORS.DEFAULT,
        };
        await Database.save(option);

        const ob = new OptionButton(bar, option);
        bar.appendChild(await ob.create());

        // Auto-scroll/resize if overflow
        if (bar.scrollHeight > bar.offsetHeight) {
          const rowHeight = 54;
          let newHeight = Math.ceil(bar.scrollHeight / rowHeight) * rowHeight + 6;
          if (newHeight > window.innerHeight) newHeight = window.innerHeight;
          bar.style.height = `${newHeight}px`;
        }
      } catch (err) {
        console.error("Add failed:", err);
        alert("Lỗi khi thêm mới: " + err.message);
      }
    };

    bar.appendChild(addBtn);

    const saved = await Database.loadAll();
    for (const option of saved) {
      const ob = new OptionButton(bar, option);
      bar.appendChild(await ob.create());
    }
  }

  // Keyboard event listener for shortcuts
  document.addEventListener('keydown', (e) => {
    // Don't trigger if user is typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }

    const key = e.key.toLowerCase();
    const optionButton = state.keyboardMap.get(key);

    if (optionButton && optionButton.element) {
      e.preventDefault();
      optionButton.handleClick();
    }
  });

  initBar();
})();
