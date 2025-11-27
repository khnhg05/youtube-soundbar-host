/**
 * YouTube Option Bar
 * A persistent audio/video control bar for managing multiple media sources
 */

(async function () {
  if (document.getElementById("myOptionBar")) return;

  /* ========================== CONSTANTS ============================= */
  const CONFIG = {
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

    static playAudio(option, button) {
      if (!option.file) {
        alert("Không có file!");
        return false;
      }

      let audio = state.getAudio(option.id);
      if (!audio) {
        audio = new Audio(URL.createObjectURL(option.file));
        audio.loop = false;
        audio.volume = option.volume ?? CONFIG.DEFAULT_VOLUME;
        state.setAudio(option.id, audio);
      }

      // Ensure volume is always up to date
      audio.volume = option.volume ?? CONFIG.DEFAULT_VOLUME;

      const playing = !audio.paused;
      if (playing) {
        audio.pause();
      } else {
        // Resume from current position, don't restart
        audio.play().catch(err => {
          console.error("Failed to play audio:", err);
          alert("Không thể phát file audio!");
        });
      }

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

  /* ========================== OPTION BUTTON ============================= */
  class OptionButton {
    constructor(bar, option) {
      this.bar = bar;
      this.option = option;
      this.element = null;
      this.menu = null;
    }

    async create() {
      const btn = document.createElement("button");
      btn.style.cssText = `
        background:${this.option.color || CONFIG.COLORS.DEFAULT};
        color:#fff; border:none; padding:5px 8px; border-radius:4px;
        display:flex; align-items:center; gap:5px; position:relative;
      `;
      btn._optRef = this.option;

      const nameSpan = document.createElement("span");
      nameSpan.textContent = this.option.name;
      btn.appendChild(nameSpan);

      const vol = this.createVolumeSlider();
      btn.appendChild(vol);

      const menuBtn = this.createMenuButton();
      btn.appendChild(menuBtn);

      this.menu = await this.createMenu(nameSpan);

      btn.onclick = (e) => {
        if (e.target.classList.contains("menu-btn")) return;
        this.handleClick();
      };

      this.element = btn;
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

    async createMenu(nameSpan) {
      const m = document.createElement("div");
      m.classList.add("menu-popup");
      m.style.cssText = `
        display:none; position:fixed; background:#333;
        border:1px solid #555; padding:5px; border-radius:4px;
        z-index:${CONFIG.MENU_Z_INDEX};
      `;
      document.body.appendChild(m);

      m.appendChild(
        UIUtils.createMenuItem("Sửa tên", () => this.handleRename(nameSpan))
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
        background:#2a2a2a; border:2px solid #444;
        border-radius:12px; padding:20px;
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
        MediaPlayer.cleanup(this.option);
      };

      input.click();
    }

    async handleDelete() {
      MediaPlayer.cleanup(this.option);
      await Database.delete(this.option.id);
      this.element.remove();
      this.menu.remove();
    }
  }

  /* ========================== MAIN BAR ============================= */
  async function initBar() {
    const bar = document.createElement("div");
    bar.id = "myOptionBar";
    bar.style.cssText = `
      position:fixed; bottom:0; left:0; right:0; height:50px;
      background: rgba(255,255,255,0.15);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.35);
      padding:6px; display:flex; gap:8px;
      align-items:center; z-index:9999999; overflow-x:auto;
    `;

    document.body.appendChild(bar);

    // PAUSE ALL BUTTON
    const pauseAllBtn = document.createElement("button");
    pauseAllBtn.textContent = "⏸";
    pauseAllBtn.style.cssText = `
  font-size:20px; padding:0 12px; height:100%;
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
    bar.style.transform = "translateY(60px)";
    minimizeBtn.textContent = "▢";
    minimizeBtn.style.bottom = "10px";   // chuyển gần mép dưới
  } else {
    bar.style.transform = "translateY(0)";
    minimizeBtn.textContent = "—";
    minimizeBtn.style.bottom = "52px";   // trở về vị trí cũ
  }
};

    const addBtn = document.createElement("button");
    addBtn.textContent = "+";
    addBtn.style.cssText = `
      font-size:20px; padding:0 10px; height:100%; cursor:pointer;
    `;
    addBtn.onclick = async () => {
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
    };

    bar.appendChild(addBtn);

    const saved = await Database.loadAll();
    for (const option of saved) {
      const ob = new OptionButton(bar, option);
      bar.appendChild(await ob.create());
    }
  }

  initBar();
})();
