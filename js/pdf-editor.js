/* ==========================================================================
   ADVANCED PDF EDITOR STUDIO MANAGER - PROFESSIONAL EDITION
   ========================================================================== */

class PdfEditorManager {
  constructor() {
    this.pdfDoc = null;
    this.pdfBytes = null;
    this.currentBook = null;
    this.currentPageNum = 1;
    this.numPages = 1;
    this.scale = 1.25;

    // Tool state
    this.activeMode = 'select';
    this.currentColor = '#ef4444';
    this.strokeWidth = 4;
    this.opacity = 1.0;
    this.shapeSize = 80;

    // Drawing state
    this.isDrawing = false;
    this.drawStartX = 0;
    this.drawStartY = 0;
    this.currentPath = [];
    this.pageCanvasStates = {};  // Saved ImageData per page number
    this.historyStack = [];
    this.pageElements = {};
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Top Controls
    const btnBack = document.getElementById('btn-editor-back');
    if (btnBack) btnBack.addEventListener('click', () => this.hideEditorView());

    const btnOpenFile = document.getElementById('btn-editor-open-file');
    const fileInput = document.getElementById('editor-file-input');
    if (btnOpenFile && fileInput) {
      btnOpenFile.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => this.handleFileSelected(e.target.files));
    }

    // Page navigation
    const btnPrev = document.getElementById('btn-editor-prev-page');
    const btnNext = document.getElementById('btn-editor-next-page');
    if (btnPrev) btnPrev.addEventListener('click', () => this.changePage(-1));
    if (btnNext) btnNext.addEventListener('click', () => this.changePage(1));

    // Toggle Tools in Mobile
    const btnToggleTools = document.getElementById('btn-toggle-editor-tools');
    const studioToolbar = document.querySelector('.editor-studio-toolbar');
    if (btnToggleTools && studioToolbar) {
      btnToggleTools.addEventListener('click', () => {
        studioToolbar.classList.toggle('collapsed-mobile');
      });
    }

    // Zoom controls
    const btnZoomOut = document.getElementById('btn-editor-zoom-out');
    const btnZoomIn = document.getElementById('btn-editor-zoom-in');
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => this.changeZoom(-0.2));
    if (btnZoomIn) btnZoomIn.addEventListener('click', () => this.changeZoom(0.2));

    // Actions
    const btnUndo = document.getElementById('btn-editor-undo');
    const btnClear = document.getElementById('btn-editor-clear');
    const btnSaveLib = document.getElementById('btn-editor-save-library');
    const btnDownload = document.getElementById('btn-editor-download');

    if (btnUndo) btnUndo.addEventListener('click', () => this.undoLastAction());
    if (btnClear) btnClear.addEventListener('click', () => this.clearCurrentPage());
    if (btnSaveLib) btnSaveLib.addEventListener('click', () => this.saveToLibrary());
    if (btnDownload) btnDownload.addEventListener('click', () => this.downloadEditedPdf());

    // Tools in Sidebar Panel
    this.bindToolButtons();

    // Color Swatches
    document.querySelectorAll('.editor-color-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        document.querySelectorAll('.editor-color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        this.currentColor = swatch.getAttribute('data-color');
        const picker = document.getElementById('editor-color-picker');
        if (picker) picker.value = this.currentColor;
        const hexBadge = document.getElementById('editor-color-hex-badge');
        if (hexBadge) hexBadge.textContent = this.currentColor.toUpperCase();
        this.updateStrokePreview();
      });
    });

    // Color picker
    const colorPicker = document.getElementById('editor-color-picker');
    if (colorPicker) {
      colorPicker.addEventListener('input', (e) => {
        this.currentColor = e.target.value;
        document.querySelectorAll('.editor-color-swatch').forEach(s => {
          s.classList.toggle('active', s.getAttribute('data-color') === this.currentColor);
        });
        const hexBadge = document.getElementById('editor-color-hex-badge');
        if (hexBadge) hexBadge.textContent = this.currentColor.toUpperCase();
        this.updateStrokePreview();
      });
    }

    // Stroke Width slider
    const strokeSlider = document.getElementById('editor-stroke-slider');
    if (strokeSlider) {
      strokeSlider.addEventListener('input', (e) => {
        this.strokeWidth = parseInt(e.target.value) || 4;
        const label = document.getElementById('editor-stroke-value');
        if (label) label.textContent = this.strokeWidth + 'px';
        this.updateStrokePreview();
      });
    }

    // Opacity slider
    const opacitySlider = document.getElementById('editor-opacity-slider');
    if (opacitySlider) {
      opacitySlider.addEventListener('input', (e) => {
        this.opacity = parseInt(e.target.value) / 100;
        const label = document.getElementById('editor-opacity-value');
        if (label) label.textContent = e.target.value + '%';
        this.updateStrokePreview();
      });
    }

    // Shape size slider
    const shapeSizeSlider = document.getElementById('editor-shape-size');
    if (shapeSizeSlider) {
      shapeSizeSlider.addEventListener('input', (e) => {
        this.shapeSize = parseInt(e.target.value) || 80;
        const label = document.getElementById('editor-shape-size-val');
        if (label) label.textContent = this.shapeSize + 'px';
      });
    }

    // Drawing Canvas Mouse & Touch Events
    const drawingCanvas = document.getElementById('editor-drawing-canvas');
    if (drawingCanvas) {
      drawingCanvas.addEventListener('mousedown', (e) => this.onPointerDown(e));
      drawingCanvas.addEventListener('mousemove', (e) => this.onPointerMove(e));
      drawingCanvas.addEventListener('mouseup', (e) => this.onPointerUp(e));
      drawingCanvas.addEventListener('mouseleave', (e) => this.onPointerUp(e));

      drawingCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); this.onPointerDown(e.touches[0]); }, { passive: false });
      drawingCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); this.onPointerMove(e.touches[0]); }, { passive: false });
      drawingCanvas.addEventListener('touchend', (e) => this.onPointerUp(e));
    }
  }

  bindToolButtons() {
    const toolBtns = document.querySelectorAll('.editor-tool-btn');
    toolBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        toolBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeMode = btn.getAttribute('data-tool-mode');
        this.updateCursorMode();
      });
    });
  }

  updateStrokePreview() {
    const linePreview = document.getElementById('editor-brush-preview-line');
    if (linePreview) {
      linePreview.style.height = Math.max(2, Math.min(this.strokeWidth, 26)) + 'px';
      linePreview.style.backgroundColor = this.currentColor;
      linePreview.style.opacity = this.opacity;
    }
  }

  showEditorView() {
    const topBar = document.querySelector('.top-bar');
    if (topBar) topBar.classList.add('hidden');

    const libraryContent = document.querySelector('.library-content');
    if (libraryContent) libraryContent.classList.add('hidden');

    const toolsView = document.getElementById('pdf-tools-view');
    if (toolsView) toolsView.classList.add('hidden');

    document.getElementById('pdf-editor-view').classList.remove('hidden');

    // Re-bind tool buttons
    setTimeout(() => this.bindToolButtons(), 100);
  }

  hideEditorView() {
    document.getElementById('pdf-editor-view').classList.add('hidden');
    const toolsView = document.getElementById('pdf-tools-view');
    if (toolsView && !toolsView.classList.contains('hidden-by-user')) {
      toolsView.classList.remove('hidden');
    } else {
      const libraryContent = document.querySelector('.library-content');
      if (libraryContent) libraryContent.classList.remove('hidden');
      const topBar = document.querySelector('.top-bar');
      if (topBar) topBar.classList.remove('hidden');
    }
  }

  async openBookInEditor(book) {
    this.currentBook = book;
    this.showEditorView();

    window.app.showToast('Carregando livro no Editor Avançado...', 'info');

    try {
      let arrayBuffer;
      const source = book.fileUrl || book.fileurl || book.file;

      if (source instanceof Blob || source instanceof File) {
        arrayBuffer = await source.arrayBuffer();
      } else if (typeof source === 'string') {
        const resp = await fetch(source);
        arrayBuffer = await resp.arrayBuffer();
      } else {
        const fullBook = await window.dbManager.getBook(book.id);
        const fullSource = fullBook?.fileUrl || fullBook?.fileurl || fullBook?.file;
        if (fullSource instanceof Blob || fullSource instanceof File) {
          arrayBuffer = await fullSource.arrayBuffer();
        } else if (typeof fullSource === 'string') {
          const resp = await fetch(fullSource);
          arrayBuffer = await resp.arrayBuffer();
        } else {
          // Generate blank page PDF
          const doc = await PDFLib.PDFDocument.create();
          doc.addPage([595.28, 841.89]);
          arrayBuffer = await doc.save();
        }
      }

      this.pdfBytes = arrayBuffer;
      this.pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) }).promise;
      this.numPages = this.pdfDoc.numPages;
      this.currentPageNum = 1;
      this.pageCanvasStates = {};
      this.historyStack = [];

      const isMobile = window.innerWidth <= 768;
      if (isMobile) {
        const firstPage = await this.pdfDoc.getPage(1);
        const unscaled = firstPage.getViewport({ scale: 1.0 });
        const availWidth = window.innerWidth - 16;
        this.scale = Math.min(1.0, +(availWidth / unscaled.width).toFixed(2));
      } else {
        this.scale = 1.0;
      }

      document.getElementById('editor-doc-title').textContent = book.title || 'Editor de PDF';
      document.getElementById('editor-empty-upload').classList.add('hidden');
      document.getElementById('editor-page-wrapper').classList.remove('hidden');

      await this.renderCurrentPage();
    } catch (err) {
      console.error('Error loading book in editor:', err);
      window.app.showToast('Erro ao carregar o documento no editor.', 'error');
    }
  }

  async handleFileSelected(fileList) {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];

    const tempBook = {
      id: 'editor_temp_' + Date.now(),
      title: file.name.replace(/\.pdf$/i, ''),
      file: file
    };

    await this.openBookInEditor(tempBook);
  }

  async renderCurrentPage() {
    if (!this.pdfDoc) return;

    document.getElementById('editor-page-indicator').textContent = `Página ${this.currentPageNum} de ${this.numPages}`;
    document.getElementById('editor-zoom-label').textContent = `${Math.round(this.scale * 100)}%`;

    const page = await this.pdfDoc.getPage(this.currentPageNum);
    const viewport = page.getViewport({ scale: this.scale });

    const pdfCanvas = document.getElementById('editor-pdf-canvas');
    const drawingCanvas = document.getElementById('editor-drawing-canvas');
    const wrapper = document.getElementById('editor-page-wrapper');

    wrapper.style.width = viewport.width + 'px';
    wrapper.style.height = viewport.height + 'px';

    pdfCanvas.width = viewport.width;
    pdfCanvas.height = viewport.height;
    drawingCanvas.width = viewport.width;
    drawingCanvas.height = viewport.height;

    const ctx = pdfCanvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport: viewport }).promise;

    // Restore saved drawing for this page
    this.restoreDrawingForPage();
    this.updateCursorMode();
  }

  changePage(delta) {
    this.saveDrawingForPage();

    const newPage = this.currentPageNum + delta;
    if (newPage >= 1 && newPage <= this.numPages) {
      this.currentPageNum = newPage;
      this.renderCurrentPage();
    }
  }

  changeZoom(delta) {
    const newScale = Math.min(Math.max(this.scale + delta, 0.5), 2.5);
    if (newScale !== this.scale) {
      this.scale = newScale;
      this.renderCurrentPage();
    }
  }

  saveDrawingForPage() {
    const canvas = document.getElementById('editor-drawing-canvas');
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;
    
    // Store snapshot on an offscreen canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);
    this.pageCanvasStates[this.currentPageNum] = tempCanvas;
  }

  restoreDrawingForPage() {
    const canvas = document.getElementById('editor-drawing-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const saved = this.pageCanvasStates[this.currentPageNum];
    if (saved && saved.width > 0 && saved.height > 0) {
      ctx.drawImage(saved, 0, 0, canvas.width, canvas.height);
    }
  }

  updateCursorMode() {
    const canvas = document.getElementById('editor-drawing-canvas');
    if (!canvas) return;

    const mode = this.activeMode;
    if (['pencil-fine', 'pencil-thick', 'pen', 'highlighter', 'highlighter-line', 'line'].includes(mode)) {
      canvas.style.cursor = 'crosshair';
    } else if (['rect', 'circle', 'triangle', 'arrow', 'star', 'diamond'].includes(mode)) {
      canvas.style.cursor = 'crosshair';
    } else if (mode === 'text' || mode === 'note') {
      canvas.style.cursor = 'text';
    } else if (mode === 'eraser-free') {
      canvas.style.cursor = 'cell';
    } else if (mode === 'eraser-all') {
      canvas.style.cursor = 'not-allowed';
    } else {
      canvas.style.cursor = 'default';
    }
  }

  // === POINTER EVENT HANDLERS ===

  onPointerDown(e) {
    const canvas = document.getElementById('editor-drawing-canvas');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const mode = this.activeMode;

    if (['pencil-fine', 'pencil-thick', 'pen', 'highlighter'].includes(mode)) {
      this.isDrawing = true;
      this.saveStateToHistory();
      this.currentPath = [{ x, y }];
      const ctx = canvas.getContext('2d');
      ctx.globalAlpha = mode === 'highlighter' ? 0.35 : this.opacity;
      ctx.beginPath();
      ctx.arc(x, y, this.getDrawWidth() / 2, 0, Math.PI * 2);
      ctx.fillStyle = this.currentColor;
      ctx.fill();
    } else if (mode === 'line') {
      this.isDrawing = true;
      this.saveStateToHistory();
      this.drawStartX = x;
      this.drawStartY = y;
      const ctx = canvas.getContext('2d');
      this._linePreviewState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } else if (mode === 'highlighter-line') {
      this.isDrawing = true;
      this.saveStateToHistory();
      this.drawStartX = x;
      this.drawStartY = y;
      const ctx = canvas.getContext('2d');
      this._linePreviewState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } else if (['rect', 'circle', 'triangle', 'arrow', 'star', 'diamond'].includes(mode)) {
      this.isDrawing = true;
      this.saveStateToHistory();
      this.drawStartX = x;
      this.drawStartY = y;
      const ctx = canvas.getContext('2d');
      this._shapePreviewState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } else if (mode === 'text') {
      this.addTextInputAt(x, y);
    } else if (mode === 'note') {
      this.addStickyNoteAt(x, y);
    } else if (mode === 'eraser-free') {
      this.isDrawing = true;
      this.eraseAt(x, y);
    } else if (mode === 'eraser-all') {
      this.saveStateToHistory();
      this.clearCurrentPage();
    }
  }

  onPointerMove(e) {
    if (!this.isDrawing) return;
    const canvas = document.getElementById('editor-drawing-canvas');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvas.getContext('2d');
    const mode = this.activeMode;

    if (['pencil-fine', 'pencil-thick', 'pen'].includes(mode)) {
      this.currentPath.push({ x, y });
      ctx.globalAlpha = this.opacity;
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = this.currentColor;
      ctx.lineWidth = this.getDrawWidth();

      const len = this.currentPath.length;
      if (len > 1) {
        ctx.moveTo(this.currentPath[len - 2].x, this.currentPath[len - 2].y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
    } else if (mode === 'highlighter') {
      this.currentPath.push({ x, y });
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = this.currentColor;
      ctx.lineWidth = Math.max(16, this.strokeWidth * 3.5);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const len = this.currentPath.length;
      if (len > 2) {
        const p0 = this.currentPath[len - 3];
        const p1 = this.currentPath[len - 2];
        const p2 = this.currentPath[len - 1];
        const mid1 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
        const mid2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        ctx.beginPath();
        ctx.moveTo(mid1.x, mid1.y);
        ctx.quadraticCurveTo(p1.x, p1.y, mid2.x, mid2.y);
        ctx.stroke();
      } else if (len === 2) {
        ctx.beginPath();
        ctx.moveTo(this.currentPath[0].x, this.currentPath[0].y);
        ctx.lineTo(this.currentPath[1].x, this.currentPath[1].y);
        ctx.stroke();
      }
      ctx.restore();
    } else if (mode === 'line') {
      if (this._linePreviewState) {
        ctx.putImageData(this._linePreviewState, 0, 0);
      }
      ctx.globalAlpha = this.opacity;
      ctx.beginPath();
      ctx.moveTo(this.drawStartX, this.drawStartY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = this.currentColor;
      ctx.lineWidth = this.strokeWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
    } else if (mode === 'highlighter-line') {
      if (this._linePreviewState) {
        ctx.putImageData(this._linePreviewState, 0, 0);
      }
      ctx.globalAlpha = 0.38;
      ctx.beginPath();
      ctx.moveTo(this.drawStartX, this.drawStartY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = this.currentColor;
      ctx.lineWidth = Math.max(14, this.strokeWidth * 3.5);
      ctx.lineCap = 'square';
      ctx.stroke();
    } else if (['rect', 'circle', 'triangle', 'arrow', 'star', 'diamond'].includes(mode)) {
      if (this._shapePreviewState) {
        ctx.putImageData(this._shapePreviewState, 0, 0);
      }
      this.drawShapeBetween(mode, this.drawStartX, this.drawStartY, x, y);
    } else if (mode === 'eraser-free') {
      this.eraseAt(x, y);
    }
  }

  onPointerUp(e) {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    const mode = this.activeMode;
    if (mode === 'line' || mode === 'highlighter-line') {
      this._linePreviewState = null;
    } else if (['rect', 'circle', 'triangle', 'arrow', 'star', 'diamond'].includes(mode)) {
      this._shapePreviewState = null;
    }

    this.currentPath = [];
    const canvas = document.getElementById('editor-drawing-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.globalAlpha = 1.0;
    }
  }

  // === DRAWING HELPERS ===

  getDrawWidth() {
    const mode = this.activeMode;
    if (mode === 'pencil-fine') return Math.max(1, this.strokeWidth * 0.5);
    if (mode === 'pencil-thick') return this.strokeWidth * 2.5;
    if (mode === 'pen') return this.strokeWidth;
    if (mode === 'highlighter') return this.strokeWidth * 4;
    return this.strokeWidth;
  }

  getDrawColor() {
    const mode = this.activeMode;
    if (mode === 'highlighter') {
      const hex = this.currentColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) || 239;
      const g = parseInt(hex.substring(2, 4), 16) || 68;
      const b = parseInt(hex.substring(4, 6), 16) || 68;
      return `rgba(${r}, ${g}, ${b}, 0.35)`;
    }
    return this.currentColor;
  }

  eraseAt(x, y) {
    const canvas = document.getElementById('editor-drawing-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const radius = this.strokeWidth * 3;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawShapeBetween(shapeType, x1, y1, x2, y2) {
    const canvas = document.getElementById('editor-drawing-canvas');
    const ctx = canvas.getContext('2d');

    if (shapeType === 'highlighter-box') {
      const hex = this.currentColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16) || 234;
      const g = parseInt(hex.substring(2, 4), 16) || 179;
      const b = parseInt(hex.substring(4, 6), 16) || 8;
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.4)`;
      ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
      return;
    }

    ctx.globalAlpha = this.opacity;
    ctx.strokeStyle = this.currentColor;
    ctx.lineWidth = this.strokeWidth;
    ctx.fillStyle = this.currentColor + '25';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);

    if (shapeType === 'rect') {
      ctx.fillRect(left, top, w, h);
      ctx.strokeRect(left, top, w, h);
    } else if (shapeType === 'circle') {
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(w / 2, 1), Math.max(h / 2, 1), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (shapeType === 'triangle') {
      ctx.beginPath();
      ctx.moveTo(cx, top);
      ctx.lineTo(left, top + h);
      ctx.lineTo(left + w, top + h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (shapeType === 'arrow') {
      const headLen = Math.min(24, Math.max(10, Math.hypot(x2 - x1, y2 - y1) * 0.25));
      const angle = Math.atan2(y2 - y1, x2 - x1);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    } else if (shapeType === 'star') {
      const spikes = 5;
      const outerR = Math.min(w, h) / 2;
      const innerR = outerR * 0.4;
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const a = (Math.PI / 2 * 3) + (i * Math.PI / spikes);
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (shapeType === 'diamond') {
      ctx.beginPath();
      ctx.moveTo(cx, top);
      ctx.lineTo(left + w, cy);
      ctx.lineTo(cx, top + h);
      ctx.lineTo(left, cy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  // === HISTORY / UNDO ===

  saveStateToHistory() {
    const canvas = document.getElementById('editor-drawing-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    this.historyStack.push({ pageNum: this.currentPageNum, data: imgData });
    if (this.historyStack.length > 30) this.historyStack.shift();
  }

  undoLastAction() {
    const pageHistory = this.historyStack.filter(h => h.pageNum === this.currentPageNum);
    if (pageHistory.length === 0) {
      window.app.showToast('Nenhuma ação para desfazer.', 'info');
      return;
    }

    for (let i = this.historyStack.length - 1; i >= 0; i--) {
      if (this.historyStack[i].pageNum === this.currentPageNum) {
        const state = this.historyStack.splice(i, 1)[0];
        const canvas = document.getElementById('editor-drawing-canvas');
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.putImageData(state.data, 0, 0);
        }
        window.app.showToast('Ação desfeita.');
        return;
      }
    }
  }

  clearCurrentPage() {
    const canvas = document.getElementById('editor-drawing-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    const overlay = document.getElementById('editor-elements-overlay');
    if (overlay) overlay.innerHTML = '';
    delete this.pageCanvasStates[this.currentPageNum];
    window.app.showToast('Página limpa.');
  }

  // === INTERACTIVE TEXT & NOTES ===

  addTextInputAt(x, y) {
    const overlay = document.getElementById('editor-elements-overlay');
    if (!overlay) return;

    // Deselect previous active textboxes
    overlay.querySelectorAll('.editor-textbox-container').forEach(el => el.classList.remove('active'));

    const container = document.createElement('div');
    container.className = 'editor-textbox-container active';
    container.style.left = `${Math.max(10, x)}px`;
    container.style.top = `${Math.max(10, y)}px`;
    container.style.width = '200px';

    const fontSize = Math.max(14, this.strokeWidth * 3 + 8);
    const color = this.currentColor;

    container.innerHTML = `
      <div class="editor-textbox-toolbar">
        <button class="tb-btn tb-font-minus" title="Diminuir Fonte">A-</button>
        <button class="tb-btn tb-font-plus" title="Aumentar Fonte">A+</button>
        <button class="tb-btn tb-del-btn" title="Excluir">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
      <div class="editor-textbox-drag-handle" title="Arraste para Mover">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg>
      </div>
      <div class="editor-textbox-content" contenteditable="true" spellcheck="false" style="color: ${color}; font-size: ${fontSize}px; font-weight: 600;">Digite seu texto aqui...</div>
      <div class="editor-resize-handle se" data-dir="se" title="Redimensionar"></div>
      <div class="editor-resize-handle sw" data-dir="sw" title="Redimensionar"></div>
      <div class="editor-resize-handle e" data-dir="e" title="Redimensionar largura"></div>
    `;

    overlay.appendChild(container);

    const content = container.querySelector('.editor-textbox-content');
    const dragHandle = container.querySelector('.editor-textbox-drag-handle');
    const btnMinus = container.querySelector('.tb-font-minus');
    const btnPlus = container.querySelector('.tb-font-plus');
    const btnDel = container.querySelector('.tb-del-btn');

    btnMinus.addEventListener('click', (e) => {
      e.stopPropagation();
      let cur = parseFloat(content.style.fontSize) || 16;
      content.style.fontSize = Math.max(10, cur - 2) + 'px';
    });

    btnPlus.addEventListener('click', (e) => {
      e.stopPropagation();
      let cur = parseFloat(content.style.fontSize) || 16;
      content.style.fontSize = Math.min(72, cur + 2) + 'px';
    });

    btnDel.addEventListener('click', (e) => {
      e.stopPropagation();
      container.remove();
    });

    container.addEventListener('mousedown', (e) => {
      overlay.querySelectorAll('.editor-textbox-container').forEach(el => el.classList.remove('active'));
      container.classList.add('active');
    });

    this.attachDraggable(container, dragHandle);
    this.attachResizable(container);

    setTimeout(() => {
      content.focus();
      document.execCommand('selectAll', false, null);
    }, 50);
  }

  attachDraggable(container, handle) {
    let isDragging = false;
    let startX = 0, startY = 0;
    let origX = 0, origY = 0;

    const onMouseDown = (e) => {
      if (e.target.closest('.editor-textbox-content') && e.target.getAttribute('contenteditable') === 'true') {
        return;
      }
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      origX = container.offsetLeft;
      origY = container.offsetTop;
      e.stopPropagation();
    };

    handle.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousedown', (e) => {
      if (e.target === container || e.target.classList.contains('editor-textbox-toolbar')) {
        onMouseDown(e);
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      container.style.left = (origX + dx) + 'px';
      container.style.top = (origY + dy) + 'px';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  attachResizable(container) {
    const handles = container.querySelectorAll('.editor-resize-handle');
    handles.forEach(h => {
      h.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();

        const dir = h.getAttribute('data-dir');
        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = container.offsetWidth;
        const startHeight = container.offsetHeight;
        const startLeft = container.offsetLeft;

        const onMouseMove = (moveEvent) => {
          const dx = moveEvent.clientX - startX;
          const dy = moveEvent.clientY - startY;

          if (dir === 'se' || dir === 'e') {
            container.style.width = Math.max(120, startWidth + dx) + 'px';
          }
          if (dir === 'se') {
            container.style.height = Math.max(40, startHeight + dy) + 'px';
          }
          if (dir === 'sw') {
            const newWidth = Math.max(120, startWidth - dx);
            if (newWidth > 120) {
              container.style.width = newWidth + 'px';
              container.style.left = (startLeft + dx) + 'px';
            }
            container.style.height = Math.max(40, startHeight + dy) + 'px';
          }
        };

        const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });
  }

  async addStickyNoteAt(x, y) {
    const noteText = await window.app.showPromptModal('Criar Nota Adesiva (Post-It)', '', '');
    if (!noteText) return;

    const overlay = document.getElementById('editor-elements-overlay');
    const noteEl = document.createElement('div');
    noteEl.className = 'editor-sticky-note';
    noteEl.style.cssText = `position:absolute; left:${x}px; top:${y}px; background:#fef08a; color:#854d0e; padding:10px 14px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15); max-width:200px; font-size:0.85rem; font-weight:600; pointer-events:auto; border-left:4px solid #eab308; cursor:move; user-select:none;`;
    noteEl.textContent = noteText;
    this.makeDraggable(noteEl);
    overlay.appendChild(noteEl);
  }

  makeDraggable(el) {
    let isDragging = false;
    let offsetX = 0, offsetY = 0;

    el.addEventListener('mousedown', (e) => {
      if (this.activeMode !== 'select') return;
      isDragging = true;
      offsetX = e.clientX - el.offsetLeft;
      offsetY = e.clientY - el.offsetTop;
      e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      el.style.left = (e.clientX - offsetX) + 'px';
      el.style.top = (e.clientY - offsetY) + 'px';
    });

    document.addEventListener('mouseup', () => { isDragging = false; });
  }

  // === EXPORT ===

  async generateEditedPdfBlob() {
    if (!this.pdfBytes) return null;

    window.app.showToast('Mesclando edições e gerando PDF final...', 'info');

    this.saveDrawingForPage();

    const pdfLibDoc = await PDFLib.PDFDocument.load(this.pdfBytes);
    const pdfCanvas = document.getElementById('editor-pdf-canvas');
    const drawingCanvas = document.getElementById('editor-drawing-canvas');

    const mergedCanvas = document.createElement('canvas');
    mergedCanvas.width = pdfCanvas.width;
    mergedCanvas.height = pdfCanvas.height;

    const ctx = mergedCanvas.getContext('2d');
    ctx.drawImage(pdfCanvas, 0, 0);
    ctx.drawImage(drawingCanvas, 0, 0);

    // Draw interactive textboxes onto merged canvas
    const overlay = document.getElementById('editor-elements-overlay');
    if (overlay) {
      const textboxes = overlay.querySelectorAll('.editor-textbox-container');
      textboxes.forEach(tb => {
        const content = tb.querySelector('.editor-textbox-content');
        if (!content) return;
        const text = content.innerText.trim();
        if (!text) return;
        const left = parseFloat(tb.style.left) || 0;
        const top = parseFloat(tb.style.top) || 0;
        const fontSize = parseFloat(content.style.fontSize) || 16;
        const color = content.style.color || '#000000';
        const maxWidth = parseFloat(tb.style.width) || 200;

        ctx.save();
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = color;
        ctx.textBaseline = 'top';

        const words = text.split(' ');
        let line = '';
        let curY = top + 8;
        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line, left + 8, curY);
            line = words[n] + ' ';
            curY += fontSize * 1.3;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, left + 8, curY);
        ctx.restore();
      });
    }

    const imgDataUrl = mergedCanvas.toDataURL('image/jpeg', 0.92);
    const imgBytes = await fetch(imgDataUrl).then(res => res.arrayBuffer());

    const pageCount = pdfLibDoc.getPageCount();
    if (this.currentPageNum <= pageCount) {
      const page = pdfLibDoc.getPage(this.currentPageNum - 1);
      const embeddedImg = await pdfLibDoc.embedJpg(imgBytes);
      const { width, height } = page.getSize();

      page.drawImage(embeddedImg, { x: 0, y: 0, width, height });
    }

    const finalPdfBytes = await pdfLibDoc.save();
    return new Blob([finalPdfBytes], { type: 'application/pdf' });
  }

  async downloadEditedPdf() {
    const blob = await this.generateEditedPdfBlob();
    if (!blob) return;

    const filename = (this.currentBook?.title || 'documento') + '_editado.pdf';
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.click();
    window.app.showToast('Download do PDF editado iniciado!');
  }

  async saveToLibrary() {
    const blob = await this.generateEditedPdfBlob();
    if (!blob) return;

    const filename = (this.currentBook?.title || 'documento') + '_editado.pdf';
    const file = new File([blob], filename, { type: 'application/pdf' });

    if (window.libraryManager) {
      await window.libraryManager.handleFileSelect([file]);
      window.app.showToast(`"${filename}" salvo na sua biblioteca com sucesso!`);
    }
  }
}

window.pdfEditorManager = new PdfEditorManager();
