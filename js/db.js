/* ==========================================================================
   MULTI-TENANT ISOLATED DATABASE & GOOGLE AUTHENTICATION MANAGER
   Each user has their own completely isolated database of books, folders,
   highlights, and notes keyed by their Google Account.
   ========================================================================== */

const SUPABASE_URL = 'https://exohflhcfvmejgpababy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_shBfiXkMH6RSYPqbzuPXvA_IkLy9yz7';

const supabaseClient = (window.supabase && typeof window.supabase.createClient === 'function') 
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

class DatabaseManager {
  constructor() {
    this.client = supabaseClient;
    this.currentUser = JSON.parse(localStorage.getItem('pdf_reader_active_user') || 'null');
    this.dbName = 'PdfReader_MultiUser_DB';
    this.dbVersion = 2;
    this.idb = null;
  }

  async init() {
    // 1. Initialize IndexedDB
    await this.initIndexedDB();

    // 2. Initialize Supabase if available
    if (!this.client && window.supabase) {
      try {
        this.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      } catch (e) {
        console.warn('Supabase client init warning:', e);
      }
    }

    if (this.client) {
      try {
        const { data: { session } } = await this.client.auth.getSession();
        if (session && session.user) {
          this.currentUser = {
            id: session.user.id,
            email: session.user.email,
            user_metadata: session.user.user_metadata || {
              full_name: session.user.email.split('@')[0],
              avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${session.user.email}`
            }
          };
          localStorage.setItem('pdf_reader_active_user', JSON.stringify(this.currentUser));
        }

        this.client.auth.onAuthStateChange((event, session) => {
          if (session && session.user) {
            this.currentUser = {
              id: session.user.id,
              email: session.user.email,
              user_metadata: session.user.user_metadata || {
                full_name: session.user.email.split('@')[0],
                avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${session.user.email}`
              }
            };
            localStorage.setItem('pdf_reader_active_user', JSON.stringify(this.currentUser));
          }
          if (window.app && typeof window.app.onAuthChange === 'function') {
            window.app.onAuthChange(this.currentUser);
          }
        });
      } catch (err) {
        console.warn('Supabase session fetch warning:', err);
      }
    }

    return this;
  }

  initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        
        // Books Store
        if (!db.objectStoreNames.contains('books')) {
          const bookStore = db.createObjectStore('books', { keyPath: 'id' });
          bookStore.createIndex('userId', 'userId', { unique: false });
          bookStore.createIndex('folderId', 'folderId', { unique: false });
        }

        // Folders Store
        if (!db.objectStoreNames.contains('folders')) {
          const folderStore = db.createObjectStore('folders', { keyPath: 'id' });
          folderStore.createIndex('userId', 'userId', { unique: false });
        }

        // Highlights Store
        if (!db.objectStoreNames.contains('highlights')) {
          const highlightStore = db.createObjectStore('highlights', { keyPath: 'id' });
          highlightStore.createIndex('userId', 'userId', { unique: false });
          highlightStore.createIndex('bookId', 'bookId', { unique: false });
        }

        // Notes Store
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

  // --- GOOGLE AUTHENTICATION & MULTI-USER SWITCHER ---

  async signInWithGoogle() {
    // Open Google Sign-In Modal
    const modal = document.getElementById('modal-google-auth');
    if (modal) {
      modal.classList.remove('hidden');
      this.renderSavedAccountsList();
      const input = document.getElementById('google-email-input');
      if (input) setTimeout(() => input.focus(), 100);
      return;
    }
  }

  async signInWithGoogleAccount(email, name) {
    if (!email || !email.includes('@')) {
      window.app.showToast('Por favor, informe um e-mail do Google válido.', 'error');
      return null;
    }

    const cleanEmail = email.trim().toLowerCase();
    const userId = 'usr_' + btoa(cleanEmail).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
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

    // Save to device recent accounts list
    let savedAccounts = this.getSavedAccounts();
    if (!savedAccounts.some(acc => acc.id === userId)) {
      savedAccounts.push(user);
    } else {
      savedAccounts = savedAccounts.map(acc => acc.id === userId ? user : acc);
    }
    localStorage.setItem('pdf_reader_saved_accounts', JSON.stringify(savedAccounts));

    // Close Modal
    const modal = document.getElementById('modal-google-auth');
    if (modal) modal.classList.add('hidden');

    window.app.showToast(`Conectado como ${fullName}! Carregando seu banco de dados...`);

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

  // --- PASTAS (ISOLADAS POR USUÁRIO) ---

  async getAllFolders() {
    const userId = this.getCurrentUserId();

    // 1. Fetch from IndexedDB
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

  async saveFolder(folder) {
    const userId = this.getCurrentUserId();
    const payload = {
      id: folder.id,
      name: folder.name,
      userId: userId,
      user_id: userId,
      isSystem: !!folder.isSystem
    };

    // Save to IndexedDB
    if (this.idb) {
      await new Promise((resolve) => {
        try {
          const tx = this.idb.transaction('folders', 'readwrite');
          const store = tx.objectStore('folders');
          store.put(payload);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch(e) {
          resolve();
        }
      });
    }

    // Sync to Supabase if connected
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

  // --- LIVROS (ISOLADOS POR USUÁRIO) ---

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

    if (this.idb) {
      await new Promise((resolve) => {
        try {
          const tx = this.idb.transaction('books', 'readwrite');
          tx.objectStore('books').put(payload);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch(e) {
          resolve();
        }
      });
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
  }

  // --- GRIFOS & NOTAS (ISOLADOS POR USUÁRIO) ---

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

  async saveHighlight(highlight) {
    const userId = this.getCurrentUserId();
    const payload = {
      ...highlight,
      id: highlight.id || 'hl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      userId: userId,
      user_id: userId,
      createdAt: highlight.createdAt || new Date().toISOString()
    };

    if (this.idb) {
      await new Promise((resolve) => {
        try {
          const tx = this.idb.transaction('highlights', 'readwrite');
          tx.objectStore('highlights').put(payload);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch(e) { resolve(); }
      });
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

  async saveNote(note) {
    const userId = this.getCurrentUserId();
    const payload = {
      ...note,
      id: note.id || 'note_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      userId: userId,
      user_id: userId,
      createdAt: note.createdAt || new Date().toISOString()
    };

    if (this.idb) {
      await new Promise((resolve) => {
        try {
          const tx = this.idb.transaction('notes', 'readwrite');
          tx.objectStore('notes').put(payload);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch(e) { resolve(); }
      });
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
  }
}

window.dbManager = new DatabaseManager();
