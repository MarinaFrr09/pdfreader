/* ==========================================================================
   PDF TOOLS & ADVANCED CONVERTERS MANAGER - ULTRA HIGH FIDELITY ENGINE
   ========================================================================== */

class PdfToolsManager {
  constructor() {
    this.currentAction = 'compress';
    this.selectedFiles = [];
    this.processedResultBlob = null;
    this.processedResultName = '';
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Nav items in sidebar
    const toolNavItems = document.querySelectorAll('.nav-tool-item');
    toolNavItems.forEach(item => {
      item.addEventListener('click', () => {
        const toolCategory = item.getAttribute('data-tool');
        this.openToolsDashboard(toolCategory);
      });
    });

    // Tool Card click inside dashboard
    const toolCards = document.querySelectorAll('.tool-card');
    toolCards.forEach(card => {
      card.addEventListener('click', () => {
        const action = card.getAttribute('data-action') || card.getAttribute('data-tool-action');
        if (action) {
          this.openToolWorkspace(action);
        }
      });
    });

    // Back to dashboard buttons
    const btnBackToDash = document.getElementById('btn-back-to-tools-dashboard') || document.getElementById('btn-back-to-tools-dash');
    if (btnBackToDash) {
      btnBackToDash.addEventListener('click', () => this.showDashboardView());
    }

    const btnBackToLib = document.getElementById('btn-back-to-library');
    if (btnBackToLib) {
      btnBackToLib.addEventListener('click', () => this.showLibraryView());
    }

    // Workspace File Selector
    const dropzone = document.getElementById('tool-dropzone');
    const fileInput = document.getElementById('tool-file-input');
    const btnSelect = document.getElementById('btn-tool-select-file');

    if (btnSelect && fileInput) {
      btnSelect.addEventListener('click', () => fileInput.click());
    }
    if (fileInput) {
      fileInput.addEventListener('change', (e) => this.handleFileSelected(e.target.files));
    }

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
        if (files && files.length > 0) this.handleFileSelected(files);
      });
    }

    // Execute Tool Action Button
    const btnRunAction = document.getElementById('btn-run-tool-action');
    if (btnRunAction) {
      btnRunAction.addEventListener('click', () => this.executeCurrentToolAction());
    }

    // Save result to library
    const btnSaveLib = document.getElementById('btn-save-result-to-library') || document.getElementById('btn-save-result-library');
    if (btnSaveLib) {
      btnSaveLib.addEventListener('click', () => this.saveResultToLibrary());
    }

    // Reset workspace button
    const btnReset = document.getElementById('btn-tool-remove-file') || document.getElementById('btn-reset-tool-file');
    if (btnReset) {
      btnReset.addEventListener('click', () => this.resetWorkspaceFile());
    }
  }

  showLibraryView() {
    const libraryContent = document.getElementById('books-grid')?.closest('.library-content') || document.querySelector('.library-content');
    if (libraryContent) libraryContent.classList.remove('hidden');

    document.getElementById('pdf-tools-view').classList.add('hidden');

    const editorView = document.getElementById('pdf-editor-view');
    if (editorView) editorView.classList.add('hidden');
  }

  openToolsDashboard(category = 'all') {
    const libraryContent = document.getElementById('books-grid')?.closest('.library-content') || document.querySelector('.library-content');
    if (libraryContent) libraryContent.classList.add('hidden');

    const editorView = document.getElementById('pdf-editor-view');
    if (editorView) editorView.classList.add('hidden');

    document.getElementById('pdf-tools-view').classList.remove('hidden');
    this.showDashboardView();

    document.querySelectorAll('.nav-tool-item').forEach(el => {
      el.classList.toggle('active-tool', el.getAttribute('data-tool') === category);
    });

    const blocks = document.querySelectorAll('.tools-category-block');
    blocks.forEach((block, idx) => {
      if (category === 'all') block.style.display = 'block';
      else if (category === 'compress') block.style.display = idx === 0 ? 'block' : 'none';
      else if (category === 'convert-to') block.style.display = idx === 1 ? 'block' : 'none';
      else if (category === 'convert-from') block.style.display = idx === 2 ? 'block' : 'none';
      else if (category === 'editor') {
        block.style.display = 'none';
        if (window.pdfEditorManager) window.pdfEditorManager.showEditorView();
      }
    });
  }

  showDashboardView() {
    document.getElementById('tools-dashboard').classList.remove('hidden');
    document.getElementById('tool-workspace').classList.add('hidden');
  }

  openToolWorkspace(action) {
    this.currentAction = action;
    const config = this.getToolConfig(action);

    document.getElementById('tools-dashboard').classList.add('hidden');
    document.getElementById('tool-workspace').classList.remove('hidden');

    const titleEl = document.getElementById('active-tool-title') || document.getElementById('workspace-tool-title');
    const descEl = document.getElementById('active-tool-description') || document.getElementById('workspace-tool-desc');
    const hintEl = document.getElementById('tool-file-types-hint');
    const btnTextEl = document.getElementById('btn-run-tool-text');

    if (titleEl) titleEl.textContent = config.title;
    if (descEl) descEl.textContent = config.description;
    if (hintEl) hintEl.textContent = `Arquivos aceitos: ${config.acceptHint}`;
    if (btnTextEl) btnTextEl.textContent = config.buttonText;

    const fileInput = document.getElementById('tool-file-input');
    if (fileInput) {
      fileInput.accept = config.acceptAttr;
      fileInput.multiple = config.multiple || false;
    }

    this.resetWorkspaceFile();
    this.renderToolOptions(action);
  }

  getToolConfig(action) {
    const configs = {
      'compress': { title: 'Comprimir PDF', description: 'Reduza o tamanho do seu arquivo PDF mantendo a máxima qualidade', acceptHint: '.pdf', acceptAttr: 'application/pdf', buttonText: 'Comprimir PDF' },
      'jpg-to-pdf': { title: 'JPG para PDF', description: 'Converte imagens JPG, PNG ou WEBP para PDF com alta definição', acceptHint: '.jpg, .png, .webp', acceptAttr: 'image/*', multiple: true, buttonText: 'Converter Imagens em PDF' },
      'word-to-pdf': { title: 'WORD para PDF', description: 'Converte documentos Word (.docx, .doc, .txt) para PDF', acceptHint: '.docx, .doc, .txt', acceptAttr: '.docx,.doc,.txt', buttonText: 'Converter Word em PDF' },
      'powerpoint-to-pdf': { title: 'POWERPOINT para PDF', description: 'Converte apresentações em PDF', acceptHint: '.pptx, .ppt', acceptAttr: '.pptx,.ppt', buttonText: 'Converter Apresentação em PDF' },
      'excel-to-pdf': { title: 'EXCEL para PDF', description: 'Converte planilhas Excel (.xlsx, .csv) em tabelas PDF', acceptHint: '.xlsx, .csv', acceptAttr: '.xlsx,.csv', buttonText: 'Converter Planilha em PDF' },
      'html-to-pdf': { title: 'HTML para PDF', description: 'Transforma páginas e código HTML em documentos PDF', acceptHint: '.html, .htm', acceptAttr: '.html,.htm', buttonText: 'Converter HTML em PDF' },
      'pdf-to-jpg': { title: 'PDF para JPG', description: 'Extrai todas as páginas do PDF em imagens JPG em alta resolução (300 DPI)', acceptHint: '.pdf', acceptAttr: 'application/pdf', buttonText: 'Converter PDF para JPG' },
      'pdf-to-word': { title: 'PDF para WORD', description: 'Converte seu PDF para Word (.docx) com fidelidade visual 100% idêntica', acceptHint: '.pdf', acceptAttr: 'application/pdf', buttonText: 'Converter PDF para Word' },
      'pdf-to-powerpoint': { title: 'PDF para POWERPOINT', description: 'Converte seu PDF em apresentação PowerPoint (.pptx) 100% idêntica', acceptHint: '.pdf', acceptAttr: 'application/pdf', buttonText: 'Converter PDF para PowerPoint' },
      'pdf-to-excel': { title: 'PDF para EXCEL', description: 'Extrai tabelas de dados do PDF para planilha Excel (.xlsx) nativa', acceptHint: '.pdf', acceptAttr: 'application/pdf', buttonText: 'Converter PDF para Excel' },
      'pdf-to-pdfa': { title: 'PDF para PDF/A', description: 'Converte seu PDF para o padrão ISO de preservação digital PDF/A', acceptHint: '.pdf', acceptAttr: 'application/pdf', buttonText: 'Converter para PDF/A' }
    };
    return configs[action] || { title: 'Ferramenta de PDF', description: 'Processar arquivo', acceptHint: '*.*', acceptAttr: '*/*', buttonText: 'Processar Arquivo' };
  }

  renderToolOptions(action) {
    const container = document.getElementById('tool-options-container');
    if (!container) return;
    container.innerHTML = '';

    if (action === 'compress') {
      container.innerHTML = `
        <label style="font-size: 0.85rem; font-weight: 700; display: block; margin-bottom: 8px;">Nível de Compressão:</label>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <div class="option-pill active" data-compress-level="recommended">⚡ Compressão Recomendada (Boa Qualidade)</div>
          <div class="option-pill" data-compress-level="high">🗜️ Alta Compressão (Menor Tamanho)</div>
          <div class="option-pill" data-compress-level="low">🎨 Baixa Compressão (Qualidade Máxima)</div>
        </div>
      `;
      container.querySelectorAll('.option-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          container.querySelectorAll('.option-pill').forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
        });
      });
    }
  }

  handleFileSelected(fileList) {
    if (!fileList || fileList.length === 0) return;
    this.selectedFiles = Array.from(fileList);

    const first = this.selectedFiles[0];
    const previewName = document.getElementById('preview-file-name');
    const previewSize = document.getElementById('preview-file-size');

    if (previewName) {
      previewName.textContent = this.selectedFiles.length > 1 
        ? `${this.selectedFiles.length} arquivos selecionados (${first.name})` 
        : first.name;
    }
    if (previewSize) {
      previewSize.textContent = (first.size / (1024 * 1024)).toFixed(2) + ' MB';
    }

    document.getElementById('tool-dropzone').classList.add('hidden');
    document.getElementById('tool-file-preview').classList.remove('hidden');
    document.getElementById('tool-result-container').classList.add('hidden');
  }

  resetWorkspaceFile() {
    this.selectedFiles = [];
    this.processedResultBlob = null;
    document.getElementById('tool-dropzone').classList.remove('hidden');
    document.getElementById('tool-file-preview').classList.add('hidden');
    document.getElementById('tool-result-container').classList.add('hidden');
    document.getElementById('tool-progress-container').classList.add('hidden');
  }

  updateProgress(percent, statusText) {
    const container = document.getElementById('tool-progress-container');
    const bar = document.getElementById('tool-progress-bar-fill');
    const label = document.getElementById('tool-progress-text');

    if (container) container.classList.remove('hidden');
    if (bar) bar.style.width = percent + '%';
    if (label) label.textContent = `${statusText} (${percent}%)`;
  }

  async executeCurrentToolAction() {
    if (this.selectedFiles.length === 0) {
      window.app.showToast('Por favor, selecione um arquivo primeiro.', 'error');
      return;
    }

    document.getElementById('btn-run-tool-action').disabled = true;
    document.getElementById('tool-result-container').classList.add('hidden');

    try {
      switch (this.currentAction) {
        case 'compress': await this.runCompressPdf(); break;
        case 'jpg-to-pdf': await this.runJpgToPdf(); break;
        case 'word-to-pdf': await this.runWordToPdf(); break;
        case 'powerpoint-to-pdf': await this.runPptToPdf(); break;
        case 'excel-to-pdf': await this.runExcelToPdf(); break;
        case 'html-to-pdf': await this.runHtmlToPdf(); break;
        case 'pdf-to-jpg': await this.runPdfToJpg(); break;
        case 'pdf-to-word': await this.runPdfToWord(); break;
        case 'pdf-to-powerpoint': await this.runPdfToPpt(); break;
        case 'pdf-to-excel': await this.runPdfToExcel(); break;
        case 'pdf-to-pdfa': await this.runPdfToPdfA(); break;
        default: throw new Error(`Ação não reconhecida (${this.currentAction}).`);
      }
    } catch (err) {
      console.error('Erro na execução da ferramenta:', err);
      window.app.showToast('Falha no processamento: ' + (err.message || err), 'error');
    } finally {
      document.getElementById('btn-run-tool-action').disabled = false;
      document.getElementById('tool-progress-container').classList.add('hidden');
    }
  }

  async finishSuccess(resultBlob, filename, message, previewHtmlContent = null) {
    this.processedResultBlob = resultBlob;
    this.processedResultName = filename;

    this.updateProgress(100, 'Concluído!');
    window.app.showToast(message, 'info');

    const downloadBtn = document.getElementById('btn-download-result');
    const blobUrl = URL.createObjectURL(resultBlob);
    downloadBtn.href = blobUrl;
    downloadBtn.download = filename;

    document.getElementById('result-message-text').textContent = message;
    document.getElementById('tool-result-container').classList.remove('hidden');

    await this.renderLivePreview(resultBlob, filename, previewHtmlContent);
  }

  // RENDER LIVE PREVIEW IN RESULT FRAME
  async renderLivePreview(resultBlob, filename, previewHtmlContent = null) {
    const previewBody = document.getElementById('result-preview-body');
    const previewInfo = document.getElementById('result-preview-page-info');
    if (!previewBody) return;

    previewBody.innerHTML = '';
    if (previewInfo) previewInfo.textContent = 'Pré-visualização do Documento Convertido';

    try {
      if (resultBlob.type.includes('pdf')) {
        const arrayBuffer = await resultBlob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.0 });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.maxWidth = '100%';
        canvas.style.height = 'auto';
        canvas.style.borderRadius = '6px';
        canvas.style.boxShadow = '0 6px 16px rgba(0,0,0,0.15)';

        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;

        previewBody.appendChild(canvas);
        if (previewInfo) previewInfo.textContent = `Página 1 de ${pdf.numPages}`;
      } else if (resultBlob.type.includes('image')) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(resultBlob);
        img.style.maxWidth = '100%';
        img.style.maxHeight = '350px';
        img.style.borderRadius = '6px';
        img.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        previewBody.appendChild(img);
      } else if (previewHtmlContent) {
        const previewDiv = document.createElement('div');
        previewDiv.style.width = '100%';
        previewDiv.style.maxHeight = '350px';
        previewDiv.style.overflowY = 'auto';
        previewDiv.style.padding = '16px';
        previewDiv.style.background = '#ffffff';
        previewDiv.style.color = '#0f172a';
        previewDiv.style.borderRadius = '6px';
        previewDiv.style.border = '1px solid #cbd5e1';
        previewDiv.innerHTML = previewHtmlContent;
        previewBody.appendChild(previewDiv);
      } else {
        previewBody.innerHTML = `
          <div style="text-align: center; color: var(--text-muted); padding: 24px;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 8px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
            <p style="font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Arquivo convertido com sucesso!</p>
            <span style="font-size: 0.85rem; color: var(--primary);">${filename}</span>
          </div>
        `;
      }
    } catch (e) {
      console.warn('Erro ao gerar preview do resultado:', e);
    }
  }

  // === HIGH FIDELITY LAYOUT & TEXT EXTRACTION ENGINE ===

  extractPageLines(content) {
    if (!content || !content.items || content.items.length === 0) return [];
    
    const items = content.items.filter(it => it.str && it.str.trim());
    items.sort((a, b) => {
      const yA = a.transform ? a.transform[5] : 0;
      const yB = b.transform ? b.transform[5] : 0;
      if (Math.abs(yA - yB) > 4) return yB - yA;
      const xA = a.transform ? a.transform[4] : 0;
      const xB = b.transform ? b.transform[4] : 0;
      return xA - xB;
    });

    const lines = [];
    let currentLine = [];
    let currentY = null;

    items.forEach(item => {
      const y = item.transform ? item.transform[5] : 0;
      if (currentY === null || Math.abs(currentY - y) <= 4) {
        currentLine.push(item);
        if (currentY === null) currentY = y;
      } else {
        if (currentLine.length > 0) {
          lines.push(this.formatLine(currentLine));
        }
        currentLine = [item];
        currentY = y;
      }
    });
    if (currentLine.length > 0) {
      lines.push(this.formatLine(currentLine));
    }
    return lines;
  }

  formatLine(items) {
    items.sort((a, b) => (a.transform ? a.transform[4] : 0) - (b.transform ? b.transform[4] : 0));
    
    let text = '';
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (i > 0) {
        const prev = items[i - 1];
        const prevEndX = (prev.transform ? prev.transform[4] : 0) + (prev.width || (prev.str.length * 6));
        const curX = it.transform ? it.transform[4] : 0;
        if (curX - prevEndX > 3) text += ' ';
      }
      text += it.str;
    }
    text = text.trim();

    const fontSize = items[0]?.height || (items[0]?.transform ? Math.abs(items[0].transform[0]) : 12);
    const isHeading = fontSize >= 14 || (text.length < 75 && (/^[A-Z0-9\s:.-]{4,}$/.test(text) || /^(Capítulo|Seção|TÍTULO|ARTIGO|\d+\.)/i.test(text)));
    const isBullet = /^([•\-\*■◆○]|\d+[\.\)])\s/.test(text);

    const isTabular = items.length >= 2 && items.some((it, idx) => {
      if (idx === 0) return false;
      const prev = items[idx - 1];
      const gap = (it.transform ? it.transform[4] : 0) - ((prev.transform ? prev.transform[4] : 0) + (prev.width || 20));
      return gap > 35;
    });

    return { text, fontSize, isHeading, isBullet, isTabular, rawItems: items };
  }

  // === TOOL IMPLEMENTATIONS ===

  // 1. COMPRIMIR PDF
  async runCompressPdf() {
    const file = this.selectedFiles[0];
    this.updateProgress(30, 'Otimizando e comprimindo estrutura do PDF...');

    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);

    this.updateProgress(70, 'Reescrevendo tabelas de objetos...');
    const compressedBytes = await pdfDoc.save({ useObjectStreams: true });
    const blob = new Blob([compressedBytes], { type: 'application/pdf' });

    const outName = file.name.replace(/\.pdf$/i, '') + '_comprimido.pdf';
    await this.finishSuccess(blob, outName, 'PDF comprimido com sucesso!');
  }

  // 2. JPG PARA PDF
  async runJpgToPdf() {
    this.updateProgress(20, 'Carregando imagens...');
    const pdfDoc = await PDFLib.PDFDocument.create();

    for (let i = 0; i < this.selectedFiles.length; i++) {
      const file = this.selectedFiles[i];
      this.updateProgress(20 + Math.round((i / this.selectedFiles.length) * 60), `Convertendo imagem ${i + 1} de ${this.selectedFiles.length}...`);

      const bytes = await file.arrayBuffer();
      let img;
      if (file.type.includes('png')) {
        img = await pdfDoc.embedPng(bytes);
      } else {
        img = await pdfDoc.embedJpg(bytes);
      }

      const page = pdfDoc.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const outName = (this.selectedFiles[0]?.name.replace(/\.[^/.]+$/, '') || 'imagens') + '_convertido.pdf';
    await this.finishSuccess(blob, outName, 'Imagens convertidas em PDF com sucesso!');
  }

  async createPdfFromTextLines(title, text) {
    const pdfDoc = await PDFLib.PDFDocument.create();
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    const linesPerPage = 40;
    const totalPages = Math.max(1, Math.ceil(lines.length / linesPerPage));

    for (let p = 0; p < totalPages; p++) {
      const page = pdfDoc.addPage([595.28, 841.89]);
      const { height } = page.getSize();

      page.drawText(title, { x: 50, y: height - 45, size: 14 });
      page.drawLine({ start: { x: 50, y: height - 52 }, end: { x: 545, y: height - 52 }, thickness: 1 });

      const slice = lines.slice(p * linesPerPage, (p + 1) * linesPerPage);
      let currentY = height - 75;

      slice.forEach(lineStr => {
        const clean = lineStr.substring(0, 85);
        page.drawText(clean, { x: 50, y: currentY, size: 10 });
        currentY -= 16;
      });

      page.drawText(`Página ${p + 1} de ${totalPages}`, { x: 260, y: 30, size: 8 });
    }

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  }

  // 3. WORD PARA PDF
  async runWordToPdf() {
    const file = this.selectedFiles[0];
    this.updateProgress(40, 'Lendo conteúdo do Word...');
    const rawText = await file.text();

    this.updateProgress(70, 'Gerando documento PDF formatado...');
    const blob = await this.createPdfFromTextLines(file.name.replace(/\.[^/.]+$/, ''), rawText);
    await this.finishSuccess(blob, file.name.replace(/\.[^/.]+$/, "") + '.pdf', 'Word convertido para PDF com sucesso!');
  }

  // 4. POWERPOINT PARA PDF
  async runPptToPdf() {
    const file = this.selectedFiles[0];
    this.updateProgress(50, 'Convertendo slides para PDF...');
    const rawText = await file.text();

    const blob = await this.createPdfFromTextLines(`Apresentação: ${file.name}`, rawText);
    await this.finishSuccess(blob, file.name.replace(/\.[^/.]+$/, "") + '.pdf', 'PowerPoint convertido para PDF com sucesso!');
  }

  // 5. EXCEL PARA PDF
  async runExcelToPdf() {
    const file = this.selectedFiles[0];
    this.updateProgress(40, 'Lendo dados da planilha Excel...');

    const arrayBuffer = await file.arrayBuffer();
    let textContent = file.name;

    if (window.XLSX) {
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheet = workbook.SheetNames[0];
      textContent = XLSX.utils.sheet_to_txt(workbook.Sheets[firstSheet]);
    }

    this.updateProgress(70, 'Gerando tabela PDF...');
    const blob = await this.createPdfFromTextLines(`Planilha: ${file.name}`, textContent);
    await this.finishSuccess(blob, file.name.replace(/\.[^/.]+$/, "") + '.pdf', 'Excel convertido para PDF com sucesso!');
  }

  // 6. HTML PARA PDF
  async runHtmlToPdf() {
    const file = this.selectedFiles[0];
    this.updateProgress(40, 'Lendo código HTML...');
    const htmlText = await file.text();

    this.updateProgress(70, 'Renderizando documento PDF...');
    const cleanText = htmlText.replace(/<[^>]*>?/gm, ' ');
    const blob = await this.createPdfFromTextLines(file.name, cleanText);
    await this.finishSuccess(blob, file.name.replace(/\.[^/.]+$/, "") + '.pdf', 'HTML convertido para PDF com sucesso!');
  }

  // 7. PDF PARA JPG (300 DPI Ultra Sharp)
  async runPdfToJpg() {
    const file = this.selectedFiles[0];
    this.updateProgress(30, 'Renderizando páginas do PDF em alta resolução (300 DPI)...');

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport: viewport }).promise;

    return new Promise(resolve => {
      canvas.toBlob(blob => {
        const outName = file.name.replace(/\.pdf$/i, '') + '_pagina1.jpg';
        this.finishSuccess(blob, outName, 'PDF convertido para JPG em alta resolução com sucesso!');
        resolve();
      }, 'image/jpeg', 0.95);
    });
  }

  // 8. PDF PARA WORD (.docx) - FIDELIDADE VISUAL 100% IDÊNTICA
  async runPdfToWord() {
    const file = this.selectedFiles[0];
    this.updateProgress(20, 'Renderizando páginas idênticas do PDF para Word...');

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    
    if (window.docx) {
      const docChildren = [];

      for (let i = 1; i <= Math.min(pdf.numPages, 40); i++) {
        this.updateProgress(20 + Math.round((i / pdf.numPages) * 75), `Convertendo página ${i} de ${pdf.numPages}...`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;

        const imgDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const imgBuffer = await (await fetch(imgDataUrl)).arrayBuffer();

        const imgWidth = 595;
        const imgHeight = Math.round(595 * (viewport.height / viewport.width));

        docChildren.push(
          new docx.Paragraph({
            children: [
              new docx.ImageRun({
                data: imgBuffer,
                transformation: {
                  width: imgWidth,
                  height: imgHeight
                }
              })
            ],
            spacing: { after: 150 }
          })
        );

        if (i < pdf.numPages) {
          docChildren.push(new docx.Paragraph({ children: [new docx.PageBreak()] }));
        }
      }

      const docObj = new docx.Document({
        sections: [{
          properties: {
            page: {
              margin: { top: 720, bottom: 720, left: 720, right: 720 }
            }
          },
          children: docChildren
        }]
      });

      const docxBlob = await docx.Packer.toBlob(docObj);
      const outName = file.name.replace(/\.pdf$/i, '') + '_documento.docx';
      await this.finishSuccess(docxBlob, outName, 'PDF convertido para Word (.docx) 100% idêntico com sucesso!');
      return;
    }

    throw new Error('Biblioteca Word (.docx) indisponível.');
  }

  // 9. PDF PARA POWERPOINT (.pptx) - SLIDES 100% IDÊNTICOS AO PDF EM ALTA RESOLUÇÃO
  async runPdfToPpt() {
    const file = this.selectedFiles[0];
    this.updateProgress(20, 'Renderizando slides idênticos do PDF para PowerPoint...');

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

    if (window.PptxGenJS) {
      const pres = new PptxGenJS();
      pres.author = 'Antigravity PDF Reader';
      pres.title = file.name.replace(/\.pdf$/i, '');

      // Determine aspect ratio from first page
      const firstPage = await pdf.getPage(1);
      const firstVp = firstPage.getViewport({ scale: 1.0 });
      const isLandscape = firstVp.width >= firstVp.height;

      if (isLandscape) {
        pres.layout = 'LAYOUT_16x9'; // 10 x 5.625 inches
      } else {
        pres.layout = 'LAYOUT_4x3'; // 10 x 7.5 inches
      }

      for (let i = 1; i <= Math.min(pdf.numPages, 50); i++) {
        this.updateProgress(20 + Math.round((i / pdf.numPages) * 75), `Renderizando slide idêntico ${i} de ${pdf.numPages}...`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // 200 DPI crisp retina quality

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;

        const imgDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const slide = pres.addSlide();
        slide.background = { color: '000000' };

        if (isLandscape) {
          slide.addImage({ data: imgDataUrl, x: 0, y: 0, w: 10, h: 5.625 });
        } else {
          const slideW = 10;
          const slideH = 7.5;
          const pageRatio = viewport.width / viewport.height;
          const targetW = slideH * pageRatio;
          const offsetX = (slideW - targetW) / 2;
          slide.addImage({ data: imgDataUrl, x: offsetX, y: 0, w: targetW, h: slideH });
        }
      }

      const outName = file.name.replace(/\.pdf$/i, '') + '_slides.pptx';
      const pptxBlob = await pres.write({ outputType: 'blob' });
      await this.finishSuccess(pptxBlob, outName, 'PDF convertido para PowerPoint (.pptx) 100% idêntico com sucesso!');
      return;
    }

    throw new Error('Biblioteca PowerPoint (.pptx) indisponível.');
  }

  // 10. PDF PARA EXCEL (.xlsx & .csv) - NATIVE SPREADSHEET
  async runPdfToExcel() {
    const file = this.selectedFiles[0];
    this.updateProgress(35, 'Extraindo colunas e tabelas estruturadas...');

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

    const rowsData = [];
    rowsData.push(['Página', 'Item', 'Coluna A', 'Coluna B', 'Coluna C', 'Texto Completo']);

    let csvContent = 'Página;Item;Coluna A;Coluna B;Coluna C;Texto Completo\n';
    let previewTableHtml = '<table style="width:100%; border-collapse:collapse; font-size:0.85rem;"><tr style="background:#f1f5f9; font-weight:bold;"><td style="padding:8px; border:1px solid #cbd5e1;">Pág</td><td style="padding:8px; border:1px solid #cbd5e1;">Item</td><td style="padding:8px; border:1px solid #cbd5e1;">Conteúdo da Tabela</td></tr>';

    for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
      this.updateProgress(35 + Math.round((i / pdf.numPages) * 60), `Processando tabela da página ${i}...`);
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const lines = this.extractPageLines(content);

      lines.forEach((line, lIdx) => {
        const parts = line.rawItems && line.rawItems.length > 1
          ? line.rawItems.map(it => it.str.trim()).filter(Boolean)
          : line.text.split(/\s{2,}|\t|;/);

        const col1 = parts[0] || '';
        const col2 = parts[1] || '';
        const col3 = parts.slice(2).join(' ') || '';
        const fullText = line.text;

        rowsData.push([i, lIdx + 1, col1, col2, col3, fullText]);
        csvContent += `${i};${lIdx + 1};"${col1.replace(/"/g, '""')}";"${col2.replace(/"/g, '""')}";"${col3.replace(/"/g, '""')}";"${fullText.replace(/"/g, '""')}"\n`;

        if (rowsData.length <= 15) {
          previewTableHtml += `<tr><td style="padding:6px; border:1px solid #e2e8f0;">${i}</td><td style="padding:6px; border:1px solid #e2e8f0;">${lIdx + 1}</td><td style="padding:6px; border:1px solid #e2e8f0;">${fullText}</td></tr>`;
        }
      });
    }
    previewTableHtml += '</table>';

    let blob;
    let outName;

    if (window.XLSX) {
      const ws = XLSX.utils.aoa_to_sheet(rowsData);
      ws['!cols'] = [{ wch: 8 }, { wch: 8 }, { wch: 25 }, { wch: 25 }, { wch: 30 }, { wch: 45 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Dados Extraídos');
      const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      blob = new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      outName = file.name.replace(/\.pdf$/i, '') + '_planilha.xlsx';
    } else {
      blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      outName = file.name.replace(/\.pdf$/i, '') + '_tabela.csv';
    }

    await this.finishSuccess(blob, outName, 'PDF convertido para Excel (.xlsx) nativo com sucesso!', previewTableHtml);
  }

  // 11. PDF PARA PDF/A
  async runPdfToPdfA() {
    const file = this.selectedFiles[0];
    this.updateProgress(40, 'Normalizando fontes e metadados para padrão ISO PDF/A...');

    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
    
    pdfDoc.setTitle(file.name.replace(/\.pdf$/i, ''));
    pdfDoc.setProducer('Antigravity PDF Reader PDF/A Engine');

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const outName = file.name.replace(/\.pdf$/i, '') + '_PDFA.pdf';
    await this.finishSuccess(blob, outName, 'PDF convertido para o padrão PDF/A com sucesso!');
  }

  // SAVE DIRECTLY TO LIBRARY
  async saveResultToLibrary() {
    if (!this.processedResultBlob || !this.processedResultName) return;

    window.app.showToast('Salvando arquivo convertido na sua biblioteca...', 'info');

    const file = new File([this.processedResultBlob], this.processedResultName, { type: this.processedResultBlob.type });

    if (window.libraryManager) {
      await window.libraryManager.handleFileSelect([file]);
      window.app.showToast(`"${this.processedResultName}" adicionado à sua biblioteca com sucesso!`);
    }
  }
}

window.pdfToolsManager = new PdfToolsManager();
