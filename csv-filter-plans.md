# Plano: Correções e Melhorias — Sistema de Prazos (csv-filter)

## Contexto

O cliente solicitou melhorias em três frentes: (1) aprimorar o fluxo de notificações críticas com envio individual e inclusão de PCR, (2) criar abas dedicadas para gestão de IHQ (casos sem requisição de imuno + envio de solicitações), e (3) adicionar uma aba global de "atrasados do dia" com notificação automática às clínicas.

---

## Escopo das Mudanças

### 1. Aba "Críticos" — Envio Individual por Ordem de Liberação

**Objetivo:** Reorganizar o envio de notificações críticas para que sejam enviadas individualmente, em ordem cronológica de liberação.

**Mudanças:**
- Na aba "Bio-Molecular" (ou criar sub-aba dedicada "Críticos") dentro de `/app/whatsapp/page.tsx`
- Adicionar lógica para ordenar casos por `dta_finalizacao` (data de liberação do laudo) antes do envio
- Exibir linha do tempo: "Laudo liberado em {dta_finalizacao} → Clínica notificada em {data_envio}"
- Botão de envio individual por caso (ao invés de envio em lote apenas)
- Adicionar filtro/preset para laudos PCR: filtrar `nom_exame` ou `nom_evento` com operador `contains` para "PCR", "pcr", "Reação em Cadeia" via nova função `getPCRSummary()` / `getPCRRows()`

**Arquivos afetados:**
- `app/whatsapp/page.tsx` — nova lógica de envio individual + ordenação
- `lib/clientDb.ts` — adicionar `getPCRSummary()`, `getPCRRows()`

---

### 2. Aba IHQ — Casos sem Requisição de Imuno

**Objetivo:** Destacar casos IHQ que ainda aguardam abertura de requisição de imuno.

**Mudanças:**
- Criar nova sub-aba "Sem Req. Imuno" dentro da aba IHQ (no `whatsapp/page.tsx` ou em nova página `/app/ihq/page.tsx`)
- Lógica: filtrar casos do filtro IHQ (campos que contêm variantes de "histoquímica/imuno") com ausência de registro de imuno
- Exibir tabela com: `cod_requisicao`, `nom_paciente`, `dta_finalizacao`, `nom_patologista`, `nom_convenio`
- Indicador visual (badge/contador) de quantos casos estão pendentes

**Arquivos afetados:**
- `lib/clientDb.ts` — adicionar `getIHQSemRequisicao()`
- `app/whatsapp/page.tsx` (ou nova página) — nova sub-aba com tabela

---

### 3. Aba IHQ — Envio de Solicitações de Imuno

**Objetivo:** Permitir enviar solicitações de imuno por WhatsApp diretamente da interface.

**Mudanças:**
- Na mesma aba IHQ, adicionar segunda sub-aba "Enviar Solicitações"
- Botão "Enviar Solicitação de Imuno" por caso individual
- Template de mensagem configurável:
  > "Olá {clinica}, o caso {cod_requisicao} do paciente {nom_paciente} requer abertura de requisição de imunohistoquímica. Por favor, providenciar."
- Marcar casos como "solicitação enviada" (flag local via IndexedDB) para controle

**Arquivos afetados:**
- `lib/clientDb.ts` — adicionar store `ihq_solicitacoes` no IndexedDB para rastrear status
- `app/whatsapp/page.tsx` — botão de envio individual com template IHQ
- `app/api/whatsapp/send/route.ts` — já existente, reutilizar

---

### 4. Todas as Abas — Aba Global "Atrasados do Dia"

**Objetivo:** Exibir todos os casos atrasados do dia com notificação automática às clínicas sobre o atraso e nova data prevista.

**Mudanças:**
- Nova aba "Atrasados" (nível superior no WhatsApp)
- Lógica: `dta_prevista` com operador `is_past` (data passada, laudo não finalizado) — reutilizar operador existente em `lib/operators.ts`
- Template de mensagem fixo + editável:
  > "Olá {clinica}, informamos que o laudo do caso {cod_requisicao} — paciente {nom_paciente} — sofreu atraso. A nova data prevista de liberação é {nova_dta_prevista}. Motivo: {motivo_atraso}. Pedimos desculpas pelo transtorno."
- Campo para o usuário informar o motivo do atraso antes de enviar
- Botão "Notificar Todas as Clínicas Afetadas" (lote) e individual por caso
- Registro de envios no IndexedDB (store `atrasos_notificados`) para evitar reenvio duplicado

**Arquivos afetados:**
- `lib/clientDb.ts` — adicionar `getAtrasadosHoje()`, store `atrasos_notificados`
- `app/whatsapp/page.tsx` — nova aba "Atrasados" com template e botões

---

## Funções e Utilitários a Reutilizar

| Função existente | Localização | Uso |
|---|---|---|
| `getClinicaSummary()` / `getClinicaRows()` | `lib/clientDb.ts` | Base para `getAtrasadosHoje` |
| `getBioMolecularRows()` | `lib/clientDb.ts` | Base para `getPCRRows` |
| `applyWhatsAppDateFilter()` | `app/whatsapp/page.tsx` | Adaptar para filtrar atrasados |
| Operador `is_past` | `lib/operators.ts` | Filtro de atrasados |
| `/api/whatsapp/send` | `app/api/whatsapp/send/route.ts` | Envio de todas as mensagens |
| IndexedDB stores existentes | `lib/clientDb.ts` | Modelo para novos stores |

---

## Ordem de Implementação

1. **[Críticos]** `getPCRRows()` + ordenação por data de liberação + envio individual
2. **[IHQ]** `getIHQSemRequisicao()` + sub-aba de pendências
3. **[IHQ]** Sub-aba envio de solicitações + store `ihq_solicitacoes`
4. **[Global]** `getAtrasadosHoje()` + aba Atrasados + store `atrasos_notificados`

---

## Verificação

- Carregar CSV de teste com casos PCR, IHQ e atrasados
- Validar que a aba Críticos lista em ordem de `dta_finalizacao`
- Validar que IHQ sem requisição aparece corretamente
- Testar envio individual via WAHA (ambiente local com docker-compose)
- Confirmar que atrasos marcados como notificados não reaparecem na lista
