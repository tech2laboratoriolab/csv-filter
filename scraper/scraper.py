"""
Scraper automatico - Coleta CSV do portal apLIS e importa no CSV Filter Pro

Configuracao:
1. pip install playwright requests python-dotenv
2. playwright install chromium
3. Adicione ao .env na raiz do projeto:
   APLIS_URL=https://lab.aplis.inf.br
   APLIS_USER=seu_usuario
   APLIS_PASS=sua_senha
4. Teste manualmente: python scraper.py --debug
"""

import os
import sys
import time
import logging
import argparse
from datetime import datetime, timedelta
from pathlib import Path

# Carrega .env da raiz do projeto (um nivel acima de scraper/)
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / '.env')

APLIS_URL  = os.getenv('APLIS_URL', 'https://lab.aplis.inf.br')
APLIS_USER = os.getenv('APLIS_USER', '')
APLIS_PASS = os.getenv('APLIS_PASS', '')

APP_URL      = "http://localhost:3000"
DOWNLOAD_DIR = Path(__file__).parent / "downloads"
DATE_FORMAT  = "%d/%m/%Y"

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(Path(__file__).parent / 'scraper.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
log = logging.getLogger(__name__)


def get_date_range() -> tuple[str, str]:
    hoje = datetime.now()
    inicio = hoje - timedelta(days=90)
    return inicio.strftime(DATE_FORMAT), hoje.strftime(DATE_FORMAT)


def download_csv(debug: bool = False) -> Path | None:
    from playwright.sync_api import sync_playwright

    DOWNLOAD_DIR.mkdir(exist_ok=True)
    log.info("Periodo: ultimos 90 dias")

    if not APLIS_USER or not APLIS_PASS:
        log.error("APLIS_USER / APLIS_PASS nao definidos no .env")
        return None

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=not debug,
            args=['--no-sandbox', '--disable-dev-shm-usage']
        )
        context = browser.new_context(
            accept_downloads=True,
            viewport={'width': 1920, 'height': 1080}
        )
        page = context.new_page()

        try:
            # ── 1. LOGIN ──────────────────────────────────────────────────
            log.info(f"Acessando portal: {APLIS_URL}")
            page.goto(APLIS_URL, wait_until='networkidle', timeout=30000)
            time.sleep(2)
            page.screenshot(path=str(DOWNLOAD_DIR / "debug_login.png"))
            log.info("Fazendo login...")

            page.fill('input.usr', APLIS_USER)
            log.info("  Usuario preenchido (input.usr)")

            page.fill('input.pwd', APLIS_PASS)
            log.info("  Senha preenchida (input.pwd)")

            for sel in ['button[type="submit"]', 'input[type="submit"]',
                        'button:has-text("Entrar")', 'button:has-text("Acessar")']:
                try:
                    page.click(sel, timeout=3000)
                    log.info(f"  Login submetido: {sel}")
                    break
                except Exception:
                    pass

            page.wait_for_load_state('networkidle', timeout=30000)
            time.sleep(2)
            log.info(f"URL apos login: {page.url}")
            page.screenshot(path=str(DOWNLOAD_DIR / "debug_after_login.png"))

            # ── 2. NAVEGAR PARA GERENCIAMENTO via .menuLeft ───────────────
            log.info("Clicando em 'gerenciamento' no .menuLeft...")
            page.click('.menuLeft a:has-text("gerenciamento")', timeout=10000)
            page.wait_for_load_state('networkidle', timeout=30000)
            time.sleep(2)
            log.info(f"URL gerenciamento: {page.url}")
            page.screenshot(path=str(DOWNLOAD_DIR / "debug_gerenciamento.png"))

            # ── 3. MARCAR Requisições e Cobranças ─────────────────────────
            log.info("Marcando 'requisicoes' e 'cobrancas'...")
            for label_text in ['requisições', 'cobranças']:
                try:
                    page.get_by_label(label_text, exact=False).check(timeout=5000)
                    log.info(f"  Marcado via get_by_label: {label_text}")
                except Exception:
                    try:
                        page.locator(f'label:has-text("{label_text}")').click(timeout=5000)
                        log.info(f"  Marcado via click no label: {label_text}")
                    except Exception as e:
                        log.warning(f"  Nao marcou '{label_text}': {e}")

            # ── 4. AGRUPAR POR: mês ───────────────────────────────────────
            log.info("Selecionando 'Agrupar por' = 'mes'...")
            try:
                agrup_label = page.locator(
                    'label:has-text("Agrupar por"), td:has-text("Agrupar por"), span:has-text("Agrupar por")'
                ).first
                agrup_label.locator('xpath=following::select[1]').select_option(label='mês', timeout=5000)
                log.info("  'Agrupar por' = 'mes' selecionado")
            except Exception:
                try:
                    for sel in page.locator('select').all():
                        opts = sel.locator('option').all_inner_texts()
                        if any('mês' in o or 'mes' in o.lower() for o in opts):
                            sel.select_option(label='mês')
                            log.info("  'Agrupar por' = 'mes' via fallback")
                            break
                except Exception as e:
                    log.warning(f"  'Agrupar por' nao configurado: {e}")

            # ── 5. CLICAR "ATUALIZAR" e aguardar geracao do relatorio ─────
            log.info("Clicando em 'Atualizar' para gerar relatorio...")
            page.click(
                'button:has-text("Atualizar"), input[value*="Atualizar" i]',
                timeout=10000
            )
            page.wait_for_load_state('networkidle', timeout=60000)
            time.sleep(3)  # aguarda renderizacao do PDF/relatorio
            log.info("Relatorio gerado")
            page.screenshot(path=str(DOWNLOAD_DIR / "debug_before_download.png"))

            # ── 6. SELECIONAR FORMATO CSV ─────────────────────────────────
            log.info("Selecionando formato de exportacao CSV...")
            csv_option_text = 'valores separados por caracteres (CSV)'
            csv_selected = False
            for sel in page.locator('select').all():
                try:
                    opts = sel.locator('option').all_inner_texts()
                    if any('CSV' in o for o in opts):
                        sel.select_option(label=csv_option_text)
                        log.info("  Formato CSV selecionado")
                        csv_selected = True
                        break
                except Exception:
                    pass
            if not csv_selected:
                log.warning("  Nao encontrou select com opcao CSV")

            # ── 7. DOWNLOAD VIA .tableCmd ─────────────────────────────────
            log.info("Clicando em .tableCmd para disparar download...")
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            csv_path  = DOWNLOAD_DIR / f"dados_{timestamp}.csv"

            with page.expect_download(timeout=120000) as dl_info:
                page.click('.tableCmd', timeout=10000)

            download = dl_info.value
            download.save_as(str(csv_path))
            log.info(f"CSV baixado: {csv_path} ({csv_path.stat().st_size / 1024:.1f} KB)")
            return csv_path

        except Exception as e:
            log.error(f"Erro no scraping: {e}")
            try:
                ss = DOWNLOAD_DIR / f"error_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
                page.screenshot(path=str(ss))
                log.info(f"Screenshot de erro salvo: {ss}")
            except Exception:
                pass
            return None

        finally:
            if debug:
                log.info("Modo debug: browser aberto por 60s para inspecao")
                time.sleep(60)
            browser.close()


def upload_to_app(csv_path: Path) -> bool:
    import requests

    url = f"{APP_URL}/api/upload"
    log.info(f"Enviando CSV para {url}...")

    try:
        with open(csv_path, 'rb') as f:
            resp = requests.post(url, files={'file': (csv_path.name, f, 'text/csv')}, timeout=300)

        if resp.status_code == 200:
            data = resp.json()
            if data.get('success'):
                log.info(f"Import OK: {data.get('rowCount', '?')} linhas importadas")
                return True
            else:
                log.error(f"Erro na API: {data.get('error')}")
                return False
        else:
            log.error(f"HTTP {resp.status_code}: {resp.text[:200]}")
            return False

    except requests.exceptions.ConnectionError:
        log.error(f"Nao foi possivel conectar em {APP_URL}. O Next.js esta rodando?")
        return False
    except Exception as e:
        log.error(f"Erro no upload: {e}")
        return False


def cleanup_old_files(keep_last: int = 5):
    if not DOWNLOAD_DIR.exists():
        return
    csvs = sorted(DOWNLOAD_DIR.glob('dados_*.csv'), key=lambda p: p.stat().st_mtime, reverse=True)
    for old in csvs[keep_last:]:
        old.unlink()
        log.info(f"Removido arquivo antigo: {old.name}")


def main():
    parser = argparse.ArgumentParser(description='Scraper apLIS')
    parser.add_argument('--debug', action='store_true', help='Roda com browser visivel (headless=False)')
    args = parser.parse_args()

    log.info("=" * 50)
    log.info("Iniciando coleta automatica apLIS")
    if args.debug:
        log.info("MODO DEBUG: browser visivel")
    log.info("=" * 50)

    csv_path = download_csv(debug=args.debug)
    if not csv_path:
        log.error("Falha no download do CSV")
        sys.exit(1)

    success = upload_to_app(csv_path)
    if not success:
        log.error("Falha no upload para o app")
        sys.exit(1)

    cleanup_old_files()
    log.info("Coleta concluida com sucesso!")


if __name__ == '__main__':
    main()
