/* ==========================================================================
   INDEXEDDB STORAGE MANAGER (Books, Folders, Covers, Highlights & Bookmarks)
   ========================================================================== */

const DB_NAME = 'PDFBookReaderDB';
const DB_VERSION = 1;

class DatabaseManager {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        // Books Store
        if (!db.objectStoreNames.contains('books')) {
          const bookStore = db.createObjectStore('books', { keyPath: 'id' });
          bookStore.createIndex('folderId', 'folderId', { unique: false });
          bookStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Folders Store
        if (!db.objectStoreNames.contains('folders')) {
          const folderStore = db.createObjectStore('folders', { keyPath: 'id' });
          folderStore.createIndex('name', 'name', { unique: false });
        }

        // Highlights Store
        if (!db.objectStoreNames.contains('highlights')) {
          const highlightStore = db.createObjectStore('highlights', { keyPath: 'id' });
          highlightStore.createIndex('bookId', 'bookId', { unique: false });
          highlightStore.createIndex('bookPage', ['bookId', 'pageNum'], { unique: false });
        }

        // Bookmarks Store
        if (!db.objectStoreNames.contains('bookmarks')) {
          const bookmarkStore = db.createObjectStore('bookmarks', { keyPath: 'id' });
          bookmarkStore.createIndex('bookId', 'bookId', { unique: false });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error('IndexedDB error:', e.target.error);
        reject(e.target.error);
      };
    });
  }

  // --- GENERIC PROMISE WRAPPERS ---
  async getStore(storeName, mode = 'readonly') {
    if (!this.db) await this.init();
    const tx = this.db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  }

  // --- FOLDERS ---
  async getAllFolders() {
    const store = await this.getStore('folders');
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
    });
  }

  async saveFolder(folder) {
    const store = await this.getStore('folders', 'readwrite');
    return new Promise((resolve) => {
      const req = store.put(folder);
      req.onsuccess = () => resolve(req.result);
    });
  }

  async deleteFolder(folderId) {
    const store = await this.getStore('folders', 'readwrite');
    return new Promise((resolve) => {
      const req = store.delete(folderId);
      req.onsuccess = () => resolve();
    });
  }

  // --- BOOKS ---
  async getAllBooks() {
    const store = await this.getStore('books');
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
    });
  }

  async getBook(id) {
    const store = await this.getStore('books');
    return new Promise((resolve) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
    });
  }

  async saveBook(book) {
    const store = await this.getStore('books', 'readwrite');
    return new Promise((resolve) => {
      const req = store.put(book);
      req.onsuccess = () => resolve(req.result);
    });
  }

  async deleteBook(id) {
    const store = await this.getStore('books', 'readwrite');
    return new Promise((resolve) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
    });
  }

  // --- HIGHLIGHTS ---
  async getHighlightsForBook(bookId) {
    const store = await this.getStore('highlights');
    return new Promise((resolve) => {
      const index = store.index('bookId');
      const req = index.getAll(bookId);
      req.onsuccess = () => resolve(req.result || []);
    });
  }

  async saveHighlight(highlight) {
    const store = await this.getStore('highlights', 'readwrite');
    return new Promise((resolve) => {
      const req = store.put(highlight);
      req.onsuccess = () => resolve(req.result);
    });
  }

  async deleteHighlight(id) {
    const store = await this.getStore('highlights', 'readwrite');
    return new Promise((resolve) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
    });
  }

  // --- BOOKMARKS ---
  async getBookmarksForBook(bookId) {
    const store = await this.getStore('bookmarks');
    return new Promise((resolve) => {
      const index = store.index('bookId');
      const req = index.getAll(bookId);
      req.onsuccess = () => resolve(req.result || []);
    });
  }

  async saveBookmark(bookmark) {
    const store = await this.getStore('bookmarks', 'readwrite');
    return new Promise((resolve) => {
      const req = store.put(bookmark);
      req.onsuccess = () => resolve(req.result);
    });
  }

  async deleteBookmark(id) {
    const store = await this.getStore('bookmarks', 'readwrite');
    return new Promise((resolve) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
    });
  }
}

window.dbManager = new DatabaseManager();
