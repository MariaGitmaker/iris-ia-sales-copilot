# Evolução IrisIA — Plano Incremental

Mantém 100% das funcionalidades atuais. Tudo é aditivo (novas colunas, novas tabelas, novas views), sem quebrar contratos existentes.

---

## 1. Banco de dados (migração única)

### 1.1 Edição/exclusão de mensagens com auditoria
- `channel_messages`: adicionar `edited_at timestamptz`, `deleted_at timestamptz`, `original_content text`.
- Nova tabela `channel_message_audit` (id, message_id, conversation_id, user_id, action `'edit'|'delete'`, previous_content, new_content, created_at) — log imutável.
- Trigger `BEFORE UPDATE` em `channel_messages` que grava no audit quando `content` muda ou `deleted_at` é setado, e preenche `original_content` na primeira edição.
- RLS no audit: leitura pelo dono da conversa, insert via trigger (security definer).

### 1.2 Soft delete de leads + lixeira
- `leads`: adicionar `deleted_at timestamptz`, `deleted_reason text`.
- Atualizar políticas RLS: leitura padrão filtra `deleted_at IS NULL` no app (não na policy, para permitir lixeira).
- Índice parcial `idx_leads_active` em `(user_id, updated_at)` WHERE `deleted_at IS NULL`.
- Índice em `(user_id, deleted_at)` para lixeira.
- Relatórios históricos consultam por `created_at`, ignorando `deleted_at` → preservados.

### 1.3 Pendências, follow-ups e regras de alerta
- Nova tabela `lead_reminders` (id, user_id, lead_id, kind `'followup'|'birthday'|'holiday'|'custom'`, due_at, message, status `'pending'|'done'|'snoozed'|'dismissed'`, meta jsonb).
- Nova tabela `reminder_rules` (id, user_id, name, trigger_type `'inactivity'|'stage_age'|'date'`, threshold_hours int, stages text[], enabled bool, meta jsonb). Defaults seedados no primeiro login (24h/48h/7d).
- `leads`: adicionar `birthday date` (opcional).

### 1.4 Timeline / histórico por lead
- Nova tabela `lead_events` (id, user_id, lead_id, type `'created'|'updated'|'stage_change'|'message'|'note'|'reminder'|'recovery'`, title, description, metadata jsonb, occurred_at timestamptz).
- Índices: `(user_id, occurred_at DESC)`, `(lead_id, occurred_at DESC)`, GIN em metadata.
- Trigger em `leads` (insert/update de stage) e em `channel_messages` (insert) que insere evento automaticamente.

### 1.5 Datas comemorativas
- Nova tabela `holiday_templates` (id, user_id, holiday_key, name, date_rule, message_template, enabled). Seed com Natal, Ano Novo, Dia das Mães, Dia dos Pais, Páscoa, Black Friday.
- Edge function `generate-seasonal-reminders` (cron diário): cria `lead_reminders` para leads ativos quando data se aproxima (D-1) e para aniversários.

### 1.6 Detecção de leads esquecidos
- Edge function `detect-stale-leads` (cron a cada hora): aplica `reminder_rules` ativas e cria `lead_reminders` pendentes.

---

## 2. Edge functions

- `generate-seasonal-reminders` — cron diário 08:00 UTC.
- `detect-stale-leads` — cron horário.
- `irisia-recovery-suggest` — recebe `lead_id`, retorna sugestão (mensagem + ação) usando Lovable AI Gateway. JWT obrigatório.
- Atualizar `irisia-ai` (se necessário) para considerar `lead_events` recentes como contexto — não-quebrante.

Cron via `pg_cron` + `pg_net` (insert tool, não migration, pois usa anon key específica).

---

## 3. Frontend

### 3.1 `Channels.tsx` — chat
- Hover/long-press em bolha de mensagem própria → menu "Editar" / "Excluir".
- Editar: inline textarea + Salvar/Cancelar → `update channel_messages set content, edited_at=now()`.
- Excluir: AlertDialog confirmação → `update set deleted_at=now()` (soft).
- Render: mensagens com `deleted_at` mostram "Mensagem excluída" em itálico; `edited_at` mostra "(editado)".
- Realtime já cobre updates via postgres_changes existente.
- Badge "histórico" abre modal lendo `channel_message_audit`.

### 3.2 `CRM.tsx`
- Botão "Lixeira" no header → drawer listando leads com `deleted_at`, ação "Restaurar".
- Excluir lead: AlertDialog → soft delete.
- Adicionar campo `birthday` no form.
- Aba/tab "Timeline" no editor de lead → lista `lead_events` com filtros (intervalo de datas, palavra-chave, estágio).
- Filtro mensal: agrupador por mês na lista mobile + seletor de mês.

### 3.3 Negociações
- Ao criar negociação sem `lead_id`, criar lead automaticamente (`stage='qualification'`) e linkar — combinado com botão manual atual.
- Botão "Excluir lead vinculado" com confirmação dentro da view de negociação.

### 3.4 Novo componente `RemindersCenter`
- Sino no AppShell com contador de `lead_reminders` pendentes.
- Pop-up modal lista pendências; ações rápidas: "Contatar" (abre conversa), "Mover estágio" (select), "Agendar follow-up" (date picker), "Dispensar".
- Toast automático quando novos reminders chegam (realtime subscribe scoped por user).

### 3.5 Settings
- Nova seção "Lembretes & Recuperação": toggle/edição de `reminder_rules`, edição de `holiday_templates`, campo aniversário default opcional.

### 3.6 IA
- Em `RemindersCenter`, botão "Sugerir mensagem" → `irisia-recovery-suggest` → preenche campo de mensagem.
- Insight cards no Dashboard com top 5 leads em risco (query `lead_events` last activity vs threshold).

---

## 4. Detalhes técnicos

- **Retrocompatibilidade**: todas as colunas novas são nullable com defaults; código atual continua funcionando.
- **Performance**: índices parciais e por (user_id, occurred_at). Queries de timeline paginadas (50/página).
- **Realtime**: novos canais `user:<uid>:reminders` e `user:<uid>:lead-events` seguindo convenção scoped já estabelecida.
- **Segurança**: RLS owner-only em todas as novas tabelas; audit append-only (sem UPDATE/DELETE policy).
- **Mobile**: drawers e bottom-sheets já no design system; manter glass cards.
- **i18n**: pt-BR consistente com app atual.

---

## 5. Ordem de execução

1. Migration única (1.1–1.6) → aprovação do usuário.
2. Atualizar tipos Supabase (automático).
3. Criar 3 edge functions + agendar cron via insert tool.
4. Frontend: `Channels` (edit/delete) → `CRM` (soft delete + birthday + timeline) → `RemindersCenter` + AppShell badge → Settings → integração IA.
5. QA: subir lead de teste, simular inatividade, verificar pop-up e realtime.

---

## 6. O que NÃO muda

- Estrutura de pastas, design tokens, identidade visual.
- Fluxo de auth, AI gateway, webhook WhatsApp.
- Schemas existentes (apenas `ALTER ADD COLUMN`).
- APIs/contratos das edge functions atuais.
