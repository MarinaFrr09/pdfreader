/* ==========================================================================
   MAIN APPLICATION CONTROLLER
   ========================================================================== */

class App {
  constructor() {
    this.theme = localStorage.getItem('pdf_reader_theme') || 'light';
  }

  async init() {
    this.applyTheme(this.theme);
    this.setupThemeToggle();
    this.setupGlobalShortcuts();
    this.setupAuthListeners();
    this.setupMobileMenu();

    // Configure PDF.js Worker path
    if (window.pdfjsLib) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = './lib/pdf.worker.min.js';
    }

    if (window.dbManager) {
      await window.dbManager.init();
    }

    // Initialize modules
    await window.libraryManager.init();
    window.readerManager.init();
    window.textSelectionManager.init();
    if (window.pdfToolsManager) window.pdfToolsManager.init();
    if (window.pdfEditorManager) window.pdfEditorManager.init();

    console.log('PDF Book Reader application initialized successfully.');
  }

  setupMobileMenu() {
    const btnMobileMenu = document.getElementById('btn-mobile-menu-toggle');
    const librarySidebar = document.querySelector('.library-sidebar');
    const backdrop = document.getElementById('mobile-sidebar-backdrop');

    if (btnMobileMenu && librarySidebar && backdrop) {
      btnMobileMenu.addEventListener('click', () => {
        const isOpen = librarySidebar.classList.contains('mobile-open');
        librarySidebar.classList.toggle('mobile-open', !isOpen);
        backdrop.classList.toggle('hidden', isOpen);
      });

      backdrop.addEventListener('click', () => {
        librarySidebar.classList.remove('mobile-open');
        backdrop.classList.add('hidden');
      });
    }
  }

  setupAuthListeners() {
    const btnGoogle = document.getElementById('btn-google-login');
    const btnLogout = document.getElementById('btn-logout');

    if (btnGoogle) {
      btnGoogle.addEventListener('click', async () => {
        if (window.dbManager) {
          this.showToast('Redirecionando para o login do Google...', 'info');
          await window.dbManager.signInWithGoogle();
        }
      });
    }

    if (btnLogout) {
      btnLogout.addEventListener('click', async () => {
        if (window.dbManager) {
          await window.dbManager.signOut();
          this.showToast('Você saiu da conta.');
        }
      });
    }
  }

  onAuthChange(user) {
    const btnGoogle = document.getElementById('btn-google-login');
    const userBadge = document.getElementById('user-profile-badge');

    if (user) {
      if (btnGoogle) btnGoogle.classList.add('hidden');
      if (userBadge) {
        userBadge.classList.remove('hidden');
        
        const avatarImg = document.getElementById('user-avatar');
        const userName = document.getElementById('user-name');
        const userEmail = document.getElementById('user-email');

        const metadata = user.user_metadata || {};
        if (avatarImg) avatarImg.src = metadata.avatar_url || metadata.picture || 'https://via.placeholder.com/32';
        if (userName) userName.textContent = metadata.full_name || metadata.name || user.email.split('@')[0];
        if (userEmail) userEmail.textContent = user.email || '';
      }
    } else {
      if (btnGoogle) btnGoogle.classList.remove('hidden');
      if (userBadge) userBadge.classList.add('hidden');
    }

    if (window.libraryManager) {
      window.libraryManager.loadBooks().then(() => window.libraryManager.render());
      window.libraryManager.loadFolders().then(() => window.libraryManager.renderFolders());
    }
  }

  setupGlobalShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, [contenteditable="true"]')) return;

      const keyUpper = e.key.toUpperCase();

      // Global Theme Toggle: 'T' or 'E'
      if (keyUpper === 'T' || keyUpper === 'E') {
        e.preventDefault();
        this.toggleTheme();
      }

      // Ver / Alternar Grifos in Reader: 'G'
      if (keyUpper === 'G') {
        const readerView = document.getElementById('reader-view');
        if (readerView && !readerView.classList.contains('hidden')) {
          e.preventDefault();
          if (window.readerSidebarManager) {
            window.readerSidebarManager.toggleHighlightsPanel();
          }
        }
      }

      // Toggle 2 Pages / 1 Page Layout: 'P'
      if (keyUpper === 'P') {
        const readerView = document.getElementById('reader-view');
        if (readerView && !readerView.classList.contains('hidden')) {
          e.preventDefault();
          if (window.readerManager) {
            window.readerManager.toggleSpreadMode();
          }
        }
      }

      // Marcar / Desmarcar Página: 'M'
      if (keyUpper === 'M') {
        const readerView = document.getElementById('reader-view');
        if (readerView && !readerView.classList.contains('hidden')) {
          e.preventDefault();
          if (window.readerSidebarManager) {
            window.readerSidebarManager.toggleCurrentPageBookmark();
          }
        }
      }

      // Intercept Ctrl + Plus / Equal / NumpadAdd -> In-App Zoom In
      if (e.ctrlKey && (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd' || e.code === 'Equal')) {
        const readerView = document.getElementById('reader-view');
        if (readerView && !readerView.classList.contains('hidden')) {
          e.preventDefault();
          if (window.readerManager) {
            window.readerManager.zoomIn();
          }
        }
      }

      // Intercept Ctrl + Minus / NumpadSubtract -> In-App Zoom Out
      if (e.ctrlKey && (e.key === '-' || e.code === 'NumpadSubtract' || e.code === 'Minus')) {
        const readerView = document.getElementById('reader-view');
        if (readerView && !readerView.classList.contains('hidden')) {
          e.preventDefault();
          if (window.readerManager) {
            window.readerManager.zoomOut();
          }
        }
      }

      // Intercept Ctrl + 0 -> Reset Zoom to 100%
      if (e.ctrlKey && (e.key === '0' || e.code === 'Numpad0' || e.code === 'Digit0')) {
        const readerView = document.getElementById('reader-view');
        if (readerView && !readerView.classList.contains('hidden')) {
          e.preventDefault();
          if (window.readerManager) {
            window.readerManager.resetZoom();
          }
        }
      }
    });
  }

  setupThemeToggle() {
    const btnToggle = document.getElementById('btn-toggle-theme');
    if (btnToggle) {
      btnToggle.addEventListener('click', () => this.toggleTheme());
    }
  }

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('pdf_reader_theme', this.theme);
    this.applyTheme(this.theme);
    this.showToast(`Modo ${this.theme === 'dark' ? 'Escuro' : 'Claro'} ativado.`);
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const label = document.getElementById('theme-label');
    if (label) {
      label.textContent = theme === 'dark' ? 'Modo Claro' : 'Modo Escuro';
    }
    const icon = document.getElementById('theme-icon');
    if (icon) {
      icon.innerHTML = theme === 'dark' 
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
    }

    const allGroups = document.querySelectorAll('.highlight-group');
    allGroups.forEach(g => {
      g.style.mixBlendMode = theme === 'dark' ? 'screen' : 'multiply';
    });
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    toast.innerHTML = `<span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  showPromptModal(title, excerptText, defaultText = '') {
    return new Promise((resolve) => {
      const modal = document.getElementById('modal-annotation');
      const titleEl = document.getElementById('annotation-modal-title');
      const excerptEl = document.getElementById('annotation-excerpt-preview');
      const inputEl = document.getElementById('annotation-text-input');
      const btnSave = document.getElementById('btn-save-annotation');
      const btnCancel = document.getElementById('btn-cancel-annotation');
      const btnClose = document.getElementById('btn-close-annotation-modal');

      if (!modal || !inputEl) {
        resolve(null);
        return;
      }

      if (titleEl) titleEl.textContent = title || 'Anotação / Comentário';
      if (excerptEl) {
        if (excerptText) {
          excerptEl.textContent = `"${excerptText.substring(0, 120)}${excerptText.length > 120 ? '...' : ''}"`;
          excerptEl.style.display = 'block';
        } else {
          excerptEl.style.display = 'none';
        }
      }

      inputEl.value = defaultText || '';
      modal.classList.remove('hidden');
      setTimeout(() => inputEl.focus(), 50);

      const cleanup = () => {
        modal.classList.add('hidden');
        btnSave.removeEventListener('click', handleSave);
        btnCancel.removeEventListener('click', handleCancel);
        if (btnClose) btnClose.removeEventListener('click', handleCancel);
      };

      const handleSave = () => {
        const val = inputEl.value;
        cleanup();
        resolve(val);
      };

      const handleCancel = () => {
        cleanup();
        resolve(null);
      };

      btnSave.addEventListener('click', handleSave);
      btnCancel.addEventListener('click', handleCancel);
      if (btnClose) btnClose.addEventListener('click', handleCancel);
    });
  }
}

window.app = new App();

document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
});
