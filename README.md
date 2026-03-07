# CSV Filter Pro — LAB

O **CSV Filter Pro** é um sistema web robusto projetado para automatizar a coleta, armazenamento e análise de dados de faturamento laboratorial. Ele substitui processos manuais de extração de relatórios por uma pipeline automatizada ponta a ponta, oferecendo uma interface rápida e avançada para filtragem e manipulação de dados.

## 🏗️ Arquitetura do Sistema

O sistema é dividido em duas partes principais: um **bot de coleta automática (Scraper)** e uma **Interface Web (Dashboard)**.

```text
Portal Web ──[Playwright/Python]──▶ CSV ──[API Upload]──▶ SQLite ──[Next.js]──▶ Interface Web
                 ▲                                                                    │
                 │                                                                    ▼
        Task Scheduler                                                     Filtros + Export
        (6h, 12h, 18h)                                                    (CSV / JSON)
```

## 🚀 Principais Funcionalidades

### 💻 Interface Web (Dashboard)
- **Upload Manual & Automático:** Suporte a drag & drop para arquivos CSV (com detecção automática de delimitadores `,`, `;`, `TAB`).
- **Mapeamento Amplo:** Suporte nativo para mais de 85 colunas do schema de faturamento (dados do paciente, requisição, valores, NF, glosa, etc.).
- **Motor de Filtros Avançado:** 
  - Filtros dinâmicos para texto, números e datas.
  - Operadores: Igual, Diferente, Contém, Não contém, Maior/Menor que, Entre, Em (lista customizada).
- **Gerenciamento de Filtros (Presets):**
  - Salve filtros complexos localmente.
  - **Importação/Exportação:** Compartilhe presets de filtros com a equipe via arquivos `.json`.
- **Tabela de Alta Performance:** Paginação server-side (50 linhas por página), ordenação por qualquer coluna e busca rápida de colunas ativas.
- **Exportação Inteligente:** Exporte apenas os dados filtrados e as colunas selecionadas para um novo CSV processado.

### 🤖 Automação de Coleta (Scraper)
- **Login e Navegação Automática:** Utiliza `playwright` para simular navegação humana no portal.
- **Janela Móvel de Datas:** Coleta sempre os dados dos últimos 3 meses até a data atual.
- **Resiliência e Logs:** Tira screenshots automáticos em caso de erro de navegação e mantém logs detalhados (`scraper/scraper.log`).
- **Rotina Agendada:** Script de configuração para o Agendador de Tarefas do Windows.

## 🛠️ Tecnologias Utilizadas

- **Frontend / Backend:** Next.js 14 (App Router), React 18, TypeScript, CSS Variables puro.
- **Banco de Dados:** SQLite (via `better-sqlite3` com modo WAL habilitado para alta concorrência).
- **Processamento de Dados:** `csv-parse` para parsing assíncrono e tolerante a falhas.
- **Web Scraping:** Python 3, Playwright, Requests.

---

## ⚙️ Guia de Instalação e Setup

### Pré-requisitos
- [Node.js](https://nodejs.org/) (v18+)
- [Python 3.10+](https://www.python.org/)
- Google Chrome (ou Chromium)

### 1. Aplicação Web (Next.js)

```bash
cd csv-filter
npm install
npm run dev
```
Acesse `http://localhost:3000` no seu navegador. O banco de dados SQLite (`data/database.sqlite`) será criado automaticamente no primeiro upload.

### 2. Automação e Scraper (Python)

```bash
cd csv-filter/scraper

# Instalar dependências do Python
pip install -r requirements.txt
playwright install chromium
```

**Configurando as Credenciais:**
Abra o arquivo `scraper/scraper.py` e edite as constantes no topo do arquivo:
```python
PORTAL_URL = "https://SEU-PORTAL.com.br/login"
PORTAL_USER = "seu_usuario"
PORTAL_PASS = "sua_senha"
# Ajuste os seletores CSS (SEL_USER_INPUT, SEL_PASS_INPUT, etc) conforme a estrutura do seu portal.
```

Para testar o script de extração manualmente:
```bash
python scraper.py
```

### 3. Agendamento Automático (Apenas Windows)

Para configurar o robô para rodar automaticamente todos os dias às 06:00, 12:00 e 18:00:
1. Abra o prompt de comando (CMD) **Como Administrador**.
2. Navegue até a pasta `scraper`.
3. Execute o script de configuração:
```cmd
setup_scheduler.bat
```

---

## 🗂️ Estrutura do Projeto

```text
csv-filter/
├── app/
│   ├── api/                   # Rotas de API (Next.js)
│   │   ├── upload/            # Ingestão de CSV -> SQLite
│   │   ├── query/             # Pesquisa, filtros e paginação
│   │   ├── filters/           # CRUD de presets de filtros (JSON)
│   │   ├── export/            # Geração de CSV de saída
│   │   └── stats/             # Indicadores e contagem do BD
│   ├── globals.css            # Estilização global e UI
│   └── page.tsx               # Interface do dashboard (Client Component)
├── lib/
│   └── db.ts                  # Configuração do SQLite e mapeamento das 85+ colunas
├── scraper/
│   ├── scraper.py             # Lógica do bot com Playwright
│   ├── requirements.txt       # Dependências Python
│   ├── run_scraper.bat        # Entrypoint para o Agendador de Tarefas
│   └── setup_scheduler.bat    # Script de criação das CRON jobs no Windows
└── data/                      # Diretório gerado automaticamente
    ├── database.sqlite        # Banco de dados local
    └── filters/               # Presets salvos pelo usuário em JSON
```

---

## 🆘 Solução de Problemas (Troubleshooting)

| Problema | Solução Sugerida |
| :--- | :--- |
| **Scraper falha no login** | O layout do portal pode ter mudado. Use o `DevTools (F12)` do Chrome para inspecionar os novos seletores e atualize as constantes `SEL_*` no `scraper.py`. Verifique as capturas de tela em `scraper/downloads/`. |
| **CSV não importa no sistema** | Verifique se a API do Next.js está rodando na porta 3000 (`APP_URL` no script Python). Caso importação manual falhe, assegure que o CSV tem cabeçalho na 1ª linha. |
| **Robô não roda no horário agendado** | O script `setup_scheduler.bat` requer privilégios de Administrador. Abra o "Agendador de Tarefas" do Windows e verifique a aba "Histórico" da tarefa `CSVFilterPro_Coleta`. |
