/* ==========================================================================
   READER SIDEBAR MANAGER (Thumbnails, Search Panel & Bookmarks)
   ========================================================================== */

class ReaderSidebarManager {
  constructor() {
    this.activeTab = 'thumbnails';
    this.pdfDoc = null;
    this.book = null;
  }

  init() {
    this.setupTabEvents();
    this.setupSearchEvents();
    this.setupBookmarkEvents();
    this.setupHighlightEvents();
    this.setupOutsideClickClose();
  }

  setupOutsideClickClose() {
    document.addEventListener('mousedown', (e) => {
      const sidebar = document.getElementById('reader-sidebar');
      const btnSidebarToggle = document.getElementById('btn-toggle-reader-sidebar');
      const btnVerGrifosBottom = document.getElementById('btn-view-highlights-bottom');

      if (!sidebar || sidebar.classList.contains('collapsed')) return;

      // Check if click target is outside sidebar AND outside book pages
      const isInsideSidebar = sidebar.contains(e.target);
      const isInsidePage = e.target.closest('.pdf-page-view') || e.target.closest('.page-container-wrapper');
      const isToggleBtn = (btnSidebarToggle && btnSidebarToggle.contains(e.target)) || 
                          (btnVerGrifosBottom && btnVerGrifosBottom.contains(e.target));

      if (!isInsideSidebar && !isInsidePage && !isToggleBtn) {
        sidebar.classList.add('collapsed');
        if (btnSidebarToggle) btnSidebarToggle.classList.remove('active');
      }
    });
  }

  setupTabEvents() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.switchTab(tab);
      });
    });
  }

  switchTab(tabName) {
    this.activeTab = tabName;

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    document.querySelectorAll('.sidebar-panel').forEach(panel => {
      panel.classList.add('hidden');
    });

    const targetPanel = document.getElementById(`panel-${tabName}`);
    if (targetPanel) {
      targetPanel.classList.remove('hidden');
    }

    if (tabName === 'thumbnails' && this.pdfDoc) {
      this.renderThumbnails();
    } else if (tabName === 'bookmarks' && this.book) {
      this.renderBookmarks();
    } else if (tabName === 'highlights' && this.book) {
      this.renderHighlightsList();
    }
  }

  setDocument(pdfDoc, book) {
    this.pdfDoc = pdfDoc;
    this.book = book;

    if (this.activeTab === 'thumbnails') {
      this.renderThumbnails();
    } else if (this.activeTab === 'bookmarks') {
      this.renderBookmarks();
    } else if (this.activeTab === 'highlights') {
      this.renderHighlightsList();
    }
  }

  async renderThumbnails() {
    const grid = document.getElementById('thumbnails-grid');
    if (!grid || !this.pdfDoc || !this.book) return;

    grid.innerHTML = '';
    const numPages = this.pdfDoc.numPages;

    const bookmarks = await window.dbManager.getBookmarksForBook(this.book.id);
    const bookmarkedPages = new Set(bookmarks.map(b => b.pageNum));

    // Disconnect old observer if exists
    if (this.thumbObserver) {
      this.thumbObserver.disconnect();
    }

    // Lazy load thumbnails using IntersectionObserver
    this.thumbObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const item = entry.target;
          const pageNum = parseInt(item.dataset.page, 10);
          if (!item.dataset.rendered) {
            item.dataset.rendered = 'true';
            this.renderPageThumbnail(pageNum);
          }
          observer.unobserve(item);
        }
      });
    }, {
      root: document.getElementById('panel-thumbnails'),
      rootMargin: '100px 0px',
      threshold: 0.01
    });

    // Create fragment for fast DOM insertion
    const fragment = document.createDocumentFragment();

    for (let i = 1; i <= numPages; i++) {
      const isBookmarked = bookmarkedPages.has(i);
      const item = document.createElement('div');
      item.className = `thumbnail-item ${i === window.readerManager.currentPage ? 'active' : ''}`;
      item.dataset.page = i;

      item.innerHTML = `
        <div class="thumbnail-canvas-wrapper" id="thumb-wrap-${i}">
          <span style="font-size: 0.8rem; color: var(--text-muted);">${i}</span>
        </div>
        <button class="thumb-bookmark-btn ${isBookmarked ? 'active' : ''}" data-page="${i}" title="${isBookmarked ? 'Remover Marcador' : 'Marcar Página'}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="${isBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
        </button>
        <span class="thumbnail-label">Pág ${i}</span>
      `;

      item.addEventListener('click', (e) => {
        if (!e.target.closest('.thumb-bookmark-btn')) {
          window.readerManager.goToPage(i);
          this.updateActiveThumbnail(i);
        }
      });

      const bmBtn = item.querySelector('.thumb-bookmark-btn');
      bmBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.togglePageBookmark(i);
      });

      fragment.appendChild(item);
    }

    grid.appendChild(fragment);

    // Observe all thumbnail items for scroll-based lazy rendering
    grid.querySelectorAll('.thumbnail-item').forEach(item => {
      this.thumbObserver.observe(item);
    });
  }

  async renderPageThumbnail(pageNum) {
    try {
      const page = await this.pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.2 });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      const wrapper = document.getElementById(`thumb-wrap-${pageNum}`);
      if (wrapper) {
        wrapper.innerHTML = '';
        wrapper.appendChild(canvas);
      }
    } catch (e) {
      console.warn(`Failed to render thumbnail for page ${pageNum}`, e);
    }
  }

  updateActiveThumbnail(pageNum) {
    const items = document.querySelectorAll('.thumbnail-item');
    items.forEach(item => {
      const p = parseInt(item.dataset.page, 10);
      item.classList.toggle('active', p === pageNum);
    });
  }

  setupSearchEvents() {
    const searchInput = document.getElementById('reader-search-input');
    if (searchInput) {
      let timeout = null;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        const query = e.target.value;
        timeout = setTimeout(() => {
          this.executeSearch(query);
        }, 300);
      });
    }
  }

  async executeSearch(query) {
    const resultsContainer = document.getElementById('search-results-list');
    if (!resultsContainer) return;

    if (!query || query.trim().length < 2) {
      resultsContainer.innerHTML = '<p style="font-size: 0.85rem; color: var(--text-muted);">Digite pelo menos 2 caracteres para pesquisar.</p>';
      return;
    }

    resultsContainer.innerHTML = '<p id="search-status" style="font-size: 0.85rem; color: var(--text-muted);">Pesquisando no documento...</p>';

    window.searchEngine.setDocument(this.pdfDoc);
    const results = await window.searchEngine.search(query, (current, total) => {
      const statusEl = document.getElementById('search-status');
      if (statusEl) {
        const pct = Math.round((current / total) * 100);
        statusEl.textContent = `Pesquisando... (${pct}% - pág ${current} de ${total})`;
      }
    });

    if (results.length === 0) {
      resultsContainer.innerHTML = '<p style="font-size: 0.85rem; color: var(--text-muted);">Nenhum resultado encontrado.</p>';
      return;
    }

    resultsContainer.innerHTML = '';

    results.forEach(res => {
      const item = document.createElement('div');
      item.className = 'search-result-item';

      // Highlight matching word in snippet
      const highlightedSnippet = res.snippet.replace(
        new RegExp(res.query, 'gi'),
        match => `<mark>${match}</mark>`
      );

      item.innerHTML = `
        <span class="search-result-page">Página ${res.pageNum}</span>
        <div class="search-result-snippet">${highlightedSnippet}</div>
      `;

      item.addEventListener('click', () => {
        window.readerManager.goToPage(res.pageNum);
      });

      resultsContainer.appendChild(item);
    });
  }

  setupBookmarkEvents() {
    const btnAddBookmark = document.getElementById('btn-add-bookmark');
    if (btnAddBookmark) {
      btnAddBookmark.addEventListener('click', () => this.toggleCurrentPageBookmark());
    }

    const btnBookmarkBottom = document.getElementById('btn-bookmark-current');
    if (btnBookmarkBottom) {
      btnBookmarkBottom.addEventListener('click', () => this.toggleCurrentPageBookmark());
    }
  }

  async toggleCurrentPageBookmark() {
    if (!this.book || !window.readerManager) return;
    const pageNum = window.readerManager.currentPage;
    await this.togglePageBookmark(pageNum);
  }

  async togglePageBookmark(pageNum) {
    if (!this.book) return;
    const bookmarks = await window.dbManager.getBookmarksForBook(this.book.id);
    const existing = bookmarks.find(b => b.pageNum === pageNum);

    if (existing) {
      await window.dbManager.deleteBookmark(existing.id);
      window.app.showToast(`Página ${pageNum} desmarcada.`);
    } else {
      const bookmark = {
        id: 'bm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        bookId: this.book.id,
        pageNum: pageNum,
        title: `Página ${pageNum}`,
        createdAt: Date.now()
      };
      await window.dbManager.saveBookmark(bookmark);
      window.app.showToast(`Página ${pageNum} marcada com sucesso!`);
    }

    this.renderThumbnails();
    this.renderBookmarks();
    this.updateBookmarkButtonState();
  }

  async updateBookmarkButtonState() {
    const btnBookmark = document.getElementById('btn-bookmark-current');
    if (!btnBookmark || !this.book || !window.readerManager) return;
    const pageNum = window.readerManager.currentPage;
    const bookmarks = await window.dbManager.getBookmarksForBook(this.book.id);
    const isBookmarked = bookmarks.some(b => b.pageNum === pageNum);
    btnBookmark.classList.toggle('active', isBookmarked);
  }

  async addCurrentPageBookmark() {
    await this.toggleCurrentPageBookmark();
  }

  async renderBookmarks() {
    const container = document.getElementById('bookmarks-list');
    if (!container || !this.book) return;

    const bookmarks = await window.dbManager.getBookmarksForBook(this.book.id);

    if (bookmarks.length === 0) {
      container.innerHTML = '<p style="font-size: 0.85rem; color: var(--text-muted);">Nenhum marcador adicionado a este livro.</p>';
      return;
    }

    container.innerHTML = '';

    bookmarks.forEach(bm => {
      const item = document.createElement('div');
      item.className = 'bookmark-item';
      item.innerHTML = `
        <div class="bookmark-info">
          <span class="bookmark-title">${bm.title}</span>
          <span class="bookmark-page">Página ${bm.pageNum}</span>
        </div>
        <button class="btn-delete-bm" style="color: var(--danger); font-size: 0.9rem;" title="Excluir">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      `;

      item.addEventListener('click', () => {
        window.readerManager.goToPage(bm.pageNum);
      });

      const btnDelete = item.querySelector('.btn-delete-bm');
      btnDelete.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.dbManager.deleteBookmark(bm.id);
        this.renderBookmarks();
        this.renderThumbnails();
        this.updateBookmarkButtonState();
        window.app.showToast('Marcador excluído.');
      });

      container.appendChild(item);
    });

    this.updateBookmarkButtonState();
  }

  setupHighlightEvents() {
    const btnRefresh = document.getElementById('btn-refresh-highlights');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => this.renderHighlightsList());
    }

    const btnDeleteAll = document.getElementById('btn-delete-all-highlights');
    if (btnDeleteAll) {
      btnDeleteAll.addEventListener('click', () => this.deleteAllHighlights());
    }

    const btnCopyAll = document.getElementById('btn-copy-all-highlights');
    if (btnCopyAll) {
      btnCopyAll.addEventListener('click', () => this.copyAllHighlights());
    }

    const btnVerGrifosBottom = document.getElementById('btn-view-highlights-bottom');
    if (btnVerGrifosBottom) {
      btnVerGrifosBottom.addEventListener('click', () => this.toggleHighlightsPanel());
    }
  }

  toggleHighlightsPanel() {
    const sidebar = document.getElementById('reader-sidebar');
    const btnSidebarToggle = document.getElementById('btn-toggle-reader-sidebar');
    if (!sidebar) return;

    const isCollapsed = sidebar.classList.contains('collapsed');

    if (isCollapsed) {
      sidebar.classList.remove('collapsed');
      if (btnSidebarToggle) btnSidebarToggle.classList.add('active');
      this.switchTab('highlights');
    } else {
      if (this.activeTab === 'highlights') {
        sidebar.classList.add('collapsed');
        if (btnSidebarToggle) btnSidebarToggle.classList.remove('active');
      } else {
        this.switchTab('highlights');
      }
    }
  }

  async deleteAllHighlights() {
    if (!this.book) return;
    const highlights = await window.dbManager.getHighlightsForBook(this.book.id);
    if (highlights.length === 0) {
      window.app.showToast('Nenhum grifo para excluir.', 'info');
      return;
    }

    if (confirm(`Deseja excluir TODOS os ${highlights.length} grifos deste livro? Esta ação é irreversível.`)) {
      for (const hl of highlights) {
        await window.dbManager.deleteHighlight(hl.id);
      }
      this.renderHighlightsList();
      window.readerManager.renderCurrentPage();
      window.app.showToast('Todos os grifos foram excluídos!');
    }
  }

  async copyAllHighlights() {
    if (!this.book) return;
    const highlights = await window.dbManager.getHighlightsForBook(this.book.id);
    if (highlights.length === 0) {
      window.app.showToast('Nenhum grifo para copiar.', 'info');
      return;
    }

    highlights.sort((a, b) => a.pageNum - b.pageNum);
    const fullText = highlights.map(h => `[Página ${h.pageNum}]\n"${h.text}"${h.note ? `\n(Nota: ${h.note})` : ''}`).join('\n\n');
    navigator.clipboard.writeText(fullText);
    window.app.showToast(`Todos os ${highlights.length} grifos foram copiados!`);
  }

  async renderHighlightsList() {
    const container = document.getElementById('highlights-list');
    if (!container || !this.book) return;

    const highlights = await window.dbManager.getHighlightsForBook(this.book.id);

    if (highlights.length === 0) {
      container.innerHTML = '<p style="font-size: 0.85rem; color: var(--text-muted);">Nenhum trecho grifado neste livro.</p>';
      return;
    }

    highlights.sort((a, b) => a.pageNum - b.pageNum);
    container.innerHTML = '';

    highlights.forEach(hl => {
      const item = document.createElement('div');
      item.className = 'bookmark-item';
      item.style.flexDirection = 'column';
      item.style.alignItems = 'stretch';
      item.style.borderLeft = `4px solid ${hl.color || '#fff1a8'}`;
      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div class="bookmark-info" style="cursor: pointer; flex: 1;">
            <span class="bookmark-title" style="font-weight: 600; color: var(--text-main); line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">"${hl.text}"</span>
            <span class="bookmark-page" style="color: var(--primary); font-size: 0.78rem; font-weight: 700; margin-top: 4px; display: block;">Página ${hl.pageNum}</span>
          </div>
          <div style="display: flex; gap: 2px; align-items: center;">
            <button class="btn-note-hl" style="color: var(--primary); font-size: 0.85rem; padding: 4px;" title="Adicionar / Editar Nota">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="btn-copy-hl" style="color: var(--text-muted); font-size: 0.85rem; padding: 4px;" title="Copiar Texto">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
            <button class="btn-delete-hl" style="color: var(--danger); font-size: 0.85rem; padding: 4px;" title="Excluir Grifo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
        ${hl.note ? `
          <div style="margin-top: 8px; padding: 6px 10px; background: rgba(59, 130, 246, 0.12); border-left: 3px solid var(--primary); border-radius: 4px; font-size: 0.78rem; color: var(--text-main);">
            📝 <strong>Nota:</strong> ${hl.note}
          </div>
        ` : ''}
      `;

      item.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          window.readerManager.goToPage(hl.pageNum);
        }
      });

      const btnNote = item.querySelector('.btn-note-hl');
      btnNote.addEventListener('click', async (e) => {
        e.stopPropagation();
        const currentNote = hl.note || '';
        const newNote = prompt('Digite a nota/comentário para este grifo:', currentNote);
        if (newNote !== null) {
          hl.note = newNote.trim();
          await window.dbManager.saveHighlight(hl);
          this.renderHighlightsList();
          window.app.showToast('Nota salva com sucesso!');
        }
      });

      const btnCopy = item.querySelector('.btn-copy-hl');
      btnCopy.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(hl.text);
        window.app.showToast('Texto do grifo copiado!');
      });

      const btnDelete = item.querySelector('.btn-delete-hl');
      btnDelete.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.dbManager.deleteHighlight(hl.id);
        this.renderHighlightsList();
        window.readerManager.renderCurrentPage();
        window.app.showToast('Grifo removido.');
      });

      container.appendChild(item);
    });
  }
}

window.readerSidebarManager = new ReaderSidebarManager();
