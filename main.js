// main.js - YouTube SoundBar Injector
// Mã nguồn được thiết kế để chạy độc lập (pure JS) và không cần build step.

(function() {
    'use strict';

    // --- CẤU HÌNH VÀ HẰNG SỐ ---
    const NAMESPACE = '__YTSoundBar__';
    const LS_KEY = 'yt_soundbar_sounds';
    const YT_URL_PATTERN = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
    const INITIAL_SOUND_ID = 'sample-default';

    // Kiểm tra và thoát nếu script đã được chạy
    if (window[NAMESPACE] && window[NAMESPACE].isInitialized) {
        console.warn('SoundBar đã được khởi tạo. Bỏ qua việc inject.');
        return;
    }

    // --- UTILITIES (TIỆN ÍCH CHUNG) ---
    const Utils = {
        generateId: () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5),

        // Thêm CSS vào DOM
        injectCSS: () => {
            const style = document.createElement('style');
            style.type = 'text/css';
            style.innerHTML = `
                /* Base SoundBar Container */
                #${NAMESPACE}_container {
                    position: fixed; bottom: 20px; right: 20px; width: 350px; max-width: 95%; min-height: 50px;
                    background: #282828; border: 1px solid #4d4d4d; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.7);
                    z-index: 99999999; font-family: Roboto, Arial, sans-serif; color: #fff;
                    transition: transform 0.3s ease-in-out; padding: 10px; display: flex; flex-direction: column;
                }
                .${NAMESPACE}_hidden { transform: translateY(120%) !important; pointer-events: none; }
                .${NAMESPACE}_header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 5px; border-bottom: 1px solid #4d4d4d; margin-bottom: 10px; }
                .${NAMESPACE}_close_btn { background: none; border: none; color: #fff; font-size: 18px; cursor: pointer; padding: 0 5px; line-height: 1; opacity: 0.8; }
                .${NAMESPACE}_tabs_wrapper { display: flex; align-items: center; margin-bottom: 10px; }
                .${NAMESPACE}_tabs { display: flex; overflow-x: auto; white-space: nowrap; flex-grow: 1; margin-right: 5px; scrollbar-width: none; }
                .${NAMESPACE}_tabs::-webkit-scrollbar { display: none; }
                .${NAMESPACE}_tab { padding: 8px 12px; background: #3a3a3a; border: 1px solid #5a5a5a; border-radius: 4px; margin-right: 5px; cursor: pointer; font-size: 14px; flex-shrink: 0; display: flex; align-items: center; }
                .${NAMESPACE}_tab_active { background: #c00; border-color: #c00; }
                .${NAMESPACE}_add_btn { background: #5a5a5a; color: #fff; border: none; border-radius: 4px; font-size: 20px; line-height: 1; padding: 4px 8px; cursor: pointer; flex-shrink: 0; }
                .${NAMESPACE}_content { flex-grow: 1; padding: 5px 0; min-height: 100px; overflow-y: auto; }
                .${NAMESPACE}_sound_detail { border: 1px solid #5a5a5a; padding: 10px; border-radius: 4px; margin-bottom: 10px; }
                .${NAMESPACE}_control_group { display: flex; gap: 10px; margin-top: 10px; align-items: center; }
                .${NAMESPACE}_control_btn { padding: 8px 15px; background: #c00; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; line-height: 1; }
                .${NAMESPACE}_control_btn_pause { background: #3a3a3a; }
                .${NAMESPACE}_delete_btn { background: #5a5a5a; }
                .${NAMESPACE}_volume_solo { display: flex; align-items: center; gap: 10px; margin-top: 15px; }
                .${NAMESPACE}_volume_solo input[type="range"] { width: 100px; -webkit-appearance: none; background: #5a5a5a; height: 5px; border-radius: 5px; cursor: pointer; }
                .${NAMESPACE}_tab_state { font-size: 10px; color: #ccc; margin-left: 5px; display: inline-block; }
                .state_playing::before { content: "▶️ "; color: #32CD32; }
                .state_paused::before { content: "⏸️ "; color: #FFD700; }
                .state_loading::before { content: "⏳ "; color: #87CEEB; }
                .state_error::before { content: "❌ "; color: #FF6347; }
                [data-tooltip] { position: relative; }
                [data-tooltip]:hover:after { /* Tooltip CSS */
                    content: attr(data-tooltip); position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%);
                    background: #000; color: #fff; padding: 5px 8px; border-radius: 3px; font-size: 12px; white-space: nowrap; margin-bottom: 5px; z-index: 10000;
                }
                @media (max-width: 600px) {
                    #${NAMESPACE}_container { bottom: 0; right: 0; left: 0; width: auto; max-width: none; border-radius: 8px 8px 0 0; }
                }
                .${NAMESPACE}_yt_iframe { display: none; width: 1px; height: 1px; position: absolute; top: -100px; left: -100px; }
            `;
            document.head.appendChild(style);
        },

        // Tải xuống JSON
        downloadJson: (data, filename) => {
            try {
                const json = JSON.stringify(data, null, 2);
                const blob = new Blob([json], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename || 'soundbar_playlist.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } catch (e) {
                alert('Lỗi khi xuất file: ' + e.message);
            }
        },

        getYTVideoId: (url) => {
            const match = url.match(YT_URL_PATTERN);
            return match ? match[4] : null;
        }
    };

    // --- SOUND TAB CLASS (LỚP ÂM THANH) ---
    class SoundTab {
        constructor(manager, soundData) {
            this.manager = manager;
            this.id = soundData.id;
            this.title = soundData.title;
            this.type = soundData.type;
            this.source = soundData.source;
            this.initialVolume = soundData.volume || 1.0;
            this.isSolo = soundData.isSolo || false;
            this.player = null;
            this.state = 'paused';
            this.volume = this.initialVolume;
            this.createPlayer();
        }

        createPlayer() {
            try {
                if (this.type === 'file' || this.type === 'url') {
                    this.player = new Audio(this.source);
                    this.player.volume = this.volume;
                    this.player.loop = true;
                    this.player.addEventListener('play', () => this.updateState('playing'));
                    this.player.addEventListener('pause', () => this.updateState('paused'));
                    this.player.addEventListener('error', (e) => {
                        console.error('Lỗi Audio:', e);
                        this.updateState('error', 'Lỗi phát file.');
                    });
                } else if (this.type === 'youtube') {
                    const videoId = Utils.getYTVideoId(this.source);
                    if (!videoId) throw new Error('URL YouTube không hợp lệ.');
                    const iframe = document.createElement('iframe');
                    iframe.id = `${NAMESPACE}_yt_player_${this.id}`;
                    iframe.className = NAMESPACE + '_yt_iframe';
                    iframe.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=0&controls=0&loop=1&playlist=${videoId}&mute=1`;
                    iframe.setAttribute('frameborder', '0');
                    iframe.setAttribute('allow', 'autoplay; encrypted-media');
                    document.getElementById(NAMESPACE + '_container').appendChild(iframe);
                    this.player = iframe;
                    window.addEventListener('message', this.handleYTMessage.bind(this), false);
                } else {
                    throw new Error('Loại âm thanh không xác định.');
                }
            } catch (e) {
                this.updateState('error', e.message);
            }
        }

        postMessage(command, value = null) {
            if (this.type !== 'youtube' || !this.player || !this.player.contentWindow) return;
            const message = JSON.stringify({ event: 'command', func: command, args: value !== null ? [value] : [] });
            this.player.contentWindow.postMessage(message, '*');
        }

        handleYTMessage(event) {
            if (!event.origin.includes('youtube.com') && !event.origin.includes('googlevideo.com')) return;
            try {
                const data = JSON.parse(event.data);
                if (data.event === 'onReady' && data.id === this.player.id) {
                    this.postMessage('setVolume', this.volume * 100);
                    this.updateState('paused');
                } else if (data.event === 'onStateChange' && data.id === this.player.id) {
                    const state = data.info; // 1: playing, 2: paused, 3: buffering
                    if (state === 1) this.updateState('playing');
                    else if (state === 2) this.updateState('paused');
                    else if (state === 3) this.updateState('loading');
                }
            } catch (e) {/* Not a player message */ }
        }

        updateState(newState, errorMessage = null) {
            if (this.state === newState) return;
            this.state = newState;
            this.manager.ui.updateTabState(this.id, newState, errorMessage);

            if (newState === 'playing' && this.isSolo) {
                this.manager.soundList.forEach(s => {
                    if (s.id !== this.id && s.state === 'playing') s.pause();
                });
            }
            this.manager.saveSounds();
        }

        play() {
            if (this.state === 'playing' || this.state === 'loading') return;
            this.updateState('loading');

            if (this.type === 'file' || this.type === 'url') {
                this.player.play().catch(e => {
                    this.updateState('error', 'Autoplay bị chặn.');
                    alert(`Không thể tự động phát âm thanh cho ${this.title}. Cần có tương tác người dùng.`);
                });
            } else if (this.type === 'youtube') {
                this.postMessage('unMute');
                this.postMessage('playVideo');
            }
        }

        pause() {
            if (this.state === 'paused' || this.state === 'error') return;

            if (this.type === 'file' || this.type === 'url') {
                this.player.pause();
            } else if (this.type === 'youtube') {
                this.postMessage('pauseVideo');
                this.postMessage('mute');
            }
            this.updateState('paused');
        }

        setVolume(newVolume) {
            this.volume = parseFloat(newVolume);
            if (this.type === 'file' || this.type === 'url') {
                this.player.volume = this.volume;
            } else if (this.type === 'youtube') {
                this.postMessage('setVolume', this.volume * 100);
            }
            this.manager.updateSoundData(this.id, { volume: this.volume });
        }

        toggleSolo(isSolo) {
            this.isSolo = isSolo;
            this.manager.updateSoundData(this.id, { isSolo: this.isSolo });
            if (this.isSolo && this.state === 'playing') {
                this.manager.soundList.forEach(s => {
                    if (s.id !== this.id && s.state === 'playing') s.pause();
                });
            }
        }

        destroy() {
            this.pause();
            if (this.type === 'youtube' && this.player) {
                window.removeEventListener('message', this.handleYTMessage);
                this.player.parentNode.removeChild(this.player);
            }
            if (this.type === 'file' && this.source.startsWith('blob:')) {
                URL.revokeObjectURL(this.source);
            }
            this.player = null;
        }
    }


    // --- SOUND MANAGER (QUẢN LÝ ÂM THANH) ---
    class SoundManager {
        constructor(ui) {
            this.ui = ui;
            this.soundData = [];
            this.soundList = [];
            this.activeSoundId = null;
            this.loadSounds();
            this.initializeDefaultOrLoad();
        }

        loadSounds() {
            try {
                const data = localStorage.getItem(LS_KEY);
                this.soundData = data ? JSON.parse(data) : [];
            } catch (e) { console.error('Lỗi khi tải từ localStorage:', e); this.soundData = []; }
        }

        saveSounds() {
            try {
                const dataToSave = this.soundList.map(s => ({
                    id: s.id, title: s.title, type: s.type,
                    source: s.type === 'file' ? 'Requires re-upload' : s.source, // Chỉ lưu placeholder cho file
                    volume: s.volume, isSolo: s.isSolo
                }));
                localStorage.setItem(LS_KEY, JSON.stringify(dataToSave));
                this.soundData = dataToSave;
            } catch (e) { console.error('Lỗi khi lưu vào localStorage:', e); }
        }

        initializeDefaultOrLoad() {
            if (this.soundData.length === 0) {
                this.addSound({
                    title: 'Sample (URL)', type: 'url',
                    source: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', id: INITIAL_SOUND_ID
                });
                this.activeSoundId = INITIAL_SOUND_ID;
            } else {
                this.soundData.forEach(data => {
                    this.soundList.push(new SoundTab(this, data));
                });
                this.activeSoundId = this.soundList[0] ? this.soundList[0].id : null;
            }
            this.ui.renderTabs(this.soundList, this.activeSoundId);
        }

        addSound(data) {
            const soundData = { id: Utils.generateId(), volume: 1.0, isSolo: false, ...data };
            const newSound = new SoundTab(this, soundData);
            this.soundList.push(newSound);
            this.activeSoundId = newSound.id;
            this.saveSounds();
            this.ui.renderTabs(this.soundList, this.activeSoundId);
            this.ui.renderSoundDetail(newSound);
            return newSound;
        }

        deleteSound(id) {
            const index = this.soundList.findIndex(s => s.id === id);
            if (index !== -1) {
                this.soundList[index].destroy();
                this.soundList.splice(index, 1);
                this.saveSounds();
                if (this.activeSoundId === id) {
                    this.activeSoundId = this.soundList[0] ? this.soundList[0].id : null;
                }
                this.ui.renderTabs(this.soundList, this.activeSoundId);
                this.ui.renderSoundDetail(this.getSound(this.activeSoundId));
            }
        }

        getSound(id) {
            return this.soundList.find(s => s.id === id);
        }

        updateSoundData(id, newProps) {
            const sound = this.getSound(id);
            if (sound) {
                Object.assign(sound, newProps);
                this.saveSounds();
            }
        }

        setActive(id) {
            if (this.activeSoundId === id) return;
            this.activeSoundId = id;
            this.ui.renderTabs(this.soundList, id);
            this.ui.renderSoundDetail(this.getSound(id));
        }

        importPlaylist(jsonData) {
            if (!Array.isArray(jsonData)) { alert('File JSON không hợp lệ.'); return; }
            this.soundList.forEach(s => s.destroy());
            this.soundList = [];
            jsonData.forEach(data => {
                const importData = {
                    id: Utils.generateId(), title: data.title || 'Imported Sound', type: data.type,
                    source: data.type === 'file' ? 'Requires re-upload' : data.source,
                    volume: data.volume || 1.0, isSolo: data.isSolo || false
                };
                this.soundList.push(new SoundTab(this, importData));
            });
            this.activeSoundId = this.soundList[0] ? this.soundList[0].id : null;
            this.saveSounds();
            this.ui.renderTabs(this.soundList, this.activeSoundId);
            this.ui.renderSoundDetail(this.getSound(this.activeSoundId));
            alert(`Đã nhập thành công ${this.soundList.length} âm thanh.`);
        }

        exportPlaylist() {
            const exportData = this.soundList.map(s => ({
                title: s.title, type: s.type,
                source: s.type === 'file' ? s.title : s.source,
                volume: s.volume, isSolo: s.isSolo
            }));
            Utils.downloadJson(exportData, 'soundbar_playlist.json');
        }
    }

    // --- UI/RENDERER (GIAO DIỆN) ---
    class SoundBarUI {
        constructor() {
            this.container = null; this.contentArea = null; this.soundManager = null; this.modal = null;
        }

        init(manager) {
            this.soundManager = manager;
            Utils.injectCSS();
            this.renderSoundBar();
            this.setupKeyboardShortcut();
        }

        renderSoundBar() {
            // (Rút gọn việc tạo DOM, sử dụng innerHTML cho nhanh)
            this.container = document.createElement('div');
            this.container.id = NAMESPACE + '_container';
            this.container.innerHTML = `
                <div class="${NAMESPACE}_header"><strong>🎶 YouTube SoundBar</strong><button class="${NAMESPACE}_close_btn" data-tooltip="Đóng/Mở (Ctrl+Shift+S)">&times;</button></div>
                <div class="${NAMESPACE}_tabs_wrapper"><div class="${NAMESPACE}_tabs"></div><button class="${NAMESPACE}_add_btn" data-tooltip="Thêm Sound mới">+</button></div>
                <div class="${NAMESPACE}_content"></div>
                <div class="${NAMESPACE}_utility_group"><button class="${NAMESPACE}_control_btn" id="${NAMESPACE}_import_btn">Import JSON</button><button class="${NAMESPACE}_control_btn" id="${NAMESPACE}_export_btn">Export JSON</button></div>
            `;
            document.body.appendChild(this.container);

            this.contentArea = this.container.querySelector(`.${NAMESPACE}_content`);
            
            // Setup Event Listeners
            this.container.querySelector(`.${NAMESPACE}_close_btn`).addEventListener('click', () => this.toggleSoundBar());
            this.container.querySelector(`.${NAMESPACE}_add_btn`).addEventListener('click', () => this.showAddSoundModal());
            this.container.querySelector(`#${NAMESPACE}_export_btn`).addEventListener('click', () => this.soundManager.exportPlaylist());
            this.container.querySelector(`#${NAMESPACE}_import_btn`).addEventListener('click', () => this.showImportModal());

            this.renderSoundDetail(this.soundManager.getSound(this.soundManager.activeSoundId));
        }

        renderTabs(soundList, activeId) {
            const tabsContainer = this.container.querySelector(`.${NAMESPACE}_tabs`);
            tabsContainer.innerHTML = '';
            soundList.forEach(sound => {
                const tab = document.createElement('button');
                tab.className = `${NAMESPACE}_tab ${sound.id === activeId ? NAMESPACE + '_tab_active' : ''}`;
                tab.textContent = sound.title;
                tab.setAttribute('data-id', sound.id);
                const stateSpan = document.createElement('span');
                stateSpan.className = `${NAMESPACE}_tab_state state_${sound.state}`;
                stateSpan.textContent = sound.state;
                tab.appendChild(stateSpan);
                tab.addEventListener('click', () => this.soundManager.setActive(sound.id));
                tabsContainer.appendChild(tab);
            });
            tabsContainer.querySelector(`.${NAMESPACE}_tab_active`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        updateTabState(id, newState, errorMessage) {
            const tab = this.container.querySelector(`.${NAMESPACE}_tab[data-id="${id}"]`);
            if (tab) {
                const stateSpan = tab.querySelector(`.${NAMESPACE}_tab_state`);
                stateSpan.className = `${NAMESPACE}_tab_state state_${newState}`;
                stateSpan.textContent = newState;
                if (this.soundManager.activeSoundId === id) {
                    this.renderSoundDetail(this.soundManager.getSound(id));
                }
            }
        }

        renderSoundDetail(sound) {
            this.contentArea.innerHTML = '';
            if (!sound) { this.contentArea.innerHTML = '<p style="padding: 10px;">Không có âm thanh nào được chọn. Nhấn "+" để thêm.</p>'; return; }

            const isFileReuploadNeeded = sound.type === 'file' && sound.source === 'Requires re-upload';
            const detailDiv = document.createElement('div');
            detailDiv.className = NAMESPACE + '_sound_detail';

            let html = `
                <h4>${sound.title} (${sound.type})</h4>
                <p>Nguồn: <code>${isFileReuploadNeeded ? 'Chỉ là metadata' : sound.source}</code></p>
                ${isFileReuploadNeeded ?
                    `<p style="color: yellow; margin-top: 10px;">⚠️ **Cần Tải lại File:** Link file đã hết hạn. Vui lòng chọn lại file gốc.</p>
                     <div class="${NAMESPACE}_form_group"><input type="file" id="${NAMESPACE}_re_upload_${sound.id}" accept="audio/*"></div>` : ''
                }
                <div class="${NAMESPACE}_control_group">
                    <button class="${NAMESPACE}_control_btn ${sound.state === 'playing' ? NAMESPACE + '_control_btn_pause' : ''}" id="${NAMESPACE}_play_pause_${sound.id}" ${isFileReuploadNeeded ? 'disabled' : ''}>
                        ${sound.state === 'playing' ? '⏸️ Tạm dừng' : '▶️ Phát'}
                    </button>
                    <button class="${NAMESPACE}_control_btn ${NAMESPACE}_delete_btn" id="${NAMESPACE}_delete_${sound.id}" data-tooltip="Xóa Sound này">🗑️ Xóa</button>
                </div>
                <div class="${NAMESPACE}_volume_solo" style="margin-top: 15px;">
                    <label>Âm lượng:</label>
                    <input type="range" id="${NAMESPACE}_volume_slider_${sound.id}" min="0" max="1" step="0.01" value="${sound.volume}" ${isFileReuploadNeeded ? 'disabled' : ''}>
                    <label>Solo:</label>
                    <input type="checkbox" id="${NAMESPACE}_solo_toggle_${sound.id}" ${sound.isSolo ? 'checked' : ''}>
                </div>
                <p style="margin-top: 10px; font-size: 12px;">Trạng thái: <span class="${NAMESPACE}_tab_state state_${sound.state}">${sound.state}</span></p>
            `;
            detailDiv.innerHTML = html;
            this.contentArea.appendChild(detailDiv);

            if (!isFileReuploadNeeded) {
                detailDiv.querySelector(`#${NAMESPACE}_play_pause_${sound.id}`).addEventListener('click', () => {
                    sound.state === 'playing' ? sound.pause() : sound.play();
                });
                detailDiv.querySelector(`#${NAMESPACE}_volume_slider_${sound.id}`).addEventListener('input', (e) => {
                    sound.setVolume(e.target.value);
                });
            }
            detailDiv.querySelector(`#${NAMESPACE}_delete_${sound.id}`).addEventListener('click', () => {
                if (confirm(`Bạn có chắc chắn muốn xóa âm thanh "${sound.title}"?`)) this.soundManager.deleteSound(sound.id);
            });
            detailDiv.querySelector(`#${NAMESPACE}_solo_toggle_${sound.id}`).addEventListener('change', (e) => {
                sound.toggleSolo(e.target.checked);
            });

            const reUploadInput = detailDiv.querySelector(`#${NAMESPACE}_re_upload_${sound.id}`);
            if (reUploadInput) {
                reUploadInput.addEventListener('change', (e) => this.handleFileReUpload(e, sound));
            }
        }
        
        handleFileReUpload(e, sound) {
            const file = e.target.files[0];
            if (!file || !file.type.startsWith('audio/')) { alert('Vui lòng chọn một file âm thanh hợp lệ.'); return; }
            try {
                const newBlobUrl = URL.createObjectURL(file);
                sound.source = newBlobUrl;
                sound.title = file.name;
                sound.createPlayer(); 
                sound.updateState('paused');
                this.soundManager.saveSounds();
                this.renderTabs(this.soundManager.soundList, sound.id);
                this.renderSoundDetail(sound);
                alert(`Đã tải lại file "${file.name}" thành công!`);
            } catch (error) { console.error('Lỗi khi tải lại file:', error); alert('Lỗi khi tải lại file.'); }
        }

        showAddSoundModal() {
            if (this.modal) return;
            // (HTML cho modal được rút gọn do giới hạn ký tự, sử dụng style đã định nghĩa)
            const modalEl = document.createElement('div');
            modalEl.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 100000000; display: flex; justify-content: center; align-items: center;';
            modalEl.innerHTML = `
                <div style="background: #282828; padding: 20px; border-radius: 8px; width: 350px; color: #fff; box-shadow: 0 0 20px rgba(0,0,0,0.8);">
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #4d4d4d; margin-bottom: 15px;"><h4>Thêm Sound Mới</h4><button class="${NAMESPACE}_close_btn" id="${NAMESPACE}_modal_close">&times;</button></div>
                    <div class="${NAMESPACE}_form_group"><label for="${NAMESPACE}_sound_type">Loại Nguồn:</label><select id="${NAMESPACE}_sound_type" style="width: 100%; padding: 8px; border: 1px solid #5a5a5a; background: #3a3a3a; color: #fff; border-radius: 4px; box-sizing: border-box;"><option value="url">Link Audio/MP3/OGG</option><option value="youtube">Link YouTube Video</option><option value="file">Tải lên từ máy</option></select></div>
                    <div class="${NAMESPACE}_form_group"><label for="${NAMESPACE}_sound_title">Tên Sound:</label><input type="text" id="${NAMESPACE}_sound_title" placeholder="Tên hiển thị" style="width: 100%; padding: 8px; border: 1px solid #5a5a5a; background: #3a3a3a; color: #fff; border-radius: 4px; box-sizing: border-box;"></div>
                    <div class="${NAMESPACE}_form_group"><label for="${NAMESPACE}_sound_source_text">Nguồn:</label><input type="text" id="${NAMESPACE}_sound_source_text" placeholder="https://domain.com/audio.mp3" style="width: 100%; padding: 8px; border: 1px solid #5a5a5a; background: #3a3a3a; color: #fff; border-radius: 4px; box-sizing: border-box;">
                    <input type="file" id="${NAMESPACE}_sound_source_file" accept="audio/*" style="display: none; width: 100%; padding: 8px; border: 1px solid #5a5a5a; background: #3a3a3a; color: #fff; border-radius: 4px; box-sizing: border-box;"></div>
                    <button class="${NAMESPACE}_control_btn" id="${NAMESPACE}_modal_add" style="width: 100%; background: #070; margin-top: 10px;">Thêm Sound</button>
                </div>
            `;
            document.body.appendChild(modalEl);
            this.modal = modalEl;

            // Logic xử lý modal (Rút gọn)
            const typeSelect = modalEl.querySelector(`#${NAMESPACE}_sound_type`);
            const sourceText = modalEl.querySelector(`#${NAMESPACE}_sound_source_text`);
            const sourceFile = modalEl.querySelector(`#${NAMESPACE}_sound_source_file`);
            const titleInput = modalEl.querySelector(`#${NAMESPACE}_sound_title`);
            const addButton = modalEl.querySelector(`#${NAMESPACE}_modal_add`);
            const updateSourceInput = () => { sourceText.style.display = typeSelect.value === 'file' ? 'none' : 'block'; sourceFile.style.display = typeSelect.value === 'file' ? 'block' : 'none'; };
            typeSelect.addEventListener('change', updateSourceInput);
            updateSourceInput();
            modalEl.querySelector(`#${NAMESPACE}_modal_close`).addEventListener('click', () => this.closeModal());
            
            addButton.addEventListener('click', () => {
                const type = typeSelect.value; let title = titleInput.value.trim(); let source = null;
                if (type === 'file') {
                    const file = sourceFile.files[0];
                    if (!file || !file.type.startsWith('audio/')) { alert('Vui lòng chọn file âm thanh.'); return; }
                    source = URL.createObjectURL(file);
                    if (!title) title = file.name;
                } else {
                    source = sourceText.value.trim();
                    if (!source || (type === 'youtube' && !Utils.getYTVideoId(source))) { alert('URL không hợp lệ.'); return; }
                    if (!title) title = source.length > 30 ? source.substring(0, 27) + '...' : source;
                }
                this.soundManager.addSound({ title, type, source });
                this.closeModal();
            });
        }

        showImportModal() {
            if (this.modal) return;
            // (HTML cho modal import)
            const modalEl = document.createElement('div');
            modalEl.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 100000000; display: flex; justify-content: center; align-items: center;';
            modalEl.innerHTML = `<div style="background: #282828; padding: 20px; border-radius: 8px; width: 350px; color: #fff; box-shadow: 0 0 20px rgba(0,0,0,0.8);"><div style="display: flex; justify-content: space-between; border-bottom: 1px solid #4d4d4d; margin-bottom: 15px;"><h4>Import Playlist JSON</h4><button class="${NAMESPACE}_close_btn" id="${NAMESPACE}_modal_close_import">&times;</button></div><div class="${NAMESPACE}_form_group"><label for="${NAMESPACE}_import_file">Chọn file JSON Playlist:</label><input type="file" id="${NAMESPACE}_import_file" accept=".json" style="width: 100%; padding: 8px; border: 1px solid #5a5a5a; background: #3a3a3a; color: #fff; border-radius: 4px; box-sizing: border-box;"></div><p style="font-size: 12px; color: #ccc;">Lưu ý: Việc Import sẽ **thay thế** toàn bộ danh sách hiện tại.</p><button class="${NAMESPACE}_control_btn" id="${NAMESPACE}_modal_import_run" style="width: 100%; background: #070; margin-top: 10px;">Import và Tải lại</button></div>`;
            document.body.appendChild(modalEl);
            this.modal = modalEl;

            // Logic xử lý import (Rút gọn)
            const fileInput = modalEl.querySelector(`#${NAMESPACE}_import_file`);
            modalEl.querySelector(`#${NAMESPACE}_modal_close_import`).addEventListener('click', () => this.closeModal());
            modalEl.querySelector(`#${NAMESPACE}_modal_import_run`).addEventListener('click', () => {
                const file = fileInput.files[0];
                if (!file) { alert('Vui lòng chọn file JSON.'); return; }
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const jsonData = JSON.parse(e.target.result);
                        this.soundManager.importPlaylist(jsonData);
                        this.closeModal();
                    } catch (error) { alert('Lỗi: File không phải là JSON hợp lệ.'); }
                };
                reader.readAsText(file);
            });
        }

        closeModal() {
            if (this.modal) { this.modal.parentNode.removeChild(this.modal); this.modal = null; }
        }

        toggleSoundBar() {
            if (this.container) { this.container.classList.toggle(`${NAMESPACE}_hidden`); }
        }

        setupKeyboardShortcut() {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'S' && e.shiftKey && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    this.toggleSoundBar();
                }
            });
        }
    }


    // --- KHỞI CHẠY (INITIALIZATION) ---
    try {
        if (!window.location.host.includes('youtube.com')) return;
        const soundBarUI = new SoundBarUI();
        const soundManager = new SoundManager(soundBarUI);
        soundBarUI.init(soundManager);

        window[NAMESPACE] = {
            isInitialized: true, manager: soundManager, ui: soundBarUI, toggle: () => soundBarUI.toggleSoundBar()
        };
    } catch (e) {
        console.error('Lỗi nghiêm trọng khi khởi tạo SoundBar:', e);
        if (document.body) {
             const errorDiv = document.createElement('div');
             errorDiv.style.cssText = 'position: fixed; top: 10px; right: 10px; background: red; color: white; padding: 10px; z-index: 1000000000; border-radius: 5px;';
             errorDiv.textContent = 'SoundBar Error: Xem console (F12) để biết chi tiết.';
             document.body.appendChild(errorDiv);
        }
    }

})();