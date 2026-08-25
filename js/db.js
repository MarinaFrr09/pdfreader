/* ==========================================================================
   SUPABASE STORAGE, AUTHENTICATION & MULTI-TENANT DATABASE MANAGER
   ========================================================================== */

const SUPABASE_URL = 'https://exohflhcfvmejgpababy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_shBfiXkMH6RSYPqbzuPXvA_IkLy9yz7';

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

class DatabaseManager {
  constructor() {
    this.client = supabaseClient;
    this.currentUser = null;
  }

  async init() {
    if (!this.client && window.supabase) {
      this.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    
    if (this.client) {
      const { data: { session } } = await this.client.auth.getSession();
      this.currentUser = session ? session.user : null;

      this.client.auth.onAuthStateChange((event, session) => {
        this.currentUser = session ? session.user : null;
        if (window.app && typeof window.app.onAuthChange === 'function') {
          window.app.onAuthChange(this.currentUser);
        }
      });
    }

    return this.client;
  }

  // --- GOOGLE AUTHENTICATION ---
  async signInWithGoogle() {
    if (!this.client) return;
    const { data, error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname
      }
    });
    if (error) {
      console.error('Erro no login com Google:', error);
      window.app.showToast('Erro ao conectar com a conta do Google.', 'error');
    }
    return data;
  }

  async signInWithEmail(email, password) {
    if (!this.client) return;
    const { data, error } = await this.client.auth.signInWithPassword({
      email: email,
      password: password
    });
    if (error) {
      console.error('Erro no login por email:', error);
      window.app.showToast(error.message || 'Erro ao entrar com e-mail.', 'error');
    } else {
      window.app.showToast('Login realizado com sucesso!');
    }
    return data;
  }

  async signUpWithEmail(email, password) {
    if (!this.client) return;
    const { data, error } = await this.client.auth.signUp({
      email: email,
      password: password
    });
    if (error) {
      console.error('Erro no cadastro:', error);
      window.app.showToast(error.message || 'Erro ao criar conta.', 'error');
    } else {
      window.app.showToast('Conta criada com sucesso!');
    }
    return data;
  }

  async signOut() {
    if (!this.client) return;
    const { error } = await this.client.auth.signOut();
    if (error) {
      console.error('Erro ao sair da conta:', error);
    }
    this.currentUser = null;
    if (window.app && typeof window.app.onAuthChange === 'function') {
      window.app.onAuthChange(null);
    }
  }

  getCurrentUserId() {
    return this.currentUser ? this.currentUser.id : 'guest';
  }

  // --- PASTAS (ISOLADAS POR USUÁRIO) ---
  async getAllFolders() {
    if (!this.client) return [];
    const userId = this.getCurrentUserId();
    let query = this.client.from('folders').select('*');
    if (userId !== 'guest') {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao buscar pastas:', error);
      return [];
    }
    return data || [];
  }

  async saveFolder(folder) {
    if (!this.client) return;
    const userId = this.getCurrentUserId();
    const payload = {
      id: folder.id,
      name: folder.name
    };
    if (userId !== 'guest') payload.user_id = userId;

    const { error } = await this.client.from('folders').upsert(payload);
    if (error) console.error('Erro ao salvar pasta:', error);
  }

  async deleteFolder(id) {
    if (!this.client) return;
    const { error } = await this.client.from('folders').delete().eq('id', id);
    if (error) console.error('Erro ao excluir pasta:', error);
  }

  // --- LIVROS & STORAGE (ISOLADOS POR USUÁRIO) ---
  async getAllBooks() {
    if (!this.client) return [];
    const userId = this.getCurrentUserId();
    let query = this.client.from('books').select('*');
    if (userId !== 'guest') {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao buscar livros:', error);
      return [];
    }
    return (data || []).map(b => ({
      ...b,
      totalPages: b.totalPages || b.totalpages || b.pageCount || 1,
      pageCount: b.totalPages || b.totalpages || b.pageCount || 1,
      coverUrl: b.coverUrl || b.coverurl || b.coverDataUrl,
      coverDataUrl: b.coverUrl || b.coverurl || b.coverDataUrl,
      fileUrl: b.fileUrl || b.fileurl
    }));
  }

  async getBook(id) {
    if (!this.client) return null;
    const { data, error } = await this.client.from('books').select('*').eq('id', id).single();
    if (error) {
      console.error('Erro ao buscar livro:', error);
      return null;
    }
    return data ? {
      ...data,
      totalPages: data.totalPages || data.totalpages || data.pageCount || 1,
      pageCount: data.totalPages || data.totalpages || data.pageCount || 1,
      coverUrl: data.coverUrl || data.coverurl || data.coverDataUrl,
      coverDataUrl: data.coverUrl || data.coverurl || data.coverDataUrl,
      fileUrl: data.fileUrl || data.fileurl
    } : null;
  }

  async saveBook(book) {
    if (!this.client) return;
    const userId = this.getCurrentUserId();
    let publicFileUrl = book.fileUrl || book.fileurl;

    // Upload para o bucket 'pdf-files'
    const rawFile = book.file || book.fileBlob;
    if (rawFile && (rawFile instanceof File || rawFile instanceof Blob)) {
      const fileName = `${userId}_${book.id}_${Date.now()}.pdf`;
      const { data: uploadData, error: uploadError } = await this.client
        .storage
        .from('pdf-files')
        .upload(fileName, rawFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Erro no upload do PDF para o Storage:', uploadError);
        window.app.showToast('Erro ao subir PDF para o armazenamento.', 'error');
        throw uploadError;
      }

      const { data: urlData } = this.client.storage.from('pdf-files').getPublicUrl(fileName);
      publicFileUrl = urlData.publicUrl;
    }

    const payload = {
      id: book.id,
      folderId: book.folderId || 'all',
      title: book.title,
      fileUrl: publicFileUrl || null,
      coverUrl: book.coverUrl || book.coverDataUrl || null,
      lastPage: book.lastPage || 1,
      totalPages: book.totalPages || book.pageCount || 1,
      createdAt: book.createdAt || new Date().toISOString()
    };
    if (userId !== 'guest') payload.user_id = userId;

    const { error } = await this.client.from('books').upsert(payload);
    if (error) {
      console.error('Erro ao salvar metadados do livro:', error);
      throw error;
    }

    return payload;
  }

  async deleteBook(id) {
    if (!this.client) return;
    const { error } = await this.client.from('books').delete().eq('id', id);
    if (error) console.error('Erro ao excluir livro:', error);
  }

  // --- GRIFOS (ISOLADOS POR USUÁRIO) ---
  async getHighlights(bookId, pageNum) {
    if (!this.client) return [];
    const userId = this.getCurrentUserId();
    let query = this.client.from('highlights').select('*').eq('bookId', bookId);
    if (userId !== 'guest') {
      query = query.eq('user_id', userId);
    }
    if (pageNum !== undefined && pageNum !== null) {
      query = query.eq('pageNum', pageNum);
    }
    const { data, error } = await query;
    return error ? [] : (data || []);
  }

  async getHighlightsForBook(bookId) {
    return this.getHighlights(bookId);
  }

  async saveHighlight(highlight) {
    if (!this.client) return;
    const userId = this.getCurrentUserId();
    const payload = {
      id: highlight.id,
      bookId: highlight.bookId,
      pageNum: highlight.pageNum,
      text: highlight.text || '',
      rects: highlight.rects || [],
      color: highlight.color || 'yellow',
      createdAt: highlight.createdAt || new Date().toISOString()
    };
    if (userId !== 'guest') payload.user_id = userId;

    const { error } = await this.client.from('highlights').upsert(payload);
    if (error) console.error('Erro ao salvar grifo:', error);
  }

  async deleteHighlight(id) {
    if (!this.client) return;
    const { error } = await this.client.from('highlights').delete().eq('id', id);
    if (error) console.error('Erro ao excluir grifo:', error);
  }

  // --- MARCADORES (ISOLADOS POR USUÁRIO) ---
  async getBookmarks(bookId) {
    if (!this.client) return [];
    const userId = this.getCurrentUserId();
    let query = this.client.from('bookmarks').select('*').eq('bookId', bookId);
    if (userId !== 'guest') {
      query = query.eq('user_id', userId);
    }
    const { data, error } = await query;
    return error ? [] : (data || []);
  }

  async getBookmarksForBook(bookId) {
    return this.getBookmarks(bookId);
  }

  async saveBookmark(bookmark) {
    if (!this.client) return;
    const userId = this.getCurrentUserId();
    const payload = {
      id: bookmark.id,
      bookId: bookmark.bookId,
      pageNum: bookmark.pageNum,
      title: bookmark.title || '',
      createdAt: bookmark.createdAt || new Date().toISOString()
    };
    if (userId !== 'guest') payload.user_id = userId;

    const { error } = await this.client.from('bookmarks').upsert(payload);
    if (error) console.error('Erro ao salvar marcador:', error);
  }

  async deleteBookmark(id) {
    if (!this.client) return;
    const { error } = await this.client.from('bookmarks').delete().eq('id', id);
    if (error) console.error('Erro ao excluir marcador:', error);
  }
}

window.dbManager = new DatabaseManager();