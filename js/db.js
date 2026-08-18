/* ==========================================================================
   SUPABASE STORAGE & DATABASE MANAGER
   ========================================================================== */

const SUPABASE_URL = 'https://exohflhcfvmejgpababy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_shBfiXkMH6RSYPqbzuPXvA_IkLy9yz7';

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

class DatabaseManager {
  constructor() {
    this.client = supabaseClient;
  }

  async init() {
    if (!this.client && window.supabase) {
      this.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return this.client;
  }

  // --- PASTAS ---
  async getAllFolders() {
    const { data, error } = await this.client.from('folders').select('*');
    if (error) {
      console.error('Erro ao buscar pastas:', error);
      return [];
    }
    return data || [];
  }

  async saveFolder(folder) {
    const { error } = await this.client.from('folders').upsert({
      id: folder.id,
      name: folder.name
    });
    if (error) console.error('Erro ao salvar pasta:', error);
  }

  // --- LIVROS & STORAGE ---
  async getAllBooks() {
    const { data, error } = await this.client.from('books').select('*');
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
    let publicFileUrl = book.fileUrl || book.fileurl;

    // Upload para o bucket 'pdf-files'
    const rawFile = book.file || book.fileBlob;
    if (rawFile && (rawFile instanceof File || rawFile instanceof Blob)) {
      const fileName = `${book.id}_${Date.now()}.pdf`;
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

    const { error } = await this.client.from('books').upsert(payload);
    if (error) {
      console.error('Erro ao salvar metadados do livro:', error);
      throw error;
    }

    return payload;
  }

  async deleteBook(id) {
    const { error } = await this.client.from('books').delete().eq('id', id);
    if (error) console.error('Erro ao excluir livro:', error);
  }

  // --- GRIFOS (HIGHLIGHTS) ---
  async getHighlights(bookId, pageNum) {
    let query = this.client.from('highlights').select('*').eq('bookId', bookId);
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
    const payload = {
      id: highlight.id,
      bookId: highlight.bookId,
      pageNum: highlight.pageNum,
      text: highlight.text || '',
      rects: highlight.rects || [],
      color: highlight.color || 'yellow',
      createdAt: highlight.createdAt || new Date().toISOString()
    };
    const { error } = await this.client.from('highlights').upsert(payload);
    if (error) console.error('Erro ao salvar grifo:', error);
  }

  async deleteHighlight(id) {
    const { error } = await this.client.from('highlights').delete().eq('id', id);
    if (error) console.error('Erro ao excluir grifo:', error);
  }

  // --- MARCADORES (BOOKMARKS) ---
  async getBookmarks(bookId) {
    const { data, error } = await this.client.from('bookmarks').select('*').eq('bookId', bookId);
    return error ? [] : (data || []);
  }

  async getBookmarksForBook(bookId) {
    return this.getBookmarks(bookId);
  }

  async saveBookmark(bookmark) {
    const payload = {
      id: bookmark.id,
      bookId: bookmark.bookId,
      pageNum: bookmark.pageNum,
      title: bookmark.title || '',
      createdAt: bookmark.createdAt || new Date().toISOString()
    };
    const { error } = await this.client.from('bookmarks').upsert(payload);
    if (error) console.error('Erro ao salvar marcador:', error);
  }

  async deleteBookmark(id) {
    const { error } = await this.client.from('bookmarks').delete().eq('id', id);
    if (error) console.error('Erro ao excluir marcador:', error);
  }
}

window.dbManager = new DatabaseManager();