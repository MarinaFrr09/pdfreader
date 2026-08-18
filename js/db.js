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
      pageCount: b.totalPages || b.pageCount || 1,
      coverDataUrl: b.coverUrl || b.coverDataUrl
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
      pageCount: data.totalPages || data.pageCount || 1,
      coverDataUrl: data.coverUrl || data.coverDataUrl
    } : null;
  }

  async saveBook(book) {
    let publicFileUrl = book.fileUrl;

    // Se houver um arquivo físico novo, envia para o bucket 'pdf-files'
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

      // Obtém a URL pública do PDF
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

  // --- GRIFOS & MARCADORES ---
  async getHighlights(bookId, pageNum) {
    const { data, error } = await this.client
      .from('highlights')
      .select('*')
      .eq('bookId', bookId)
      .eq('pageNum', pageNum);
    return error ? [] : (data || []);
  }

  async saveHighlight(highlight) {
    await this.client.from('highlights').upsert(highlight);
  }

  async deleteHighlight(id) {
    await this.client.from('highlights').delete().eq('id', id);
  }

  async getBookmarks(bookId) {
    const { data, error } = await this.client.from('bookmarks').select('*').eq('bookId', bookId);
    return error ? [] : (data || []);
  }

  async saveBookmark(bookmark) {
    await this.client.from('bookmarks').upsert(bookmark);
  }

  async deleteBookmark(id) {
    await this.client.from('bookmarks').delete().eq('id', id);
  }
}

window.dbManager = new DatabaseManager();