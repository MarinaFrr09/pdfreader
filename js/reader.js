/* ==========================================================================
   HORIZONTAL PDF BOOK READER ENGINE (Dual-Page Spread & Bottom Toolbar)
   ========================================================================== */

class ReaderManager {
  constructor() {
    this.currentBook = null;
    this.pdfDoc = null;
    this.currentPage = 1;
    this.scale = 1.0;
    const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    this.spreadMode = isMobile ? 'single' : 'double';
    this.isRendering = false;
    this.readerContainer = null;
  }

  init() {
    this.readerContainer = document.getElementById('reader-view');
    this.setupEventListeners();
    window.textSelectionManager.init();
    window.readerSidebarManager.init();
  }

  setupEventListeners() {
    // Back to Library
    const btnBack = document.getElementById('btn-close-reader');
    if (btnBack) {
      btnBack.addEventListener('click', () => this.closeReader());
    }

    // Previous & Next Page Arrows
    const btnPrev = document.getElementById('btn-prev-page');
    const btnNext = document.getElementById('btn-next-page');

    if (btnPrev) btnPrev.addEventListener('click', () => this.prevPage());
    if (btnNext) btnNext.addEventListener('click', () => this.nextPage());

    // Side Edge Floating Arrow Buttons
    const edgeBtnPrev = document.getElementById('edge-btn-prev');
    const edgeBtnNext = document.getElementById('edge-btn-next');

    if (edgeBtnPrev) edgeBtnPrev.addEventListener('click', (e) => { e.stopPropagation(); this.prevPage(); });
    if (edgeBtnNext) edgeBtnNext.addEventListener('click', (e) => { e.stopPropagation(); this.nextPage(); });

    // Proximity Mouse Movement Listener for Edge Buttons
    const viewport = document.getElementById('reader-viewport');
    if (viewport && (edgeBtnPrev || edgeBtnNext)) {
      viewport.addEventListener('mousemove', (e) => {
        const rect = viewport.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;

        const nearLeft = x < width * 0.25;
        const nearRight = x > width * 0.75;

        if (edgeBtnPrev) edgeBtnPrev.classList.toggle('visible', nearLeft);
        if (edgeBtnNext) edgeBtnNext.classList.toggle('visible', nearRight);
      });

      viewport.addEventListener('mouseleave', () => {
        if (edgeBtnPrev) edgeBtnPrev.classList.remove('visible');
        if (edgeBtnNext) edgeBtnNext.classList.remove('visible');
      });
    }

    // Touch Swipe Gestures for Mobile
    if (viewport) {
      let touchStartX = 0;
      let touchStartY = 0;
      let touchStartTime = 0;

      viewport.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
          touchStartTime = Date.now();
        }
      }, { passive: true });

      viewport.addEventListener('touchend', (e) => {
        if (e.changedTouches.length === 1) {
          const touchEndX = e.changedTouches[0].clientX;
          const touchEndY = e.changedTouches[0].clientY;
          const dx = touchEndX - touchStartX;
          const dy = touchEndY - touchStartY;
          const dt = Date.now() - touchStartTime;

          // Horizontal swipe: dx > 40px and dominant over vertical scroll
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4 && dt < 450) {
            if (dx < 0) {
              this.nextPage(); // Swipe left -> Next page
            } else {
              this.prevPage(); // Swipe right -> Previous page
            }
          }
        }
      }, { passive: true });
    }

    // Mouse Wheel Scroll & Zoom Controller
    if (viewport) {
      viewport.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
          e.preventDefault();
          if (e.deltaY < 0) {
            this.zoomIn();
          } else if (e.deltaY > 0) {
            this.zoomOut();
          }
        }
      }, { passive: false });

      // Right-Click Drag Panning when Zoomed In
      let isRightDragging = false;
      let startX = 0;
      let startY = 0;
      let startScrollLeft = 0;
      let startScrollTop = 0;

      viewport.addEventListener('mousedown', (e) => {
        if (e.button === 2) {
          isRightDragging = true;
          startX = e.clientX;
          startY = e.clientY;
          startScrollLeft = viewport.scrollLeft;
          startScrollTop = viewport.scrollTop;
          viewport.style.cursor = 'grabbing';
          viewport.style.userSelect = 'none';
        }
      });

      window.addEventListener('mousemove', (e) => {
        if (!isRightDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        viewport.scrollLeft = startScrollLeft - dx;
        viewport.scrollTop = startScrollTop - dy;
      });

      const stopRightDrag = () => {
        if (isRightDragging) {
          isRightDragging = false;
          viewport.style.cursor = 'default';
          viewport.style.userSelect = 'auto';
        }
      };

      window.addEventListener('mouseup', (e) => {
        if (e.button === 2) stopRightDrag();
      });

      viewport.addEventListener('mouseleave', stopRightDrag);

      viewport.addEventListener('contextmenu', (e) => {
        e.preventDefault();
      });
    }

    // Keyboard Navigation
    document.addEventListener('keydown', (e) => {
      if (this.readerContainer.classList.contains('hidden')) return;

      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        this.prevPage();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        this.nextPage();
      } else if (e.key === 'Escape') {
        this.closeReader();
      }
    });

    // Toggle 2 Páginas Lado a Lado / 1 Página
    const btnSpreadToggle = document.getElementById('btn-toggle-spread-mode');
    if (btnSpreadToggle) {
      btnSpreadToggle.addEventListener('click', () => this.toggleSpreadMode());
    }

    // Zoom Controls
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');

    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => this.zoomIn());
    }

    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => this.zoomOut());
    }

    // Page Jumper Input
    const pageInput = document.getElementById('reader-page-input');
    if (pageInput) {
      pageInput.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        if (val >= 1 && val <= (this.pdfDoc ? this.pdfDoc.numPages : 1)) {
          this.goToPage(val);
        } else {
          e.target.value = this.currentPage;
        }
      });
    }

    // Sidebar Toggle
    const btnSidebarToggle = document.getElementById('btn-toggle-reader-sidebar');
    const sidebar = document.getElementById('reader-sidebar');
    if (btnSidebarToggle && sidebar) {
      btnSidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        btnSidebarToggle.classList.toggle('active');
      });
    }

    // Theme Mode Switcher in Reader
    const btnThemeToggle = document.getElementById('btn-reader-theme');
    if (btnThemeToggle) {
      btnThemeToggle.addEventListener('click', () => {
        window.app.toggleTheme();
      });
    }
  }

  zoomIn() {
    if (this.scale < 2.5) {
      this.scale = Math.min(2.5, +(this.scale + 0.15).toFixed(2));
      this.updateZoomLabel();
      this.renderCurrentPage();
      window.app.showToast(`Zoom: ${Math.round(this.scale * 100)}%`);
    }
  }

  zoomOut() {
    if (this.scale > 0.6) {
      this.scale = Math.max(0.6, +(this.scale - 0.15).toFixed(2));
      this.updateZoomLabel();
      this.renderCurrentPage();
      window.app.showToast(`Zoom: ${Math.round(this.scale * 100)}%`);
    }
  }

  resetZoom() {
    this.scale = 1.0;
    this.updateZoomLabel();
    this.renderCurrentPage();
    window.app.showToast(`Zoom restaurado: 100%`);
  }

  updateZoomLabel() {
    const zoomLabel = document.getElementById('zoom-level-label');
    if (zoomLabel) {
      zoomLabel.textContent = `${Math.round(this.scale * 100)}%`;
    }
  }

  async openBook(book) {
    if (!book) return;

    if (!this.readerContainer) {
      this.readerContainer = document.getElementById('reader-view');
    }
    if (this.readerContainer) {
      this.readerContainer.classList.remove('hidden');
    }

    this.isRendering = false;

    // Busca o registro completo no banco se faltar o link do arquivo
    let source = book.fileUrl || book.fileurl || book.fileBlob || book.file;
    if (!source && window.dbManager) {
      try {
        const dbBook = await window.dbManager.getBook(book.id);
        if (dbBook) {
          book = dbBook;
          source = dbBook.fileUrl || dbBook.fileurl || dbBook.fileBlob || dbBook.file;
        }
      } catch (e) {
        console.warn('Não foi possível buscar o livro do banco:', e);
      }
    }

    if (!source) {
      console.error('Livro sem URL/Blob:', book);
      window.app.showToast('Arquivo de livro inválido ou ausente.', 'error');
      return;
    }

    this.currentBook = book;
    this.currentPage = book.lastPage || book.lastpage || 1;

    const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      this.spreadMode = 'single';
      const spreadLabel = document.getElementById('spread-mode-label');
      if (spreadLabel) spreadLabel.innerHTML = '1 Pág <small style="font-size: 0.65rem; opacity: 0.7; font-weight: 500;">(P)</small>';
      const btnSpreadToggle = document.getElementById('btn-toggle-spread-mode');
      if (btnSpreadToggle) btnSpreadToggle.classList.remove('active');
      const sidebar = document.getElementById('reader-sidebar');
      if (sidebar) sidebar.classList.add('collapsed');
    }

    const titleEl = document.getElementById('reader-book-title');
    if (titleEl) titleEl.textContent = book.title || 'Livro';
    window.app.showToast(`Carregando "${book.title || 'Livro'}"...`, 'info');

    try {
      if (this.currentBlobUrl) {
        try { URL.revokeObjectURL(this.currentBlobUrl); } catch(e) {}
        this.currentBlobUrl = null;
      }

      let loadingParam;
      if (typeof source === 'string') {
        loadingParam = { url: source };
      } else if (source instanceof Blob || source instanceof File) {
        this.currentBlobUrl = URL.createObjectURL(source);
        loadingParam = { url: this.currentBlobUrl };
      } else if (source instanceof ArrayBuffer) {
        loadingParam = { data: new Uint8Array(source) };
      } else if (source && source.buffer instanceof ArrayBuffer) {
        loadingParam = { data: new Uint8Array(source.buffer) };
      } else {
        const blob = new Blob([source], { type: 'application/pdf' });
        this.currentBlobUrl = URL.createObjectURL(blob);
        loadingParam = { url: this.currentBlobUrl };
      }

      const loadingTask = pdfjsLib.getDocument(loadingParam);
      this.pdfDoc = await loadingTask.promise;

      const totalPagesEl = document.getElementById('reader-total-pages');
      if (totalPagesEl) totalPagesEl.textContent = this.pdfDoc.numPages;

      if (window.readerSidebarManager) {
        window.readerSidebarManager.setDocument(this.pdfDoc, this.currentBook);
      }

      await this.renderCurrentPage();
    } catch (err) {
      console.error('Falha ao abrir documento PDF:', err);
      window.app.showToast('Erro ao abrir o livro PDF: ' + (err.message || err), 'error');
    } finally {
      this.isRendering = false;
    }
  }

  async closeReader() {
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }

    if (this.currentBook) {
      this.currentBook.lastPage = this.currentPage;
      await window.dbManager.saveBook(this.currentBook);
      if (window.libraryManager) {
        await window.libraryManager.loadBooks();
        window.libraryManager.renderBooks();
      }
    }

    if (this.readerContainer) {
      this.readerContainer.classList.add('hidden');
    }

    this.pdfDoc = null;
    this.currentBook = null;
  }

  async prevPage() {
    const isMobile = window.innerWidth <= 768;
    const step = (this.spreadMode === 'double' && !isMobile) ? 2 : 1;
    if (this.currentPage > 1) {
      this.goToPage(Math.max(1, this.currentPage - step));
    }
  }

  async nextPage() {
    const isMobile = window.innerWidth <= 768;
    const step = (this.spreadMode === 'double' && !isMobile) ? 2 : 1;
    if (this.pdfDoc && this.currentPage < this.pdfDoc.numPages) {
      this.goToPage(Math.min(this.pdfDoc.numPages, this.currentPage + step));
    }
  }

  toggleSpreadMode() {
    const btnSpreadToggle = document.getElementById('btn-toggle-spread-mode');
    const spreadLabel = document.getElementById('spread-mode-label');
    this.spreadMode = this.spreadMode === 'double' ? 'single' : 'double';
    if (btnSpreadToggle) {
      btnSpreadToggle.classList.toggle('active', this.spreadMode === 'double');
    }
    if (spreadLabel) {
      spreadLabel.innerHTML = this.spreadMode === 'double' 
        ? '2 Págs <small style="font-size: 0.65rem; opacity: 0.7; font-weight: 500;">(P)</small>' 
        : '1 Pág <small style="font-size: 0.65rem; opacity: 0.7; font-weight: 500;">(P)</small>';
    }
    this.renderCurrentPage();
    window.app.showToast(`Modo de visualização: ${this.spreadMode === 'double' ? '2 Páginas' : '1 Página'}`);
  }

  async goToPage(pageNum) {
    if (!this.pdfDoc || pageNum < 1 || pageNum > this.pdfDoc.numPages) return;
    
    const isMobile = window.innerWidth <= 768;
    if (this.spreadMode === 'double' && !isMobile && pageNum > 1 && pageNum % 2 === 0 && pageNum < this.pdfDoc.numPages) {
      pageNum = pageNum - 1;
    }

    this.currentPage = pageNum;
    await this.renderCurrentPage();

    if (window.readerSidebarManager) {
      window.readerSidebarManager.updateActiveThumbnail(pageNum);
    }

    if (this.currentBook) {
      this.currentBook.lastPage = this.currentPage;
      window.dbManager.saveBook(this.currentBook);
    }
  }

  async renderCurrentPage() {
    if (!this.pdfDoc || this.isRendering) return;
    this.isRendering = true;

    const pageContainer = document.getElementById('pdf-page-container');
    if (!pageContainer) {
      this.isRendering = false;
      return;
    }

    const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      this.spreadMode = 'single';
    }

    const isDouble = this.spreadMode === 'double' && (this.currentPage < this.pdfDoc.numPages) && !isMobile;

    const pageInput = document.getElementById('reader-page-input');
    if (pageInput) {
      pageInput.value = `${this.currentPage}`;
    }

    try {
      const sidebar = document.getElementById('reader-sidebar');
      const isSidebarOpen = sidebar && !sidebar.classList.contains('collapsed');
      const availWidth = window.innerWidth - (isSidebarOpen ? 340 : 80);
      const availHeight = window.innerHeight - 90;

      const firstPage = await this.pdfDoc.getPage(this.currentPage);
      const unscaled = firstPage.getViewport({ scale: 1.0 });

      let baseFitScale = 1.0;
      if (isMobile) {
        const mobileW = window.innerWidth;
        baseFitScale = mobileW / unscaled.width;
      } else if (isDouble) {
        baseFitScale = Math.min((availWidth / (2 * unscaled.width)), (availHeight / unscaled.height));
      } else {
        baseFitScale = Math.min((availWidth / unscaled.width), (availHeight / unscaled.height));
      }

      const effectiveScale = baseFitScale * this.scale;
      const pagesToRender = isDouble ? [this.currentPage, this.currentPage + 1] : [this.currentPage];

      const newPageViews = [];

      for (const pNum of pagesToRender) {
        if (pNum > this.pdfDoc.numPages) break;

        const page = await this.pdfDoc.getPage(pNum);
        const viewport = page.getViewport({ scale: effectiveScale });

        const pageView = document.createElement('div');
        pageView.className = `pdf-page-view ${window.textSelectionManager && window.textSelectionManager.isAreaModeActive ? 'highlight-mode-active' : ''}`;
        pageView.style.width = `${viewport.width}px`;
        pageView.style.height = `${viewport.height}px`;
        pageView.dataset.pageNum = pNum;

        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-canvas';
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const ctx = canvas.getContext('2d');
        pageView.appendChild(canvas);

        const textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer';
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;
        pageView.appendChild(textLayerDiv);

        pageView.addEventListener('click', (e) => {
          const sel = window.getSelection();
          if (sel && !sel.isCollapsed && sel.toString().trim()) return;

          const rect = pageView.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const relativeX = clickX / rect.width;

          if (pNum === pagesToRender[0] && relativeX < 0.08) {
            e.stopPropagation();
            this.prevPage();
          } else if (pNum === pagesToRender[pagesToRender.length - 1] && relativeX > 0.92) {
            e.stopPropagation();
            this.nextPage();
          }
        });

        await page.render({
          canvasContext: ctx,
          viewport: viewport
        }).promise;

        const textContent = await page.getTextContent();
        this.renderTextLayer(textContent, viewport, textLayerDiv);

        if (this.currentBook && window.textSelectionManager) {
          await window.textSelectionManager.loadHighlightsForPage(
            this.currentBook.id,
            pNum,
            pageView
          );
        }

        // Small discrete page number badge at the bottom center of the page sheet (only the number)
        const pageBadge = document.createElement('div');
        pageBadge.className = 'page-sheet-number';
        pageBadge.textContent = pNum;
        pageView.appendChild(pageBadge);

        newPageViews.push(pageView);
      }

      pageContainer.classList.toggle('spread-mode', isDouble);
      pageContainer.replaceChildren(...newPageViews);

    } catch (err) {
      console.error('Error rendering PDF page:', err);
    } finally {
      this.isRendering = false;
    }
  }

  renderTextLayer(textContent, viewport, textLayerDiv) {
    textLayerDiv.innerHTML = '';

    const fragment = document.createDocumentFragment();

    textContent.items.forEach(item => {
      if (!item.str) return;

      const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
      const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
      if (fontHeight <= 0) return;

      const span = document.createElement('span');
      span.textContent = item.str;
      span.style.fontSize = `${fontHeight}px`;
      span.style.fontFamily = item.fontName || 'sans-serif';
      span.style.left = `${tx[4]}px`;
      span.style.top = `${tx[5] - (fontHeight * 0.84)}px`;
      span.style.height = `${fontHeight}px`;
      span.style.lineHeight = '1.0';
      span.style.position = 'absolute';
      span.style.transformOrigin = '0% 0%';
      span.style.whiteSpace = 'pre';
      span.style.color = 'transparent';

      if (item.width && viewport.scale) {
        const scaledWidth = item.width * viewport.scale;
        span.style.width = `${scaledWidth}px`;
      }

      fragment.appendChild(span);
    });

    textLayerDiv.appendChild(fragment);
  }
}

window.readerManager = new ReaderManager();