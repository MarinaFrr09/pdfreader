/* ==========================================================================
   IN-BOOK WORD & PHRASE SEARCH ENGINE
   ========================================================================== */

class SearchEngine {
  constructor() {
    this.pdfDoc = null;
    this.results = [];
    this.isSearching = false;
  }

  setDocument(pdfDoc) {
    this.pdfDoc = pdfDoc;
    this.results = [];
  }

  async search(query, onProgress) {
    if (!this.pdfDoc || !query || query.trim().length < 2) {
      return [];
    }

    this.isSearching = true;
    this.results = [];
    const cleanQuery = query.toLowerCase().trim();
    const totalPages = this.pdfDoc.numPages;

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (!this.isSearching) break; // Cancel search if document changes

      if (onProgress && pageNum % 5 === 0) {
        onProgress(pageNum, totalPages);
        // Yield to main UI loop every 5 pages
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      try {
        const page = await this.pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');

        const lowerText = pageText.toLowerCase();
        let index = lowerText.indexOf(cleanQuery);

        while (index !== -1) {
          // Extract snippet around match
          const start = Math.max(0, index - 35);
          const end = Math.min(pageText.length, index + cleanQuery.length + 35);
          let snippet = pageText.substring(start, end);

          if (start > 0) snippet = '...' + snippet;
          if (end < pageText.length) snippet = snippet + '...';

          this.results.push({
            pageNum: pageNum,
            matchText: pageText.substring(index, index + cleanQuery.length),
            snippet: snippet,
            query: cleanQuery
          });

          // Find next occurrence on same page
          index = lowerText.indexOf(cleanQuery, index + cleanQuery.length);
        }
      } catch (err) {
        console.warn(`Error reading text on page ${pageNum}:`, err);
      }
    }

    this.isSearching = false;
    return this.results;
  }

  cancel() {
    this.isSearching = false;
  }
}

window.searchEngine = new SearchEngine();
