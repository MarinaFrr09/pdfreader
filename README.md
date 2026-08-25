# 📚 Leitor de Livros PDF & Gerenciador de Biblioteca

Um aplicativo web desktop para leitura confortável e organização de livros e documentos PDF. Projetado com leitor na horizontal, pré-visualização de capas, 5 marcadores de texto em cores pastéis, visualização em 2 páginas lado a lado (spread mode), notas personalizadas, modos claro/escuro e navegação com suporte a zoom e rolagem por arraste do mouse.

---

## ✨ Funcionalidades Principais

- 📂 **Biblioteca & Organização por Pastas**:
  - Organização em pastas personalizadas (*Estudos*, *Faculdade*, *Favoritos*, *Lixeira*).
  - Geração automática de miniatura da capa (1ª página do PDF).
  - Armazenamento local persistente de livros e marcações via **IndexedDB**.

- 📖 **Leitor na Horizontal & 2 Páginas Lado a Lado**:
  - Alternância rápida entre visualização em **1 Página** ou **2 Páginas Lado a Lado (Atalho `P`)**.
  - Transição de páginas sem cintilações (Atomic Double-Buffering).
  - Cliques nas extremidades da tela (`zone-left` / `zone-right`) ou setas de navegação.

- 🖍️ **Grifos de Texto em 5 Cores Pastéis & Anotações**:
  - Seleção nativa de texto com alinhamento milimétrico de fonte.
  - Seleção por **2 cliques (1 palavra)** e **3 cliques (período/frase completa)**.
  - 5 Cores Pastéis: 🌸 Rosa, 💛 Amarelo, 💚 Menta, 💙 Azul e 💜 Lavanda.
  - Adição de **Notas e Comentários** (Atalho `N`) integrados ao painel lateral.

- 🔍 **Zoom & Rolagem Fluida**:
  - Controle de zoom integrado via `Ctrl + +`, `Ctrl + -`, `Ctrl + 0` e `Ctrl + Scroll`.
  - **Arraste com o Botão Direito do Mouse**: Pressione e arraste com o botão direito para movimentar a folha livremente quando estiver com zoom.
  - Barras de rolagem vertical e horizontal de alto contraste ativadas automaticamente ao dar zoom.

- 🌙 **Modos Claro e Escuro**:
  - Alternância global de tema em todo o sistema (Atalhos `T` ou `E`).
  - Modo escuro inteligente que inverte folhas mantendo contraste confortável e legibilidade.

- 🗂️ **Painel Lateral Integrado (Atalho `L`)**:
  - Miniaturas de todas as páginas com botões rápidos de marcar página.
  - Pesquisa interna de palavras no documento com busca em tempo real.
  - Lista de Marcadores (`M`) e Partes Grifadas (`G`).

---

## ⌨️ Atalhos de Teclado

| Atalho | Ação |
|---|---|
| `P` | Alterna entre 2 Páginas e 1 Página |
| `G` | Abre / Fecha o painel de Partes Grifadas |
| `L` | Abre / Fecha o Painel Lateral |
| `T` ou `E` | Alterna entre Modo Claro e Escuro |
| `M` | Marca ou desmarca a página atual |
| `N` | Adiciona uma Nota ao texto selecionado |
| `R` | Remove a marcação do texto selecionado |
| `X` | Aplica o marcador na cor ativa |
| `Ctrl + +` / `Ctrl + -` | Aumenta ou diminui o zoom |
| `Ctrl + 0` | Restaura o zoom para 100% |
| `←` / `→` ou `Espaço` | Navega entre as páginas |
| `Esc` | Fecha o leitor e volta para a biblioteca |

---

## 🛠️ Tecnologias Utilizadas

- **HTML5 & Vanilla CSS3**: Interface responsiva, moderna e fluida.
- **JavaScript (ES6+)**: Lógica modular orientada a objetos.
- **PDF.js**: Motor de renderização e extração de texto PDF da Mozilla.
- **IndexedDB**: Banco de dados no navegador para armazenamento local ilimitado de PDFs, capas e notas.

---

## 🚀 Como Executar Localmente

1. Clone o repositório ou baixe os arquivos.
2. Abra o arquivo `index.html` diretamente em qualquer navegador moderno ou rode com um servidor local (ex: Live Server do VS Code ou `python -m http.server 8085`).
