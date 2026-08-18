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

  // --- FOLDERS ---
  async getAllFolders() {
    const { data, error } = await this.client.from('folders').select('*');
    if (error) {
      console.error('Erro ao buscar pastas:', error);
      return [];
    }
    return data || [];
  }

  async saveFolder(folder) {
    const folderData = {
      id: folder.id || String(Date.now()),
      name: folder.name
    };
    const { data, error } = await this.client.from('folders').upsert(folderData).select();
    if (error) console.error('Erro ao salvar pasta:', error);
    return data ? data[0] : null;
  }

  async deleteFolder(folderId) {
    const { error } = await this.client.from('folders').delete().eq('id', folderId);
    if (error) console.error('Erro ao deletar pasta:', error);
  }

  // --- BOOKS ---
  async getAllBooks() {
    const { data, error } = await this.client.from('books').select('*');
    if (error) {
      console.error('Erro ao buscar livros:', error);
      return [];
    }
    return data || [];
  }

  async getBook(id) {
    const { data, error } = await this.client.from('books').select('*').eq('id', id).single();
    if (error) {
      console.error('Erro ao buscar livro:', error);
      return null;
    }
    return data;
  }

  async saveBook(book) {
    let fileUrl = book.fileUrl;

    // Se o livro for um arquivo binário/blob novo, envia para o Storage
    if (book.file instanceof Blob || book.file instanceof File) {
      const fileName = `${Date.now()}_${book.title.replace(/\s+/g, '_')}.pdf`;
      const { error: uploadError } = await this.client.storage
        .from('pdf-files')
        .upload(fileName, book.file, { upsert: true });

      if (!uploadError) {
        const { data: publicUrlData } = this.client.storage
          .from('pdf-files')
          .getPublicUrl(fileName);
        fileUrl = publicUrlData.publicUrl;
      } else {
        console.error('Erro no upload do PDF:', uploadError);
      }
    }

    const payload = {
      id: String(book.id || Date.now()),
      folderId: book.folderId || null,
      title: book.title || 'Sem título',
      fileUrl: fileUrl || book.fileUrl || null,
      coverUrl: book.coverUrl || null,
      lastPage: book.lastPage || 1,
      totalPages: book.totalPages || 0,
      createdAt: book.createdAt || new Date().toISOString()
    };

    const { data, error } = await this.client.from('books').upsert(payload).select();
    if (error) console.error('Erro ao salvar livro:', error);
    return data ? data[0] : null;
  }

  async deleteBook(id) {
    const { error } = await this.client.from('books').delete().eq('id', id);
    if (error) console.error('Erro ao deletar livro:', error);
  }

  // --- HIGHLIGHTS ---
  async getHighlightsForBook(bookId) {
    const { data, error } = await this.client.from('highlights').select('*').eq('bookId', bookId);
    if (error) {
      console.error('Erro ao buscar grifos:', error);
      return [];
    }
    return data || [];
  }

  async saveHighlight(highlight) {
    const payload = {
      id: String(highlight.id || Date.now()),
      bookId: String(highlight.bookId),
      pageNum: highlight.pageNum,
      text: highlight.text || '',
      rects: highlight.rects || [],
      color: highlight.color || 'yellow',
      createdAt: highlight.createdAt || new Date().toISOString()
    };

    const { data, error } = await this.client.from('highlights').upsert(payload).select();
    if (error) console.error('Erro ao salvar grifo:', error);
    return data ? data[0] : null;
  }

  async deleteHighlight(id) {
    const { error } = await this.client.from('highlights').delete().eq('id', id);
    if (error) console.error('Erro ao deletar grifo:', error);
  }

  // --- BOOKMARKS ---
  async getBookmarksForBook(bookId) {
    const { data, error } = await this.client.from('bookmarks').select('*').eq('bookId', bookId);
    if (error) {
      console.error('Erro ao buscar marcadores:', error);
      return [];
    }
    return data || [];
  }

  async saveBookmark(bookmark) {
    const payload = {
      id: String(bookmark.id || Date.now()),
      bookId: String(bookmark.bookId),
      pageNum: bookmark.pageNum,
      title: bookmark.title || `Página ${bookmark.pageNum}`,
      createdAt: bookmark.createdAt || new Date().toISOString()
    };

    const { data, error } = await this.client.from('bookmarks').upsert(payload).select();
    if (error) console.error('Erro ao salvar marcador:', error);
    return data ? data[0] : null;
  }

  async deleteBookmark(id) {
    const { error } = await this.client.from('bookmarks').delete().eq('id', id);
    if (error) console.error('Erro ao deletar marcador:', error);
  }
}

window.dbManager = new DatabaseManager();