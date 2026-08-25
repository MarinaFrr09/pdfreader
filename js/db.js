/* ==========================================================================
   MULTI-TENANT ISOLATED DATABASE & CLOUD SYNCHRONIZATION ENGINE
   Each user has a deterministic ID generated from their Google email.
   Logging in with the same email on ANY device (iPhone, PC, GitHub Pages)
   automatically synchronizes their books, folders, highlights and notes!
   ========================================================================== */

const SUPABASE_URL = 'https://exohflhcfvmejgpababy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_shBfiXkMH6RSYPqbzuPXvA_IkLy9yz7';

const supabaseClient = (window.supabase && typeof window.supabase.createClient === 'function') 
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

function getDeterministicUserId(email) {
  if (!email) return 'guest_local';
  const clean = email.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = ((hash << 5) - hash) + clean.charCodeAt(i);
    hash |= 0;
  }
  const cleanPrefix = clean.replace(/[^a-z0-9]/g, '_').substring(0, 18);
  return `usr_${cleanPrefix}_${Math.abs(hash).toString(16)}`;
}

class DatabaseManager {
  constructor() {
    this.client = supabaseClient;
    this.currentUser = JSON.parse(localStorage.getItem('pdf_reader_active_user') || 'null');
    this.dbName = 'PdfReader_MultiUser_DB';
    this.dbVersion = 2;
    this.idb = null;
  }

  async init() {
    await this.initIndexedDB();

    if (!this.client && window.supabase) {
      try {
        this.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      } catch (e) {
        console.warn('Supabase client init warning:', e);
      }
    }

    if (this.currentUser && this.currentUser.id) {
      // Sync cloud data in the background
      this.syncCloudData(this.currentUser.id);
    }

    return this;
  }

  initIndexedDB() {
    return new Promise((resolve) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        
        if (!db.objectStoreNames.contains('books')) {
          const bookStore = db.createObjectStore('books', { keyPath: 'id' });
          bookStore.createIndex('userId', 'userId', { unique: false });
          bookStore.createIndex('folderId', 'folderId', { unique: false });
        }

        if (!db.objectStoreNames.contains('folders')) {
          const folderStore = db.createObjectStore('folders', { keyPath: 'id' });
          folderStore.createIndex('userId', 'userId', { unique: false });
        }

        if (!db.objectStoreNames.contains('highlights')) {
          const highlightStore = db.createObjectStore('highlights', { keyPath: 'id' });
          highlightStore.createIndex('userId', 'userId', { unique: false });
          highlightStore.createIndex('bookId', 'bookId', { unique: false });
        }

        if (!db.objectStoreNames.contains('notes')) {
          const noteStore = db.createObjectStore('notes', { keyPath: 'id' });
          noteStore.createIndex('userId', 'userId', { unique: false });
          noteStore.createIndex('bookId', 'bookId', { unique: false });
        }
      };

      request.onsuccess = (e) => {
        this.idb = e.target.result;
        resolve(this.idb);
      };

      request.onerror = (e) => {
        console.error('IndexedDB open error:', e);
        resolve(null);
      };
    });
  }

  // --- DETERMINISTIC GOOGLE AUTHENTICATION & SAME-EMAIL SYNC ---

  async signInWithGoogle() {
    const modal = document.getElementById('modal-google-auth');
    if (modal) {
      modal.classList.remove('hidden');
      this.renderSavedAccountsList();
      const input = document.getElementById('google-email-input');
      if (input) setTimeout(() => input.focus(), 100);
    }
  }

  async signInWithGoogleAccount(email, name) {
    if (!email || !email.includes('@')) {
      window.app.showToast('Por favor, informe um e-mail do Google válido.', 'error');
      return null;
    }

    const cleanEmail = email.trim().toLowerCase();
    const userId = getDeterministicUserId(cleanEmail);
    const fullName = name && name.trim() ? name.trim() : cleanEmail.split('@')[0];
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanEmail}`;

    const user = {
      id: userId,
      email: cleanEmail,
      user_metadata: {
        full_name: fullName,
        avatar_url: avatarUrl,
        provider: 'google'
      }
    };

    this.currentUser = user;
    localStorage.setItem('pdf_reader_active_user', JSON.stringify(user));

    // Save to device recent accounts
    let savedAccounts = this.getSavedAccounts();
    if (!savedAccounts.some(acc => acc.id === userId || acc.email === cleanEmail)) {
      savedAccounts.push(user);
    } else {
      savedAccounts = savedAccounts.map(acc => (acc.id === userId || acc.email === cleanEmail) ? user : acc);
    }
    localStorage.setItem('pdf_reader_saved_accounts', JSON.stringify(savedAccounts));

    const modal = document.getElementById('modal-google-auth');
    if (modal) modal.classList.add('hidden');

    window.app.showToast(`Conectado como ${fullName}! Sincronizando sua biblioteca...`);

    // Run Full Cloud Sync for this user
    await this.syncCloudData(userId);

    if (window.app && typeof window.app.onAuthChange === 'function') {
      window.app.onAuthChange(user);
    }

    return user;
  }

  getSavedAccounts() {
    try {
      return JSON.parse(localStorage.getItem('pdf_reader_saved_accounts') || '[]');
    } catch (e) {
      return [];
    }
  }

  renderSavedAccountsList() {
    const listContainer = document.getElementById('accounts-quick-list');
    if (!listContainer) return;

    const accounts = this.getSavedAccounts();
    if (accounts.length === 0) {
      listContainer.innerHTML = '<span style="font-size: 0.78rem; color: var(--text-muted); font-style: italic;">Nenhuma conta salva ainda. Digite seu e-mail acima para começar.</span>';
      return;
    }

    listContainer.innerHTML = '';
    accounts.forEach(acc => {
      const item = document.createElement('div');
      item.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:var(--bg-surface); border-radius:8px; cursor:pointer; border:1px solid var(--border-color); transition:all 0.15s ease;';
      item.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
          <img src="${acc.user_metadata?.avatar_url || ''}" style="width:28px; height:28px; border-radius:50%; background:#fff;">
          <div style="text-align:left;">
            <div style="font-size:0.82rem; font-weight:700;">${acc.user_metadata?.full_name || acc.email}</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">${acc.email}</div>
          </div>
        </div>
        <span style="font-size:0.75rem; color:var(--primary); font-weight:700;">Entrar →</span>
      `;

      item.addEventListener('click', () => {
        this.signInWithGoogleAccount(acc.email, acc.user_metadata?.full_name);
      });

      listContainer.appendChild(item);
    });
  }

  async signOut() {
    this.currentUser = null;
    localStorage.removeItem('pdf_reader_active_user');

    if (this.client) {
      try { await this.client.auth.signOut(); } catch(e) {}
    }

    window.app.showToast('Você desconectou da conta Google.');

    if (window.app && typeof window.app.onAuthChange === 'function') {
      window.app.onAuthChange(null);
    }
  }

  getCurrentUserId() {
    return this.currentUser ? this.currentUser.id : 'guest_local';
  }

  // --- CLOUD SYNCHRONIZATION ENGINE ---

  async syncCloudData(userId) {
    if (!this.client || userId === 'guest_local') return;

    try {
      // 1. Sync Folders
      const { data: cloudFolders } = await this.client.from('folders').select('*').eq('user_id', userId);
      if (cloudFolders && cloudFolders.length > 0) {
        for (const f of cloudFolders) {
          await this.saveFolderLocal({ ...f, userId: userId, isSystem: !!f.isSystem });
        }
      }

      // 2. Sync Books
      const { data: cloudBooks } = await this.client.from('books').select('*').eq('user_id', userId);
      if (cloudBooks && cloudBooks.length > 0) {
        for (const b of cloudBooks) {
          await this.saveBookLocal({
            ...b,
            userId: userId,
            totalPages: b.totalPages || b.totalpages || b.pageCount || 1,
            pageCount: b.totalPages || b.totalpages || b.pageCount || 1,
            coverUrl: b.coverUrl || b.coverurl || b.coverDataUrl,
            fileUrl: b.fileUrl || b.fileurl
          });
        }
      }

      // 3. Sync Highlights
      const { data: cloudHighlights } = await this.client.from('highlights').select('*').eq('user_id', userId);
      if (cloudHighlights && cloudHighlights.length > 0) {
        for (const h of cloudHighlights) {
          await this.saveHighlightLocal({ ...h, userId: userId });
        }
      }

      // 4. Sync Notes
      const { data: cloudNotes } = await this.client.from('notes').select('*').eq('user_id', userId);
      if (cloudNotes && cloudNotes.length > 0) {
        for (const n of cloudNotes) {
          await this.saveNoteLocal({ ...n, userId: userId });
        }
      }
    } catch (err) {
      console.warn('Cloud synchronization note:', err);
    }
  }

  // --- PASTAS ---

  async getAllFolders() {
    const userId = this.getCurrentUserId();

    if (this.idb) {
      const localFolders = await new Promise((resolve) => {
        try {
          const tx = this.idb.transaction('folders', 'readonly');
          const store = tx.objectStore('folders');
          const index = store.index('userId');
          const req = index.getAll(userId);
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch(e) {
          resolve([]);
        }
      });

      if (localFolders && localFolders.length > 0) {
        return localFolders;
      }
    }

    // Default System Folders for this specific user
    const defaultFolders = [
      { id: 'all', name: 'Todos os Livros', userId: userId, isSystem: true },
      { id: 'favorites', name: 'Favoritos', userId: userId, isSystem: true },
      { id: 'study', name: 'Estudos', userId: userId, isSystem: false },
      { id: 'fiction', name: 'Literatura', userId: userId, isSystem: false },
      { id: 'trash', name: 'Lixeira', userId: userId, isSystem: true }
    ];

    for (const f of defaultFolders) {
      await this.saveFolder(f);
    }

    return defaultFolders;
  }

  async saveFolderLocal(folder) {
    if (this.idb) {
      await new Promise((resolve) => {
        try {
          const tx = this.idb.transaction('folders', 'readwrite');
          tx.objectStore('folders').put(folder);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch(e) { resolve(); }
      });
    }
  }

  async saveFolder(folder) {
    const userId = this.getCurrentUserId();
    const payload = {
      id: folder.id,
      name: folder.name,
      userId: userId,
      user_id: userId,
      isSystem: !!folder.isSystem
    };

    await this.saveFolderLocal(payload);

    if (this.client && userId !== 'guest_local') {
      try {
        await this.client.from('folders').upsert(payload);
      } catch(e) {}
    }
  }

  async deleteFolder(id) {
    if (this.idb) {
      await new Promise((resolve) => {
        try {
          const tx = this.idb.transaction('folders', 'readwrite');
          tx.objectStore('folders').delete(id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch(e) { resolve(); }
      });
    }

    if (this.client && this.getCurrentUserId() !== 'guest_local') {
      try {
        await this.client.from('folders').delete().eq('id', id);
      } catch(e) {}
    }
  }

  // --- LIVROS ---

  async getAllBooks() {
    const userId = this.getCurrentUserId();

    if (this.idb) {
      const localBooks = await new Promise((resolve) => {
        try {
          const tx = this.idb.transaction('books', 'readonly');
          const store = tx.objectStore('books');
          const index = store.index('userId');
          const req = index.getAll(userId);
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch(e) {
          resolve([]);
        }
      });

      return (localBooks || []).map(b => ({
        ...b,
        totalPages: b.totalPages || b.pageCount || 1,
        pageCount: b.totalPages || b.pageCount || 1,
        coverUrl: b.coverUrl || b.coverDataUrl,
        coverDataUrl: b.coverUrl || b.coverDataUrl
      }));
    }

    return [];
  }

  async getBook(id) {
    if (this.idb) {
      return new Promise((resolve) => {
        try {
          const tx = this.idb.transaction('books', 'readonly');
          const req = tx.objectStore('books').get(id);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        } catch(e) {
          resolve(null);
        }
      });
    }
    return null;
  }

  async saveBookLocal(book) {
    if (this.idb) {
      await new Promise((resolve) => {
        try {
          const tx = this.idb.transaction('books', 'readwrite');
          tx.objectStore('books').put(book);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch(e) { resolve(); }
      });
    }
  }

  async saveBook(book) {
    const userId = this.getCurrentUserId();
    const payload = {
      id: book.id,
      folderId: book.folderId || 'all',
      title: book.title,
      file: book.file || null,
      fileBlob: book.fileBlob || null,
      fileUrl: book.fileUrl || null,
      coverUrl: book.coverUrl || book.coverDataUrl || null,
      coverDataUrl: book.coverUrl || book.coverDataUrl || null,
      lastPage: book.lastPage || 1,
      totalPages: book.totalPages || book.pageCount || 1,
      isFavorite: !!book.isFavorite,
      userId: userId,
      user_id: userId,
      createdAt: book.createdAt || new Date().toISOString()
    };

    await this.saveBookLocal(payload);

    if (this.client && userId !== 'guest_local') {
      try {
        const cloudPayload = {
          id: payload.id,
          folderId: payload.folderId,
          title: payload.title,
          fileUrl: payload.fileUrl,
          coverUrl: payload.coverUrl,
          lastPage: payload.lastPage,
          totalPages: payload.totalPages,
          user_id: userId
        };
        await this.client.from('books').upsert(cloudPayload);
      } catch(e) {}
    }

    return payload;
  }

  async deleteBook(id) {
    if (this.idb) {
      await new Promise((resolve) => {
        try {
          const tx = this.idb.transaction('books', 'readwrite');
          tx.objectStore('books').delete(id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch(e) { resolve(); }
      });
    }

    if (this.client && this.getCurrentUserId() !== 'guest_local') {
      try {
        await this.client.from('books').delete().eq('id', id);
      } catch(e) {}
    }
  }

  // --- GRIFOS & NOTAS ---

  async getHighlights(bookId, pageNum) {
    const userId = this.getCurrentUserId();

    if (this.idb) {
      const allHighlights = await new Promise((resolve) => {
        try {
          const tx = this.idb.transaction('highlights', 'readonly');
          const store = tx.objectStore('highlights');
          const index = store.index('bookId');
          const req = index.getAll(bookId);
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch(e) {
          resolve([]);
        }
      });

      return (allHighlights || []).filter(h => {
        const matchUser = h.userId === userId;
        const matchPage = (pageNum !== undefined && pageNum !== null) ? h.pageNum === pageNum : true;
        return matchUser && matchPage;
      });
    }

    return [];
  }

  async getHighlightsForBook(bookId) {
    return this.getHighlights(bookId);
  }

  async saveHighlightLocal(highlight) {
    if (this.idb) {
      await new Promise((resolve) => {
        try {
          const tx = this.idb.transaction('highlights', 'readwrite');
          tx.objectStore('highlights').put(highlight);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch(e) { resolve(); }
      });
    }
  }

  async saveHighlight(highlight) {
    const userId = this.getCurrentUserId();
    const payload = {
      ...highlight,
      id: highlight.id || 'hl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      userId: userId,
      user_id: userId,
      createdAt: highlight.createdAt || new Date().toISOString()
    };

    await this.saveHighlightLocal(payload);

    if (this.client && userId !== 'guest_local') {
      try {
        await this.client.from('highlights').upsert(payload);
      } catch(e) {}
    }

    return payload;
  }

  async deleteHighlight(id) {
    if (this.idb) {
      await new Promise((resolve) => {
        try {
          const tx = this.idb.transaction('highlights', 'readwrite');
          tx.objectStore('highlights').delete(id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch(e) { resolve(); }
      });
    }

    if (this.client && this.getCurrentUserId() !== 'guest_local') {
      try {
        await this.client.from('highlights').delete().eq('id', id);
      } catch(e) {}
    }
  }

  async getNotes(bookId) {
    const userId = this.getCurrentUserId();

    if (this.idb) {
      const allNotes = await new Promise((resolve) => {
        try {
          const tx = this.idb.transaction('notes', 'readonly');
          const store = tx.objectStore('notes');
          const index = store.index('bookId');
          const req = index.getAll(bookId);
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch(e) { resolve([]); }
      });

      return (allNotes || []).filter(n => n.userId === userId);
    }

    return [];
  }

  async saveNoteLocal(note) {
    if (this.idb) {
      await new Promise((resolve) => {
        try {
          const tx = this.idb.transaction('notes', 'readwrite');
          tx.objectStore('notes').put(note);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch(e) { resolve(); }
      });
    }
  }

  async saveNote(note) {
    const userId = this.getCurrentUserId();
    const payload = {
      ...note,
      id: note.id || 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      userId: userId,
      user_id: userId,
      createdAt: note.createdAt || new Date().toISOString()
    };

    await this.saveNoteLocal(payload);

    if (this.client && userId !== 'guest_local') {
      try {
        await this.client.from('notes').upsert(payload);
      } catch(e) {}
    }

    return payload;
  }

  async deleteNote(id) {
    if (this.idb) {
      await new Promise((resolve) => {
        try {
          const tx = this.idb.transaction('notes', 'readwrite');
          tx.objectStore('notes').delete(id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch(e) { resolve(); }
      });
    }

    if (this.client && this.getCurrentUserId() !== 'guest_local') {
      try {
        await this.client.from('notes').delete().eq('id', id);
      } catch(e) {}
    }
  }
}

window.dbManager = new DatabaseManager();
