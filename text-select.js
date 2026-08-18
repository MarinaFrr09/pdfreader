/* ==========================================================================
   TEXT SELECTION & 5 PASTEL COLORS HIGHLIGHTING MANAGER
   ========================================================================== */

class TextSelectionManager {
  constructor() {
    this.isInitialized = false;
    this.activeSelection = null;
    this.popup = null;
    this.isAreaModeActive = false; // Toggle switch mode (Caneta Marca-Texto)
    this.selectedColorKey = localStorage.getItem('last_highlight_color') || 'yellow';
    this.highlightOpacity = parseFloat(localStorage.getItem('highlight_opacity') || '0.48');

    this.colors = {
      pink: '#ff2a70',
      yellow: '#ffd600',
      green: '#00b828',
      blue: '#2563eb',
      purple: '#9333ea'
    };

    this.isDrawing = false;
    this.drawStart = null;
    this.tempDrawBox = null;
  }

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    this.createSelectionPopup();
    this.setupEventListeners();
    this.setupAreaHighlighterToolbar();
    this.setupSettingsModal();
  }

  setupSettingsModal() {
    const btnOpenSettings = document.getElementById('btn-reader-settings');
    const modalSettings = document.getElementById('modal-settings');
    const btnCloseSettings = document.getElementById('btn-close-settings-modal');
    const opacityRange = document.getElementById('highlighter-opacity-range');
    const opacityValueLabel = document.getElementById('opacity-slider-value');
    const btnToggleTheme = document.getElementById('btn-toggle-theme-modal');
    const btnToggleAnim = document.getElementById('btn-toggle-animation-modal');
    const animLabel = document.getElementById('animation-toggle-label');
    const settingsSwatchesContainer = document.getElementById('settings-color-swatches');

    // Opacity Range Slider Live Update
    if (opacityRange && opacityValueLabel) {
      opacityRange.value = Math.round(this.highlightOpacity * 100);
      opacityValueLabel.textContent = `${opacityRange.value}%`;

      opacityRange.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        opacityValueLabel.textContent = `${val}%`;
        this.highlightOpacity = val / 100;
        localStorage.setItem('highlight_opacity', this.highlightOpacity);
        this.updateAllHighlightsOpacity();
      });
    }

    // Default Color Swatches in Settings Modal
    if (settingsSwatchesContainer) {
      settingsSwatchesContainer.querySelectorAll('.toolbar-swatch').forEach(swatch => {
        if (swatch.dataset.color === this.selectedColorKey) {
          settingsSwatchesContainer.querySelectorAll('.toolbar-swatch').forEach(s => s.classList.remove('active'));
          swatch.classList.add('active');
        }

        swatch.addEventListener('click', (e) => {
          settingsSwatchesContainer.querySelectorAll('.toolbar-swatch').forEach(s => s.classList.remove('active'));
          swatch.classList.add('active');
          this.selectedColorKey = swatch.dataset.color;
          localStorage.setItem('last_highlight_color', this.selectedColorKey);
          
          // Also sync toolbar swatches
          const colorBar = document.getElementById('highlighter-color-bar');
          if (colorBar) {
            colorBar.querySelectorAll('.toolbar-swatch').forEach(s => {
              s.classList.toggle('active', s.dataset.color === this.selectedColorKey);
            });
          }
        });
      });
    }

    // Page Animation Toggle Button
    if (btnToggleAnim && animLabel) {
      let isAnimOn = localStorage.getItem('pdf_page_animation') !== 'off';
      animLabel.textContent = isAnimOn ? 'Com Animação' : 'Sem Animação';
      document.body.classList.toggle('no-page-animation', !isAnimOn);

      btnToggleAnim.addEventListener('click', () => {
        isAnimOn = !isAnimOn;
        localStorage.setItem('pdf_page_animation', isAnimOn ? 'on' : 'off');
        animLabel.textContent = isAnimOn ? 'Com Animação' : 'Sem Animação';
        document.body.classList.toggle('no-page-animation', !isAnimOn);

        const pageContainer = document.getElementById('pdf-page-container');
        if (pageContainer) {
          pageContainer.classList.remove('page-flip-anim-next', 'page-flip-anim-prev');
        }
      });
    }

    if (btnOpenSettings && modalSettings) {
      btnOpenSettings.addEventListener('click', () => {
        modalSettings.classList.remove('hidden');
      });
    }

    if (btnCloseSettings && modalSettings) {
      btnCloseSettings.addEventListener('click', () => {
        modalSettings.classList.add('hidden');
      });
    }

    const btnSaveSettings = document.getElementById('btn-save-settings');
    if (btnSaveSettings && modalSettings) {
      btnSaveSettings.addEventListener('click', () => {
        modalSettings.classList.add('hidden');
        window.app.showToast('Configurações salvas!');
      });
    }

    // Close modal when clicking outside on the dark overlay backdrop
    if (modalSettings) {
      modalSettings.addEventListener('click', (e) => {
        if (e.target === modalSettings) {
          modalSettings.classList.add('hidden');
        }
      });
    }

    if (btnToggleTheme) {
      btnToggleTheme.addEventListener('click', () => {
        window.app.toggleTheme();
      });
    }
  }

  updateAllHighlightsOpacity() {
    const allHighlights = document.querySelectorAll('.highlight-rect');
    allHighlights.forEach(el => {
      el.style.opacity = `${this.highlightOpacity}`;
    });
  }

  setupAreaHighlighterToolbar() {
    const btnToggle = document.getElementById('btn-toggle-highlighter-mode');
    const colorBar = document.getElementById('highlighter-color-bar');

    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        this.isAreaModeActive = !this.isAreaModeActive;
        btnToggle.classList.toggle('active', this.isAreaModeActive);

        if (colorBar) {
          colorBar.classList.toggle('hidden', !this.isAreaModeActive);
        }

        const pageViews = document.querySelectorAll('.pdf-page-view');
        pageViews.forEach(pv => pv.classList.toggle('highlight-mode-active', this.isAreaModeActive));
      });
    }

    // Color Swatches in Toolbar
    if (colorBar) {
      colorBar.querySelectorAll('.toolbar-swatch').forEach(swatch => {
        if (swatch.dataset.color === this.selectedColorKey) {
          colorBar.querySelectorAll('.toolbar-swatch').forEach(s => s.classList.remove('active'));
          swatch.classList.add('active');
        }

        swatch.addEventListener('click', (e) => {
          colorBar.querySelectorAll('.toolbar-swatch').forEach(s => s.classList.remove('active'));
          swatch.classList.add('active');
          this.selectedColorKey = swatch.dataset.color;
          localStorage.setItem('last_highlight_color', this.selectedColorKey);
        });
      });
    }
  }

  setupEventListeners() {
    // Selection Change Listener
    document.addEventListener('selectionchange', () => {
      this.handleSelectionChange();
    });

    // Mouse Up Trigger
    document.addEventListener('mouseup', (e) => {
      if (!this.isDrawing) {
        setTimeout(() => this.handleSelectionChange(), 30);
      }
    });

    // 2 CLIQUES (dblclick): Seleciona APENAS 1 palavra
    document.addEventListener('dblclick', (e) => {
      if (e.target.closest('.textLayer')) {
        setTimeout(() => this.handleSelectionChange(), 20);
      }
    });

    // 3 CLIQUES (e.detail === 3): Seleciona O PARÁGRAFO / PERÍODO INTEIRO perfeitamente até o ponto (.)
    document.addEventListener('click', (e) => {
      if (e.detail === 3) {
        const span = e.target.closest('.textLayer span');
        if (span) {
          this.selectSentenceAtTarget(span, e);
        }
      }
    });

    // KEYBOARD SHORTCUTS: 'X' to Highlight, 'L' to Toggle Sidebar, 'N' to Add Note, 'Delete' / 'Backspace' / 'R' to Remove Highlight!
    window.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, [contenteditable="true"]')) return;

      const keyUpper = e.key.toUpperCase();
      if (keyUpper === 'X') {
        e.preventDefault();
        this.executeInstantHighlight(this.selectedColorKey || 'yellow');
      } else if (keyUpper === 'L') {
        e.preventDefault();
        const sidebar = document.getElementById('reader-sidebar');
        const btnSidebarToggle = document.getElementById('btn-toggle-reader-sidebar');
        if (sidebar) {
          sidebar.classList.toggle('collapsed');
          if (btnSidebarToggle) btnSidebarToggle.classList.toggle('active');
        }
      } else if (keyUpper === 'N') {
        if (this.activeSelection && this.activeSelection.text) {
          e.preventDefault();
          this.addNoteToActiveSelection();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace' || keyUpper === 'R') {
        if (this.activeSelection && this.activeSelection.text) {
          e.preventDefault();
          this.removeHighlightForSelection();
        }
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (this.popup && !this.popup.contains(e.target) && !e.target.closest('.textLayer')) {
        this.hidePopup();
      }
    });
  }

  createSelectionPopup() {
    this.popup = document.createElement('div');
    this.popup.className = 'selection-popup hidden';
    this.popup.innerHTML = `
      <div class="color-swatch swatch-pink" data-color="pink" title="Grifar Rosa"></div>
      <div class="color-swatch swatch-yellow" data-color="yellow" title="Grifar Amarelo"></div>
      <div class="color-swatch swatch-green" data-color="green" title="Grifar Verde"></div>
      <div class="color-swatch swatch-blue" data-color="blue" title="Grifar Azul"></div>
      <div class="color-swatch swatch-purple" data-color="purple" title="Grifar Roxo"></div>
      <div class="popup-divider"></div>
      <button class="popup-btn" id="btn-add-note-selection" style="color: var(--primary); font-weight: 700; display: flex; align-items: center; gap: 4px;" title="Adicionar Nota / Comentário (Atalho: Tecla N)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        <span>Adicionar Nota <small style="font-size: 0.65rem; opacity: 0.85; font-weight: 500;">(N)</small></span>
      </button>
      <div class="popup-divider"></div>
      <button class="popup-btn" id="btn-remove-selection" style="color: var(--danger); font-weight: 700; display: flex; align-items: center; gap: 4px;" title="Remover Marcação do Texto Selecionado (Atalho: Tecla R)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 20H7L3 16C2 15 2 13 3 12L13 2L22 11L18 15L20 20Z"></path><path d="M6 11L15 20"></path></svg>
        <span>Remover Marcação <small style="font-size: 0.65rem; opacity: 0.85; font-weight: 500;">(R)</small></span>
      </button>
      <div class="popup-divider"></div>
      <button class="popup-btn" id="btn-copy-selection">Copiar</button>
    `;

    document.body.appendChild(this.popup);

    // Color Swatch Click Handlers
    this.popup.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.addEventListener('mousedown', (e) => e.preventDefault());
      swatch.addEventListener('click', (e) => {
        const colorKey = e.currentTarget.dataset.color;
        this.applyHighlight(colorKey);
      });
    });

    // Add Note Button Handler
    const btnAddNote = this.popup.querySelector('#btn-add-note-selection');
    if (btnAddNote) {
      btnAddNote.addEventListener('mousedown', (e) => e.preventDefault());
      btnAddNote.addEventListener('click', () => {
        this.addNoteToActiveSelection();
      });
    }

    // Remove Highlight Button Handler
    const btnRemove = this.popup.querySelector('#btn-remove-selection');
    if (btnRemove) {
      btnRemove.addEventListener('mousedown', (e) => e.preventDefault());
      btnRemove.addEventListener('click', () => {
        this.removeHighlightForSelection();
      });
    }

    // Copy Button Handler
    const btnCopy = this.popup.querySelector('#btn-copy-selection');
    if (btnCopy) {
      btnCopy.addEventListener('mousedown', (e) => e.preventDefault());
      btnCopy.addEventListener('click', () => {
        if (this.activeSelection && this.activeSelection.text) {
          navigator.clipboard.writeText(this.activeSelection.text);
          window.app.showToast('Texto copiado!');
          this.hidePopup();
        }
      });
    }
  }

  async addNoteToActiveSelection() {
    if (!this.activeSelection || !this.activeSelection.text || !window.readerManager.currentBook) return;

    const defaultColorKey = this.selectedColorKey || 'yellow';
    const highlightColor = this.colors[defaultColorKey] || this.colors.yellow;

    const noteText = prompt(`Digite a sua anotação/comentário para o trecho:\n"${this.activeSelection.text.substring(0, 50)}..."`);
    if (noteText === null) return; // User cancelled

    const highlight = {
      id: 'hl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      bookId: window.readerManager.currentBook.id,
      pageNum: this.activeSelection.pageNum,
      text: this.activeSelection.text,
      color: highlightColor,
      note: noteText.trim(),
      rects: this.activeSelection.rects,
      createdAt: Date.now()
    };

    await window.dbManager.saveHighlight(highlight);
    this.renderHighlightOnPage(highlight, this.activeSelection.pageWrapper);
    window.getSelection().removeAllRanges();
    this.hidePopup();

    if (window.readerSidebarManager) {
      window.readerSidebarManager.renderHighlightsList();
    }

    window.app.showToast('Nota salva com sucesso!');
  }

  selectSentenceAtTarget(span, clickEvent) {
    const textLayer = span.closest('.textLayer');
    if (!textLayer) return;

    // Collect all text nodes in order
    const nodeMap = [];
    let fullText = '';

    const walker = document.createTreeWalker(textLayer, NodeFilter.SHOW_TEXT, null, false);
    let currentNode;
    while (currentNode = walker.nextNode()) {
      const text = currentNode.textContent;
      if (text) {
        nodeMap.push({
          node: currentNode,
          start: fullText.length,
          end: fullText.length + text.length,
          text: text
        });
        fullText += text;
      }
    }

    if (nodeMap.length === 0 || !fullText) return;

    // Find character index where user clicked
    let clickCharIndex = -1;
    if (document.caretRangeFromPoint) {
      const caret = document.caretRangeFromPoint(clickEvent.clientX, clickEvent.clientY);
      if (caret && caret.startContainer) {
        const entry = nodeMap.find(m => m.node === caret.startContainer);
        if (entry) {
          clickCharIndex = entry.start + caret.startOffset;
        }
      }
    }

    if (clickCharIndex === -1) {
      const firstEntry = nodeMap.find(m => m.node === span.firstChild || m.node.parentNode === span);
      clickCharIndex = firstEntry ? firstEntry.start : 0;
    }

    // Find Sentence Start: Walk backwards from clickCharIndex to previous period or list number
    let startIdx = 0;
    const subTextBefore = fullText.slice(0, clickCharIndex);
    
    // Find last sentence ending (. ! ?) before clickCharIndex
    let lastEnding = -1;
    const regex = /[.!?](\s+|$)/g;
    let match;
    while ((match = regex.exec(subTextBefore)) !== null) {
      const isListNum = /^\s*\d+[.!?]\s*$/.test(subTextBefore.slice(0, match.index + match[0].length));
      if (!isListNum) {
        lastEnding = match.index + match[0].length;
      }
    }

    if (lastEnding !== -1) {
      startIdx = lastEnding;
    } else {
      const listPrefix = /^\s*\d+[\.\)]\s*/.exec(fullText);
      if (listPrefix && clickCharIndex >= listPrefix[0].length) {
        startIdx = listPrefix[0].length;
      }
    }

    // Find Sentence End: Walk forwards from clickCharIndex to next period/exclamation/question mark
    let endIdx = fullText.length;
    const forwardText = fullText.slice(clickCharIndex);
    const endMatch = /[.!?](\s+|$)/.exec(forwardText);
    if (endMatch) {
      endIdx = clickCharIndex + endMatch.index + 1; // Include period '.'
    }

    // Map startIdx and endIdx back to exact text nodes and offsets
    const startEntry = nodeMap.find(m => startIdx >= m.start && startIdx <= m.end) || nodeMap[0];
    const endEntry = nodeMap.find(m => endIdx >= m.start && endIdx <= m.end) || nodeMap[nodeMap.length - 1];

    try {
      const range = document.createRange();
      range.setStart(startEntry.node, Math.max(0, Math.min(startIdx - startEntry.start, startEntry.text.length)));
      range.setEnd(endEntry.node, Math.max(0, Math.min(endIdx - endEntry.start, endEntry.text.length)));

      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      setTimeout(() => this.handleSelectionChange(), 20);
    } catch (err) {
      console.warn('Failed to set exact sentence range:', err);
    }
  }

  handleSelectionChange() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
          this.hidePopup();
        }
      }, 250);
      return;
    }

    const text = selection.toString().trim();
    if (!text) return;

    let range = null;
    try {
      range = selection.getRangeAt(0);
    } catch (e) {
      return;
    }

    const container = range.commonAncestorContainer;
    let pageWrapper = null;

    if (container) {
      if (container.nodeType === 3 && container.parentElement) {
        pageWrapper = container.parentElement.closest('.pdf-page-view');
      } else if (container.closest) {
        pageWrapper = container.closest('.pdf-page-view');
      }
    }

    if (!pageWrapper && selection.anchorNode) {
      const anchorEl = selection.anchorNode.nodeType === 3 ? selection.anchorNode.parentElement : selection.anchorNode;
      if (anchorEl && anchorEl.closest) {
        pageWrapper = anchorEl.closest('.pdf-page-view');
      }
    }

    if (!pageWrapper) {
      pageWrapper = document.querySelector('.pdf-page-view');
    }

    if (!pageWrapper) return;

    let clientRects = range.getClientRects();
    if (clientRects.length === 0) {
      const boundRect = range.getBoundingClientRect();
      if (boundRect.width > 0 && boundRect.height > 0) {
        clientRects = [boundRect];
      }
    }

    if (clientRects.length === 0) return;

    const pageRect = pageWrapper.getBoundingClientRect();
    
    // Merge clientRects per text line to eliminate gaps and uneven double-opacity rendering
    const mergedLineRects = [];
    const lineThreshold = 6; // vertical line alignment tolerance in px

    for (let i = 0; i < clientRects.length; i++) {
      const r = clientRects[i];
      if (r.width <= 0 || r.height <= 0) continue;

      let line = mergedLineRects.find(l => Math.abs(l.top - r.top) < lineThreshold);
      if (line) {
        const newLeft = Math.min(line.left, r.left);
        const newRight = Math.max(line.right, r.left + r.width);
        line.left = newLeft;
        line.right = newRight;
        line.width = newRight - newLeft;
        line.top = Math.min(line.top, r.top);
        line.height = Math.max(line.height, r.height);
      } else {
        mergedLineRects.push({
          left: r.left,
          top: r.top,
          width: r.width,
          height: r.height,
          right: r.left + r.width
        });
      }
    }

    const relativeRects = [];
    for (let i = 0; i < mergedLineRects.length; i++) {
      const r = mergedLineRects[i];
      relativeRects.push({
        left: (r.left - pageRect.left) / pageRect.width,
        top: (r.top - pageRect.top) / pageRect.height,
        width: r.width / pageRect.width,
        height: r.height / pageRect.height
      });
    }

    const pageNum = pageWrapper.dataset.pageNum 
      ? parseInt(pageWrapper.dataset.pageNum, 10) 
      : (window.readerManager ? window.readerManager.currentPage : 1);

    this.activeSelection = {
      text: text,
      range: range,
      rects: relativeRects,
      pageWrapper: pageWrapper,
      pageNum: pageNum
    };

    // If Grifar Toggle Mode is ON: Auto-highlight selection immediately!
    if (this.isAreaModeActive) {
      this.applyHighlight(this.selectedColorKey || 'yellow');
      return;
    }

    // Position Popup above selection
    const firstRect = clientRects[0];
    const popupLeft = firstRect.left + (firstRect.width / 2);
    const popupTop = firstRect.top - 8;

    this.popup.style.left = `${popupLeft}px`;
    this.popup.style.top = `${popupTop}px`;
    this.popup.classList.remove('hidden');
  }

  executeInstantHighlight(colorKey) {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim()) {
      this.handleSelectionChange();
    }

    if (this.activeSelection && this.activeSelection.text) {
      this.applyHighlight(colorKey || this.selectedColorKey);
    } else {
      window.app.showToast('Selecione primeiro um trecho de texto no PDF com o mouse!', 'info');
    }
  }

  async applyHighlight(colorKey) {
    if (!this.activeSelection || !window.readerManager.currentBook) return;

    this.selectedColorKey = colorKey;
    localStorage.setItem('last_highlight_color', colorKey);

    const highlightColor = this.colors[colorKey] || this.colors.yellow;
    const highlight = {
      id: 'hl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      bookId: window.readerManager.currentBook.id,
      pageNum: this.activeSelection.pageNum,
      text: this.activeSelection.text,
      color: highlightColor,
      rects: this.activeSelection.rects,
      createdAt: Date.now()
    };

    await window.dbManager.saveHighlight(highlight);
    this.renderHighlightOnPage(highlight, this.activeSelection.pageWrapper);
    
    // Clear native browser selection & hide popup
    window.getSelection().removeAllRanges();
    this.hidePopup();

    if (window.readerSidebarManager) {
      window.readerSidebarManager.renderHighlightsList();
    }
  }

  renderHighlightOnPage(highlight, pageWrapper) {
    let overlay = pageWrapper.querySelector('.highlights-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'highlights-overlay';
      pageWrapper.appendChild(overlay);
    }

    // Remove existing group if re-rendering
    const existingGroup = overlay.querySelector(`[data-highlight-id="${highlight.id}"]`);
    if (existingGroup) existingGroup.remove();

    // Create single parent group div with opacity & mix-blend-mode to flatten overlapping child rects
    const groupEl = document.createElement('div');
    groupEl.className = 'highlight-group';
    groupEl.dataset.highlightId = highlight.id;
    groupEl.style.position = 'absolute';
    groupEl.style.top = '0';
    groupEl.style.left = '0';
    groupEl.style.width = '100%';
    groupEl.style.height = '100%';
    groupEl.style.pointerEvents = 'none';
    groupEl.style.opacity = `${this.highlightOpacity || 0.48}`;
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    groupEl.style.mixBlendMode = currentTheme === 'dark' ? 'screen' : 'multiply';
    groupEl.style.zIndex = '10';

    highlight.rects.forEach(r => {
      const rectEl = document.createElement('div');
      rectEl.className = 'highlight-rect';
      rectEl.style.position = 'absolute';
      rectEl.style.left = `${r.left * 100}%`;
      rectEl.style.top = `${r.top * 100}%`;
      rectEl.style.width = `${r.width * 100}%`;
      rectEl.style.height = `${r.height * 100}%`;
      rectEl.style.backgroundColor = highlight.color;
      rectEl.style.pointerEvents = 'auto';
      rectEl.style.cursor = 'pointer';
      rectEl.title = `Marcador: "${highlight.text}" (Clique para remover)`;

      // Delete highlight on click option
      rectEl.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Deseja remover este marcador pastel?`)) {
          await window.dbManager.deleteHighlight(highlight.id);
          groupEl.remove();
          if (window.readerSidebarManager) {
            window.readerSidebarManager.renderHighlightsList();
          }
        }
      });

      groupEl.appendChild(rectEl);
    });

    overlay.appendChild(groupEl);
  }

  async loadHighlightsForPage(bookId, pageNum, pageWrapper) {
    const highlights = await window.dbManager.getHighlightsForBook(bookId);
    const pageHighlights = highlights.filter(h => h.pageNum === pageNum);

    pageHighlights.forEach(h => {
      this.renderHighlightOnPage(h, pageWrapper);
    });
  }

  async removeHighlightForSelection() {
    if (!this.activeSelection || !window.readerManager.currentBook) return;

    const bookId = window.readerManager.currentBook.id;
    const pageNum = this.activeSelection.pageNum;
    const pageWrapper = this.activeSelection.pageWrapper;

    const highlights = await window.dbManager.getHighlightsForBook(bookId);
    const pageHighlights = highlights.filter(h => h.pageNum === pageNum);

    let removedCount = 0;
    for (const h of pageHighlights) {
      const isOverlapping = h.rects.some(hr => {
        return this.activeSelection.rects.some(sr => {
          return !(sr.left > hr.left + hr.width || 
                   sr.left + sr.width < hr.left || 
                   sr.top > hr.top + hr.height || 
                   sr.top + sr.height < hr.top);
        });
      });

      if (isOverlapping || (this.activeSelection.text && h.text.includes(this.activeSelection.text))) {
        await window.dbManager.deleteHighlight(h.id);
        const overlay = pageWrapper.querySelector('.highlights-overlay');
        if (overlay) {
          const els = overlay.querySelectorAll(`[data-highlight-id="${h.id}"]`);
          els.forEach(el => el.remove());
        }
        removedCount++;
      }
    }

    window.getSelection().removeAllRanges();
    this.hidePopup();

    if (window.readerSidebarManager) {
      window.readerSidebarManager.renderHighlightsList();
    }

    if (removedCount > 0) {
      window.app.showToast('Marcação removida com sucesso!');
    } else {
      window.app.showToast('Nenhuma marcação encontrada no texto selecionado.', 'info');
    }
  }

  hidePopup() {
    if (this.popup) {
      this.popup.classList.add('hidden');
    }
  }
}

window.textSelectionManager = new TextSelectionManager();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.textSelectionManager.init());
} else {
  window.textSelectionManager.init();
}
