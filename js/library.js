/* ==========================================================================
   LIBRARY MANAGER (Folders, PDF Import & Cover Generation)
   ========================================================================== */

class LibraryManager {
  constructor() {
    this.currentFolderId = 'all';
    this.searchQuery = '';
    this.books = [];
    this.folders = [];
    this.isMultiSelectActive = false;
    this.selectedBookIds = new Set();
    this.currentFilteredBooks = [];
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

    // Multi-Select & Batch Actions
    const btnToggleMulti = document.getElementById('btn-toggle-multi-select');
    if (btnToggleMulti) {
      btnToggleMulti.addEventListener('click', () => this.toggleMultiSelect());
    }

    const btnCancelMulti = document.getElementById('btn-cancel-multi-select');
    if (btnCancelMulti) {
      btnCancelMulti.addEventListener('click', () => this.toggleMultiSelect(false));
    }

    const btnEmptyTrash = document.getElementById('btn-empty-trash');
    if (btnEmptyTrash) {
      btnEmptyTrash.addEventListener('click', () => this.emptyTrash());
    }

    const btnSelectAll = document.getElementById('btn-select-all-books');
    if (btnSelectAll) {
      btnSelectAll.addEventListener('click', () => this.selectAllFilteredBooks());
    }

    const btnTrashSelected = document.getElementById('btn-trash-selected');
    if (btnTrashSelected) {
      btnTrashSelected.addEventListener('click', () => this.batchMoveToTrash());
    }

    const btnRestoreSelected = document.getElementById('btn-restore-selected');
    if (btnRestoreSelected) {
      btnRestoreSelected.addEventListener('click', () => this.batchRestore());
    }

    const btnDeletePermanent = document.getElementById('btn-delete-selected-permanent');
    if (btnDeletePermanent) {
      btnDeletePermanent.addEventListener('click', () => this.batchDeletePermanent());
    }
  }

  toggleMultiSelect(forceState) {
    this.isMultiSelectActive = forceState !== undefined ? forceState : !this.isMultiSelectActive;
    if (!this.isMultiSelectActive) {
      this.selectedBookIds.clear();
    }

    const btnToggle = document.getElementById('btn-toggle-multi-select');
    const multiSelectBar = document.getElementById('multi-select-bar');

    if (btnToggle) {
      btnToggle.classList.toggle('active', this.isMultiSelectActive);
    }
    if (multiSelectBar) {
      multiSelectBar.classList.toggle('hidden', !this.isMultiSelectActive);
    }

    this.updateMultiSelectBar();
    this.renderBooks();
  }

  updateMultiSelectBar() {
    const badge = document.getElementById('selected-count-badge');
    const btnTrashSelected = document.getElementById('btn-trash-selected');
    const btnRestoreSelected = document.getElementById('btn-restore-selected');
    const btnDeletePermanent = document.getElementById('btn-delete-selected-permanent');
    const isTrash = this.currentFolderId === 'trash';

    if (badge) {
      badge.textContent = `${this.selectedBookIds.size} selecionado(s)`;
    }

    if (btnTrashSelected) btnTrashSelected.classList.toggle('hidden', isTrash || this.selectedBookIds.size === 0);
    if (btnRestoreSelected) btnRestoreSelected.classList.toggle('hidden', !isTrash || this.selectedBookIds.size === 0);
    if (btnDeletePermanent) btnDeletePermanent.classList.toggle('hidden', !isTrash || this.selectedBookIds.size === 0);
  }

  selectAllFilteredBooks() {
    if (!this.currentFilteredBooks || this.currentFilteredBooks.length === 0) return;
    const allSelected = this.currentFilteredBooks.every(b => this.selectedBookIds.has(b.id));

    if (allSelected) {
      this.selectedBookIds.clear();
    } else {
      this.currentFilteredBooks.forEach(b => this.selectedBookIds.add(b.id));
    }

    const label = document.getElementById('select-all-label');
    if (label) label.textContent = allSelected ? 'Selecionar Todos' : 'Desmarcar Todos';

    this.updateMultiSelectBar();
    this.renderBooks();
  }

  async emptyTrash() {
    const trashBooks = this.books.filter(b => b.folderId === 'trash');
    if (trashBooks.length === 0) {
      window.app.showToast('A lixeira já está vazia.', 'info');
      return;
    }

    if (confirm(`Tem certeza que deseja esvaziar a lixeira e apagar permanentemente ${trashBooks.length} livro(s)?`)) {
      window.app.showToast('Esvaziando lixeira...', 'info');
      for (const book of trashBooks) {
        await window.dbManager.deleteBook(book.id);
      }
      window.app.showToast('Lixeira esvaziada com sucesso!');
      await this.loadBooks();
      this.render();
    }
  }

  async batchMoveToTrash() {
    if (this.selectedBookIds.size === 0) return;
    const count = this.selectedBookIds.size;

    for (const id of this.selectedBookIds) {
      const book = this.books.find(b => b.id === id);
      if (book) {
        book.folderId = 'trash';
        await window.dbManager.saveBook(book);
      }
    }

    window.app.showToast(`${count} livro(s) movido(s) para a lixeira.`);
    this.toggleMultiSelect(false);
    await this.loadBooks();
    this.render();
  }

  async batchRestore() {
    if (this.selectedBookIds.size === 0) return;
    const count = this.selectedBookIds.size;

    for (const id of this.selectedBookIds) {
      const book = this.books.find(b => b.id === id);
      if (book) {
        book.folderId = 'all';
        await window.dbManager.saveBook(book);
      }
    }

    window.app.showToast(`${count} livro(s) restaurado(s)!`);
    this.toggleMultiSelect(false);
    await this.loadBooks();
    this.render();
  }

  async batchDeletePermanent() {
    if (this.selectedBookIds.size === 0) return;
    const count = this.selectedBookIds.size;

    if (confirm(`Deseja excluir permanentemente ${count} livro(s) selecionado(s)? Esta ação não pode ser desfeita.`)) {
      for (const id of this.selectedBookIds) {
        await window.dbManager.deleteBook(id);
      }

      window.app.showToast(`${count} livro(s) excluído(s) permanentemente.`);
      this.toggleMultiSelect(false);
      await this.loadBooks();
      this.render();
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

  showLibraryView() {
    const libraryContent = document.querySelector('.library-content');
    if (libraryContent) libraryContent.classList.remove('hidden');

    const toolsView = document.getElementById('pdf-tools-view');
    if (toolsView) toolsView.classList.add('hidden');

    const editorView = document.getElementById('pdf-editor-view');
    if (editorView) editorView.classList.add('hidden');

    document.querySelectorAll('.nav-tool-item').forEach(el => {
      el.classList.remove('active-tool');
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
        this.showLibraryView();
        this.render();

        const sidebar = document.querySelector('.library-sidebar');
        const backdrop = document.getElementById('mobile-sidebar-backdrop');
        if (sidebar) sidebar.classList.remove('mobile-open');
        if (backdrop) backdrop.classList.add('hidden');
      });

      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showFolderContextMenu(e, folder);
      });

      container.appendChild(item);
    });
  }

  showFolderContextMenu(e, folder) {
    const ctxMenu = document.getElementById('folder-context-menu');
    if (!ctxMenu) return;

    if (folder.isSystem || ['all', 'favorites', 'trash'].includes(folder.id)) {
      window.app.showToast('Pastas padrão do sistema não podem ser alteradas.', 'info');
      return;
    }

    const x = Math.min(e.clientX, window.innerWidth - 180);
    const y = Math.min(e.clientY, window.innerHeight - 100);

    ctxMenu.style.left = `${x}px`;
    ctxMenu.style.top = `${y}px`;
    ctxMenu.classList.remove('hidden');

    const btnRename = document.getElementById('ctx-rename-folder');
    const btnDelete = document.getElementById('ctx-delete-folder');

    const newRename = btnRename.cloneNode(true);
    const newDelete = btnDelete.cloneNode(true);

    btnRename.parentNode.replaceChild(newRename, btnRename);
    btnDelete.parentNode.replaceChild(newDelete, btnDelete);

    newRename.addEventListener('click', async (evt) => {
      evt.stopPropagation();
      ctxMenu.classList.add('hidden');
      const newName = await window.app.showPromptModal('Renomear Pasta', '', folder.name);
      if (newName && newName.trim()) {
        folder.name = newName.trim();
        await window.dbManager.saveFolder(folder);
        await this.loadFolders();
        this.renderFolders();
        this.renderBooks();
        window.app.showToast(`Pasta renomeada para "${folder.name}".`);
      }
    });

    newDelete.addEventListener('click', async (evt) => {
      evt.stopPropagation();
      ctxMenu.classList.add('hidden');
      if (confirm(`Tem certeza que deseja excluir a pasta "${folder.name}"? Os livros continuarão salvos em "Todos os Livros".`)) {
        await window.dbManager.deleteFolder(folder.id);
        const folderBooks = this.books.filter(b => b.folderId === folder.id);
        for (const book of folderBooks) {
          book.folderId = 'all';
          await window.dbManager.saveBook(book);
        }
        if (this.currentFolderId === folder.id) {
          this.currentFolderId = 'all';
        }
        await this.loadFolders();
        await this.loadBooks();
        this.renderFolders();
        this.renderBooks();
        window.app.showToast(`Pasta "${folder.name}" excluída.`);
      }
    });

    const closeCtx = () => {
      ctxMenu.classList.add('hidden');
      document.removeEventListener('click', closeCtx);
    };
    setTimeout(() => document.addEventListener('click', closeCtx), 50);
  }

  renderBooks() {
    const grid = document.getElementById('books-grid');
    const emptyState = document.getElementById('empty-state');
    const headerTitle = document.getElementById('current-folder-title');
    const btnEmptyTrash = document.getElementById('btn-empty-trash');

    if (!grid) return;

    const activeFolder = this.folders.find(f => f.id === this.currentFolderId);
    if (headerTitle) {
      headerTitle.textContent = activeFolder ? activeFolder.name : 'Biblioteca';
    }

    if (btnEmptyTrash) {
      btnEmptyTrash.classList.toggle('hidden', this.currentFolderId !== 'trash');
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

    this.currentFilteredBooks = filtered;

    if (filtered.length === 0) {
      grid.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    grid.innerHTML = '';

    filtered.forEach(book => {
      const card = document.createElement('div');
      const isSelected = this.selectedBookIds.has(book.id);
      card.className = `book-card ${isSelected ? 'selected' : ''}`;

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
        ${this.isMultiSelectActive ? `<input type="checkbox" class="book-card-checkbox" ${isSelected ? 'checked' : ''}>` : ''}
        <div class="book-card-actions">
          ${!isTrashView ? `
            <button class="btn-icon-square btn-toggle-fav" title="Favoritar">${starIcon}</button>
            <button class="btn-icon-square btn-edit-pdf-book" title="Editar PDF Avançado"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></button>
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

        const btnEditPdf = card.querySelector('.btn-edit-pdf-book');
        if (btnEditPdf) {
          btnEditPdf.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.pdfEditorManager) {
              window.pdfEditorManager.openBookInEditor(book);
            }
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

      // Checkbox click in Multi-Select Mode
      const checkbox = card.querySelector('.book-card-checkbox');
      if (checkbox) {
        checkbox.addEventListener('click', (e) => {
          e.stopPropagation();
          if (checkbox.checked) {
            this.selectedBookIds.add(book.id);
          } else {
            this.selectedBookIds.delete(book.id);
          }
          this.updateMultiSelectBar();
          card.classList.toggle('selected', checkbox.checked);
        });
      }

      // Clique no card
      card.addEventListener('click', async () => {
        if (this.isMultiSelectActive) {
          if (this.selectedBookIds.has(book.id)) {
            this.selectedBookIds.delete(book.id);
          } else {
            this.selectedBookIds.add(book.id);
          }
          this.updateMultiSelectBar();
          this.renderBooks();
          return;
        }

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