/* ==========================================================================
   READER SIDEBAR MANAGER (Thumbnails, Search, Bookmarks, Highlights & Notes)
   ========================================================================== */

class ReaderSidebarManager {
  constructor() {
    this.activeTab = 'thumbnails';
    this.pdfDoc = null;
    this.book = null;
    this.currentDetailHl = null;
  }

  init() {
    this.setupTabEvents();
    this.setupSearchEvents();
    this.setupBookmarkEvents();
    this.setupHighlightEvents();
    this.setupNotesEvents();
    this.setupHighlightDetailModalEvents();
    this.setupOutsideClickClose();
  }

  setupOutsideClickClose() {
    document.addEventListener('mousedown', (e) => {
      const sidebar = document.getElementById('reader-sidebar');
      const btnSidebarToggle = document.getElementById('btn-toggle-reader-sidebar');
      const btnVerGrifosBottom = document.getElementById('btn-view-highlights-bottom');

      if (!sidebar || sidebar.classList.contains('collapsed')) return;

      const isInsideSidebar = sidebar.contains(e.target);
      const isInsidePage = e.target.closest('.pdf-page-view') || e.target.closest('.page-container-wrapper');
      const isModal = e.target.closest('.modal-overlay');
      const isToggleBtn = (btnSidebarToggle && btnSidebarToggle.contains(e.target)) || 
                          (btnVerGrifosBottom && btnVerGrifosBottom.contains(e.target));

      if (!isInsideSidebar && !isInsidePage && !isModal && !isToggleBtn) {
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
    } else if (tabName === 'notes' && this.book) {
      this.renderNotesList();
    }
  }

  setDocument(pdfDoc, book) {
    this.pdfDoc = pdfDoc;
    this.book = book;

    this.updateNotesBadge();

    if (this.activeTab === 'thumbnails') {
      this.renderThumbnails();
    } else if (this.activeTab === 'bookmarks') {
      this.renderBookmarks();
    } else if (this.activeTab === 'highlights') {
      this.renderHighlightsList();
    } else if (this.activeTab === 'notes') {
      this.renderNotesList();
    }
  }

  async updateNotesBadge() {
    if (!this.book) return;
    try {
      const highlights = await window.dbManager.getHighlightsForBook(this.book.id);
      const notes = highlights.filter(h => h.note && h.note.trim());
      const badge = document.getElementById('notes-count-badge');
      if (badge) badge.textContent = notes.length;
    } catch(e) {}
  }

  // === THUMBNAILS ===

  async renderThumbnails() {
    const grid = document.getElementById('thumbnails-grid');
    if (!grid || !this.pdfDoc || !this.book) return;

    grid.innerHTML = '';
    const numPages = this.pdfDoc.numPages;

    const bookmarks = await window.dbManager.getBookmarksForBook(this.book.id);
    const bookmarkedPages = new Set(bookmarks.map(b => b.pageNum));

    if (this.thumbObserver) {
      this.thumbObserver.disconnect();
    }

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
        const pageNum = parseInt(bmBtn.dataset.page, 10);
        const isActive = bmBtn.classList.contains('active');

        if (isActive) {
          const bms = await window.dbManager.getBookmarksForBook(this.book.id);
          const target = bms.find(b => b.pageNum === pageNum);
          if (target) {
            await window.dbManager.deleteBookmark(target.id);
            bmBtn.classList.remove('active');
            bmBtn.querySelector('svg').setAttribute('fill', 'none');
            window.app.showToast(`Marcador da página ${pageNum} removido.`);
          }
        } else {
          await window.dbManager.saveBookmark({
            bookId: this.book.id,
            pageNum: pageNum,
            title: `Página ${pageNum}`,
            createdAt: new Date().toISOString()
          });
          bmBtn.classList.add('active');
          bmBtn.querySelector('svg').setAttribute('fill', 'currentColor');
          window.app.showToast(`Página ${pageNum} marcada.`);
        }

        if (this.activeTab === 'bookmarks') {
          this.renderBookmarks();
        }
      });

      this.thumbObserver.observe(item);
      fragment.appendChild(item);
    }

    grid.appendChild(fragment);
  }

  async renderPageThumbnail(pageNum) {
    const wrap = document.getElementById(`thumb-wrap-${pageNum}`);
    if (!wrap || !this.pdfDoc) return;

    try {
      const page = await this.pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.22 });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      wrap.innerHTML = '';
      wrap.appendChild(canvas);
    } catch (e) {
      console.warn(`Erro ao gerar miniatura da pág ${pageNum}:`, e);
    }
  }

  updateActiveThumbnail(pageNum) {
    document.querySelectorAll('.thumbnail-item').forEach(item => {
      const p = parseInt(item.dataset.page, 10);
      item.classList.toggle('active', p === pageNum);
    });
  }

  // === IN-BOOK SEARCH ===

  setupSearchEvents() {
    const input = document.getElementById('reader-search-input');
    if (!input) return;

    let debounceTimer;
    input.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.performInBookSearch(e.target.value);
      }, 350);
    });
  }

  async performInBookSearch(query) {
    const resultsContainer = document.getElementById('search-results-list');
    if (!resultsContainer || !this.pdfDoc) return;

    query = query.trim().toLowerCase();
    if (!query) {
      resultsContainer.innerHTML = '<p style="font-size: 0.85rem; color: var(--text-muted);">Digite um termo para pesquisar.</p>';
      return;
    }

    resultsContainer.innerHTML = '<p style="font-size: 0.85rem; color: var(--text-muted);">Pesquisando no documento...</p>';

    const results = [];
    const numPages = this.pdfDoc.numPages;

    for (let i = 1; i <= numPages; i++) {
      const page = await this.pdfDoc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(it => it.str).join(' ');

      const idx = pageText.toLowerCase().indexOf(query);
      if (idx !== -1) {
        const start = Math.max(0, idx - 40);
        const end = Math.min(pageText.length, idx + query.length + 40);
        const snippet = (start > 0 ? '...' : '') + pageText.substring(start, end) + (end < pageText.length ? '...' : '');

        results.push({ pageNum: i, snippet: snippet });
      }
    }

    if (results.length === 0) {
      resultsContainer.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-muted);">Nenhum resultado para "<strong>${query}</strong>".</p>`;
      return;
    }

    resultsContainer.innerHTML = `<p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 6px;">Encontrado em ${results.length} página(s):</p>`;

    results.forEach(res => {
      const card = document.createElement('div');
      card.className = 'search-result-card';
      card.innerHTML = `
        <div class="search-result-page">Página ${res.pageNum}</div>
        <div class="search-result-snippet">${this.highlightMatch(res.snippet, query)}</div>
      `;
      card.addEventListener('click', () => {
        window.readerManager.goToPage(res.pageNum);
      });
      resultsContainer.appendChild(card);
    });
  }

  highlightMatch(text, query) {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark style="background:#fef08a; padding:1px 4px; border-radius:2px; font-weight:700;">$1</mark>');
  }

  // === BOOKMARKS ===

  setupBookmarkEvents() {
    const btnAdd = document.getElementById('btn-add-bookmark');
    if (btnAdd) {
      btnAdd.addEventListener('click', async () => {
        if (!this.book || !window.readerManager) return;
        const pageNum = window.readerManager.currentPage;

        const bms = await window.dbManager.getBookmarksForBook(this.book.id);
        if (bms.some(b => b.pageNum === pageNum)) {
          window.app.showToast(`Página ${pageNum} já está marcada.`, 'info');
          return;
        }

        await window.dbManager.saveBookmark({
          bookId: this.book.id,
          pageNum: pageNum,
          title: `Página ${pageNum}`,
          createdAt: new Date().toISOString()
        });

        window.app.showToast(`Marcador adicionado na Página ${pageNum}!`);
        this.renderBookmarks();
        this.renderThumbnails();
      });
    }
  }

  async renderBookmarks() {
    const container = document.getElementById('bookmarks-list');
    if (!container || !this.book) return;

    const bookmarks = await window.dbManager.getBookmarksForBook(this.book.id);

    if (bookmarks.length === 0) {
      container.innerHTML = '<p style="font-size: 0.85rem; color: var(--text-muted);">Nenhum marcador criado ainda.</p>';
      return;
    }

    bookmarks.sort((a, b) => a.pageNum - b.pageNum);
    container.innerHTML = '';

    bookmarks.forEach(bm => {
      const item = document.createElement('div');
      item.className = 'bookmark-item';
      item.innerHTML = `
        <div class="bookmark-info" style="cursor: pointer; flex: 1;">
          <span class="bookmark-title" style="font-weight: 600; color: var(--text-main);">${bm.title || `Página ${bm.pageNum}`}</span>
          <span class="bookmark-page" style="color: var(--primary); font-size: 0.78rem; font-weight: 700; display: block; margin-top: 2px;">Pág ${bm.pageNum}</span>
        </div>
        <button class="btn-delete-bookmark" style="color: var(--danger); padding: 4px;" title="Remover Marcador">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      `;

      item.querySelector('.bookmark-info').addEventListener('click', () => {
        window.readerManager.goToPage(bm.pageNum);
      });

      item.querySelector('.btn-delete-bookmark').addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.dbManager.deleteBookmark(bm.id);
        this.renderBookmarks();
        this.renderThumbnails();
        window.app.showToast('Marcador removido.');
      });

      container.appendChild(item);
    });
  }

  // === HIGHLIGHTS & POPUP MODAL ===

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

  setupHighlightDetailModalEvents() {
    const modal = document.getElementById('modal-highlight-detail');
    const btnClose = document.getElementById('btn-close-hl-detail');
    const btnCopy = document.getElementById('btn-hl-detail-copy');
    const btnNote = document.getElementById('btn-hl-detail-note');
    const btnDelete = document.getElementById('btn-hl-detail-delete');

    if (btnClose) {
      btnClose.addEventListener('click', () => modal.classList.add('hidden'));
    }

    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        if (!this.currentDetailHl) return;
        navigator.clipboard.writeText(this.currentDetailHl.text);
        window.app.showToast('Texto do grifo copiado com sucesso!');
      });
    }

    if (btnNote) {
      btnNote.addEventListener('click', async () => {
        if (!this.currentDetailHl) return;
        const hl = this.currentDetailHl;
        const currentNote = hl.note || '';
        const newNote = await window.app.showPromptModal(
          'Anotação do Trecho Grifado',
          hl.text,
          currentNote
        );

        if (newNote !== null) {
          hl.note = newNote.trim();
          await window.dbManager.saveHighlight(hl);
          this.showHighlightDetailModal(hl);
          this.renderHighlightsList();
          this.renderNotesList();
          this.updateNotesBadge();
          window.app.showToast('Nota salva com sucesso!');
        }
      });
    }

    if (btnDelete) {
      btnDelete.addEventListener('click', async () => {
        if (!this.currentDetailHl) return;
        const hlId = this.currentDetailHl.id;
        await window.dbManager.deleteHighlight(hlId);
        modal.classList.add('hidden');
        this.currentDetailHl = null;
        this.renderHighlightsList();
        this.renderNotesList();
        this.updateNotesBadge();
        window.readerManager.renderCurrentPage();
        window.app.showToast('Marcação removida com sucesso!');
      });
    }
  }

  showHighlightDetailModal(hl) {
    this.currentDetailHl = hl;
    const modal = document.getElementById('modal-highlight-detail');
    if (!modal) return;

    const colorBadge = document.getElementById('hl-detail-color-badge');
    const pageBadge = document.getElementById('hl-detail-page-badge');
    const fullTextEl = document.getElementById('hl-detail-full-text');
    const noteContainer = document.getElementById('hl-detail-note-container');
    const noteTextEl = document.getElementById('hl-detail-note-text');
    const noteBtnLabel = document.getElementById('btn-hl-detail-note-label');

    if (colorBadge) colorBadge.style.background = hl.color || '#fef08a';
    if (pageBadge) pageBadge.textContent = `Página ${hl.pageNum}`;
    if (fullTextEl) fullTextEl.textContent = hl.text;

    if (hl.note && hl.note.trim()) {
      if (noteContainer) noteContainer.classList.remove('hidden');
      if (noteTextEl) noteTextEl.textContent = hl.note;
      if (noteBtnLabel) noteBtnLabel.textContent = 'Editar Nota';
    } else {
      if (noteContainer) noteContainer.classList.add('hidden');
      if (noteBtnLabel) noteBtnLabel.textContent = 'Adicionar Nota';
    }

    modal.classList.remove('hidden');
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
      this.renderNotesList();
      this.updateNotesBadge();
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
      item.style.cursor = 'pointer';
      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div class="bookmark-info" style="flex: 1;">
            <span class="bookmark-title" style="font-weight: 600; color: var(--text-main); line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">"${hl.text}"</span>
            <div style="display: flex; gap: 6px; align-items: center; margin-top: 4px;">
              <span class="bookmark-page" style="color: var(--primary); font-size: 0.78rem; font-weight: 700;">Página ${hl.pageNum}</span>
              <span style="font-size: 0.72rem; color: var(--text-muted); background: var(--bg-surface); padding: 1px 6px; border-radius: 4px;">🔍 Ver Detalhes</span>
            </div>
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
          this.showHighlightDetailModal(hl);
        }
      });

      const btnNote = item.querySelector('.btn-note-hl');
      btnNote.addEventListener('click', async (e) => {
        e.stopPropagation();
        const currentNote = hl.note || '';
        const newNote = await window.app.showPromptModal(
          'Editar Anotação do Grifo',
          hl.text,
          currentNote
        );
        if (newNote !== null) {
          hl.note = newNote.trim();
          await window.dbManager.saveHighlight(hl);
          this.renderHighlightsList();
          this.renderNotesList();
          this.updateNotesBadge();
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
        this.renderNotesList();
        this.updateNotesBadge();
        window.readerManager.renderCurrentPage();
        window.app.showToast('Grifo removido.');
      });

      container.appendChild(item);
    });
  }

  // === NOTES TAB (Anotações do Livro) ===

  setupNotesEvents() {
    const btnRefresh = document.getElementById('btn-refresh-notes');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => this.renderNotesList());
    }

    const btnCopyAll = document.getElementById('btn-copy-all-notes');
    if (btnCopyAll) {
      btnCopyAll.addEventListener('click', () => this.copyAllNotes());
    }
  }

  async copyAllNotes() {
    if (!this.book) return;
    const highlights = await window.dbManager.getHighlightsForBook(this.book.id);
    const notes = highlights.filter(h => h.note && h.note.trim());

    if (notes.length === 0) {
      window.app.showToast('Nenhuma nota para copiar.', 'info');
      return;
    }

    notes.sort((a, b) => a.pageNum - b.pageNum);
    const text = notes.map((n, idx) => `[NOTA ${idx + 1} - Página ${n.pageNum}]\n"${n.note}"\n(Referência: "${n.text}")`).join('\n\n');
    navigator.clipboard.writeText(text);
    window.app.showToast(`Todas as ${notes.length} notas foram copiadas!`);
  }

  async renderNotesList() {
    const container = document.getElementById('notes-list');
    if (!container || !this.book) return;

    const highlights = await window.dbManager.getHighlightsForBook(this.book.id);
    const notes = highlights.filter(h => h.note && h.note.trim());

    this.updateNotesBadge();

    if (notes.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 24px 12px; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 8px;">📝</div>
          <p style="font-size: 0.85rem; font-weight: 600; margin-bottom: 4px;">Nenhuma nota criada ainda</p>
          <p style="font-size: 0.75rem;">Clique em qualquer grifo do texto para adicionar comentários e notas.</p>
        </div>
      `;
      return;
    }

    notes.sort((a, b) => a.pageNum - b.pageNum);
    container.innerHTML = '';

    notes.forEach(hl => {
      const card = document.createElement('div');
      card.className = 'bookmark-item';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'stretch';
      card.style.borderLeft = '4px solid #3b82f6';
      card.style.background = 'var(--bg-card)';
      card.style.cursor = 'pointer';

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
          <div style="flex: 1;">
            <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-main); margin-bottom: 6px; line-height: 1.4;">
              📝 ${hl.note}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted); font-style: italic; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 6px; background: var(--bg-surface); padding: 4px 8px; border-radius: 4px;">
              "${hl.text}"
            </div>
            <span style="font-size: 0.75rem; font-weight: 700; color: var(--primary);">Página ${hl.pageNum}</span>
          </div>
          <div style="display: flex; gap: 2px; align-items: center;">
            <button class="btn-edit-note" style="color: var(--primary); font-size: 0.85rem; padding: 4px;" title="Editar Nota">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button class="btn-copy-note" style="color: var(--text-muted); font-size: 0.85rem; padding: 4px;" title="Copiar Nota">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
            <button class="btn-delete-note" style="color: var(--danger); font-size: 0.85rem; padding: 4px;" title="Remover Nota">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          window.readerManager.goToPage(hl.pageNum);
          this.showHighlightDetailModal(hl);
        }
      });

      const btnEdit = card.querySelector('.btn-edit-note');
      btnEdit.addEventListener('click', async (e) => {
        e.stopPropagation();
        const newNote = await window.app.showPromptModal(
          'Editar Anotação',
          hl.text,
          hl.note
        );
        if (newNote !== null) {
          hl.note = newNote.trim();
          await window.dbManager.saveHighlight(hl);
          this.renderNotesList();
          this.renderHighlightsList();
          this.updateNotesBadge();
          window.app.showToast('Nota atualizada com sucesso!');
        }
      });

      const btnCopy = card.querySelector('.btn-copy-note');
      btnCopy.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(hl.note);
        window.app.showToast('Nota copiada!');
      });

      const btnDelete = card.querySelector('.btn-delete-note');
      btnDelete.addEventListener('click', async (e) => {
        e.stopPropagation();
        hl.note = '';
        await window.dbManager.saveHighlight(hl);
        this.renderNotesList();
        this.renderHighlightsList();
        this.updateNotesBadge();
        window.app.showToast('Nota removida.');
      });

      container.appendChild(card);
    });
  }
}

window.readerSidebarManager = new ReaderSidebarManager();
