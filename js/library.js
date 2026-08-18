/* ==========================================================================
   LIBRARY MANAGER (Folders, PDF Import & Cover Generation)
   ========================================================================== */

class LibraryManager {
  constructor() {
    this.currentFolderId = 'all';
    this.searchQuery = '';
    this.books = [];
    this.folders = [];
  }

  async init() {
    await window.dbManager.init();
    await this.ensureDefaultFolders();
    await this.loadFolders();
    await this.loadBooks();
    this.setupEventListeners();
    this.render();
  }

  async ensureDefaultFolders() {
    const existing = await window.dbManager.getAllFolders();
    const defaults = [
      { id: 'all', name: 'Todos os Livros', isSystem: true },
      { id: 'favorites', name: 'Favoritos', isSystem: true },
      { id: 'study', name: 'Estudos & Faculdade', isSystem: false },
      { id: 'fiction', name: 'Ficção & Lazer', isSystem: false },
      { id: 'trash', name: 'Lixeira', isSystem: true }
    ];

    for (const def of defaults) {
      if (!existing.some(f => f.id === def.id)) {
        await window.dbManager.saveFolder(def);
      }
    }
  }

  async loadFolders() {
    this.folders = await window.dbManager.getAllFolders();
  }

  async loadBooks() {
    this.books = await window.dbManager.getAllBooks();
  }

  setupEventListeners() {
    // New Folder Modal
    const btnNewFolder = document.getElementById('btn-new-folder');
    if (btnNewFolder) {
      btnNewFolder.addEventListener('click', () => this.showFolderModal());
    }

    const formFolder = document.getElementById('form-folder');
    if (formFolder) {
      formFolder.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleCreateFolder();
      });
    }

    // PDF File Import
    const fileInput = document.getElementById('pdf-file-input');
    const btnImport = document.getElementById('btn-import-pdf');

    if (btnImport && fileInput) {
      btnImport.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files));
    }

    // Drag and Drop
    const dropzone = document.getElementById('dropzone');
    if (dropzone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          dropzone.classList.add('drag-over');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          dropzone.classList.remove('drag-over');
        });
      });

      dropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
          this.handleFileSelect(files);
        }
      });
    }

    // Library Search Filter
    const searchInput = document.getElementById('library-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderBooks();
      });
    }
  }

  async showFolderModal() {
    document.getElementById('modal-folder').classList.remove('hidden');
    document.getElementById('folder-name-input').focus();
  }

  async handleCreateFolder() {
    const input = document.getElementById('folder-name-input');
    const name = input.value.trim();
    if (!name) return;

    const newFolder = {
      id: 'folder_' + Date.now(),
      name: name
    };

    await window.dbManager.saveFolder(newFolder);
    input.value = '';
    document.getElementById('modal-folder').classList.add('hidden');
    await this.loadFolders();
    this.renderFolders();
    window.app.showToast(`Pasta "${name}" criada com sucesso!`);
  }

  async handleFileSelect(files) {
    if (!files || files.length === 0) return;

    window.app.showToast('Processando e enviando PDF para a nuvem...', 'info');

    for (const file of files) {
      if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
        window.app.showToast(`O arquivo "${file.name}" não é um PDF válido.`, 'error');
        continue;
      }

      try {
        const { coverDataUrl, pageCount } = await this.generateCoverThumbnail(file);

        const newBook = {
          id: 'book_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          title: file.name.replace(/\.pdf$/i, ''),
          file: file,
          coverUrl: coverDataUrl,
          folderId: this.currentFolderId === 'trash' || this.currentFolderId === 'favorites' ? 'all' : this.currentFolderId,
          totalPages: pageCount || 1,
          lastPage: 1,
          createdAt: new Date().toISOString()
        };

        await window.dbManager.saveBook(newBook);
        window.app.showToast(`Livro "${newBook.title}" salvo com sucesso!`);
      } catch (err) {
        console.error('Error processing PDF file:', err);
        window.app.showToast(`Erro ao carregar o PDF: ${file.name}`, 'error');
      }
    }

    await this.loadBooks();
    this.render();
  }

  async generateCoverThumbnail(fileBlob) {
    return new Promise(async (resolve) => {
      let objectUrl = null;
      try {
        let loadingParam;
        if (fileBlob instanceof Blob || fileBlob instanceof File) {
          objectUrl = URL.createObjectURL(fileBlob);
          loadingParam = { url: objectUrl };
        } else if (fileBlob instanceof ArrayBuffer) {
          loadingParam = { data: new Uint8Array(fileBlob) };
        } else {
          loadingParam = { data: fileBlob };
        }

        const loadingTask = pdfjsLib.getDocument(loadingParam);
        const pdf = await loadingTask.promise;
        const pageCount = pdf.numPages;

        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.5 });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;

        const coverDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        if (objectUrl) {
          try { URL.revokeObjectURL(objectUrl); } catch(e) {}
        }
        resolve({ coverDataUrl, pageCount });
      } catch (err) {
        console.error('Cover generation failed:', err);
        if (objectUrl) {
          try { URL.revokeObjectURL(objectUrl); } catch(e) {}
        }
        resolve({ coverDataUrl: null, pageCount: 1 });
      }
    });
  }

  render() {
    this.renderFolders();
    this.renderBooks();
  }

  renderFolders() {
    const container = document.getElementById('folders-list');
    if (!container) return;

    container.innerHTML = '';

    const folderIcons = {
      all: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
      favorites: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
      study: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>',
      fiction: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
      trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>'
    };

    this.folders.forEach(folder => {
      const bookCount = this.books.filter(b => {
        if (folder.id === 'trash') return b.folderId === 'trash';
        if (b.folderId === 'trash') return false;
        if (folder.id === 'all') return true;
        if (folder.id === 'favorites') return b.isFavorite;
        return b.folderId === folder.id;
      }).length;

      const item = document.createElement('div');
      item.className = `folder-item ${this.currentFolderId === folder.id ? 'active' : ''}`;
      item.innerHTML = `
        <div class="folder-left">
          <span class="folder-icon">${folderIcons[folder.id] || '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>'}</span>
          <span class="folder-name">${folder.name}</span>
        </div>
        <span class="folder-count">${bookCount}</span>
      `;

      item.addEventListener('click', () => {
        this.currentFolderId = folder.id;
        this.render();
      });

      container.appendChild(item);
    });
  }

  renderBooks() {
    const grid = document.getElementById('books-grid');
    const emptyState = document.getElementById('empty-state');
    const headerTitle = document.getElementById('current-folder-title');

    if (!grid) return;

    const activeFolder = this.folders.find(f => f.id === this.currentFolderId);
    if (headerTitle) {
      headerTitle.textContent = activeFolder ? activeFolder.name : 'Biblioteca';
    }

    let filtered = this.books.filter(book => {
      if (this.currentFolderId === 'trash') {
        return book.folderId === 'trash';
      }
      if (book.folderId === 'trash') return false;

      if (this.currentFolderId === 'favorites') {
        if (!book.isFavorite) return false;
      } else if (this.currentFolderId !== 'all') {
        if (book.folderId !== this.currentFolderId) return false;
      }

      if (this.searchQuery) {
        return (book.title || '').toLowerCase().includes(this.searchQuery);
      }
      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    grid.innerHTML = '';

    filtered.forEach(book => {
      const card = document.createElement('div');
      card.className = 'book-card';

      const totalPages = book.totalPages || book.pageCount || 1;
      const lastPage = book.lastPage || 1;
      const progressPercent = Math.round((lastPage / totalPages) * 100);
      const isTrashView = this.currentFolderId === 'trash';

      const starIcon = book.isFavorite 
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;

      const trashIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
      const restoreIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>`;

      const coverSrc = book.coverUrl || book.coverDataUrl;

      card.innerHTML = `
        <div class="book-card-actions">
          ${!isTrashView ? `
            <button class="btn-icon-square btn-toggle-fav" title="Favoritar">${starIcon}</button>
            <button class="btn-icon-square btn-move-trash" title="Mover para a Lixeira">${trashIcon}</button>
          ` : `
            <button class="btn-icon-square btn-restore-book" title="Restaurar Livro">${restoreIcon}</button>
            <button class="btn-icon-square btn-delete-permanent" style="background: var(--danger);" title="Excluir Definitivamente">${trashIcon}</button>
          `}
        </div>
        <div class="book-cover-wrapper">
          ${coverSrc 
            ? `<img src="${coverSrc}" class="book-cover-img" alt="${book.title}">` 
            : `<div class="book-cover-placeholder">
                 <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                 <span>${book.title}</span>
               </div>`}
        </div>
        <div class="book-card-body">
          <div class="book-title">${book.title}</div>
          <div class="book-meta">
            <span>Pág ${lastPage} de ${totalPages}</span>
            <span>${progressPercent}%</span>
          </div>
          <div class="book-progress-bar">
            <div class="book-progress-fill" style="width: ${progressPercent}%;"></div>
          </div>
        </div>
      `;

      if (!isTrashView) {
        const btnFav = card.querySelector('.btn-toggle-fav');
        if (btnFav) {
          btnFav.addEventListener('click', async (e) => {
            e.stopPropagation();
            book.isFavorite = !book.isFavorite;
            await window.dbManager.saveBook(book);
            this.render();
          });
        }

        const btnTrash = card.querySelector('.btn-move-trash');
        if (btnTrash) {
          btnTrash.addEventListener('click', async (e) => {
            e.stopPropagation();
            book.folderId = 'trash';
            await window.dbManager.saveBook(book);
            window.app.showToast(`"${book.title}" foi movido para a Lixeira.`);
            await this.loadBooks();
            this.render();
          });
        }
      } else {
        const btnRestore = card.querySelector('.btn-restore-book');
        if (btnRestore) {
          btnRestore.addEventListener('click', async (e) => {
            e.stopPropagation();
            book.folderId = 'all';
            await window.dbManager.saveBook(book);
            window.app.showToast(`"${book.title}" foi restaurado!`);
            await this.loadBooks();
            this.render();
          });
        }

        const btnDeletePerm = card.querySelector('.btn-delete-permanent');
        if (btnDeletePerm) {
          btnDeletePerm.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Deseja excluir permanentemente "${book.title}"?`)) {
              await window.dbManager.deleteBook(book.id);
              window.app.showToast(`"${book.title}" foi excluído permanentemente.`);
              await this.loadBooks();
              this.render();
            }
          });
        }
      }

      // Clique no card para abrir o leitor
      card.addEventListener('click', async () => {
        try {
          const freshBook = (await window.dbManager.getBook(book.id)) || book;
          window.readerManager.openBook(freshBook);
        } catch (err) {
          console.error('Error opening book:', err);
          window.readerManager.openBook(book);
        }
      });

      grid.appendChild(card);
    });
  }
}

window.libraryManager = new LibraryManager();