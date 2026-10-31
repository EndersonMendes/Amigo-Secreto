# Contratos entre interface, servidor e banco

JSON: sucesso `{data:T}`, falha `{error:string}`; POST same-origin com corpo limitado/estrito. Respostas `private, no-store`. Nenhuma rota pública retorna verificador, impressão HMAC ou UUID interno.

Tipos: `PublicEvent` contém `name,intro,home_text,event_date,registrations_open,draw_completed,participant_count`. `AdminEvent` acrescenta `draw_id,draw_at,revision`. `Participant` administrativo contém `id,name,gifts,created_at`. `Result` contém somente `name,gifts` do destinatário.

| Método e rota | Entrada | Saída em data |
| --- | --- | --- |
| GET `/api/event` | — | PublicEvent |
| GET `/api/participants` | — | string[] de nomes agrupados |
| POST `/api/register` | `{name,gifts,code}` | `{name}` |
| POST `/api/reveal` | `{name,code}` | Result |
| POST `/api/reset-code` | `{token,code}` | `{name}` |
| POST `/api/admin/login` | `{email,password}` | `{ok:true}` |
| POST `/api/admin/logout` | `{}` | `{ok:true}` |
| GET `/api/admin/event` | — | AdminEvent |
| POST `/api/admin/event` | `{name,intro,home_text,event_date,registrations_open,revision}` | AdminEvent |
| GET `/api/admin/participants` | — | Participant[] |
| POST `/api/admin/participants` | `{action:'edit',id,name,gifts}` ou `{action:'delete',id}` | `{ok:true}` |
| POST `/api/admin/reset-code` | `{id}` | `{name,token}` de redefinição, nunca código |
| GET `/api/admin/export` | — | CSV, fora do envelope JSON |
| GET `/api/admin/draw` | — | `{giver,receiver}[]` |
| POST `/api/admin/draw` | `{confirmation:'REALIZAR SORTEIO',revision}` | AdminEvent |
| POST `/api/admin/reset` | `{confirmation:'REINICIAR SORTEIO',draw_id}` | AdminEvent |
| POST `/api/admin/clear` | `{confirmation:'LIMPAR BASE DE DADOS',revision}` | AdminEvent |

Todas as rotas `/api/admin` de dados exigem administrador autenticado; login valida as credenciais e a autorização. Cadastro/redefinição recebem o código, derivam os verificadores no servidor e não o repetem na resposta. A confirmação temporária do navegador usa o valor já digitado.

`gifts`: exatamente três textos diferentes, 1–160 caracteres. `name`: 2–100. Código novo: string ASCII numérica, 4–128 caracteres, zeros iniciais significativos. `revision`: inteiro não negativo. A reserva temporária de 32 dígitos em bases com códigos legados está em [ATUALIZACAO.md](../ATUALIZACAO.md).

RPCs com `EXECUTE` somente para `service_role`:

- `as_public_event()`, `as_admin_event()`, `as_participants()`, `as_public_participants()`.
- `as_register(p_name text,p_gifts text[],p_code_hash text,p_fingerprint text,p_code_length integer)` → uuid interno.
- `as_edit_participant(p_id uuid,p_name text,p_gifts text[])`, `as_delete_participant(p_id uuid)`.
- `as_find_participant(p_name text,p_fingerprint text)` → `{name_key,candidates:[{id,code_hash}]}` interno; no máximo um legado e um novo correspondente.
- `as_reveal(p_id uuid,p_code_hash text)` → Result/null; hash atual é revalidado sob bloqueio compartilhado do evento. Sem rodada e com código válido: `DRAW_PENDING`.
- `as_issue_recovery(p_id uuid,p_token_hash text)` → nome; substitui token anterior e fixa vencimento em 30 minutos.
- `as_redeem_recovery(p_token_hash text,p_code_hash text,p_fingerprint text,p_code_length integer)` → nome; troca atômica com unicidade e uso único.
- `as_clear_database(p_revision bigint)` → AdminEvent; exclusões e reabertura atômicas.
- `as_update_event(p_name text,p_intro text,p_home_text text,p_event_date date,p_open boolean,p_revision bigint)` → AdminEvent.
- `as_commit_draw(p_pairs jsonb,p_revision bigint)` → AdminEvent; pares `{giver_id,receiver_id}` internos.
- `as_draw_results()` → pares por nome; `as_reset_draw(p_draw_id uuid)` → AdminEvent.
- `as_rate_limit(p_key text,p_limit integer,p_window_seconds integer)` → boolean, incremento atômico.

`DUPLICATE_CODE` retorna HTTP 409; `LEGACY_CODE_LENGTH` explica a restrição temporária; `INVALID_RECOVERY` e credenciais inválidas retornam 401. Erros antigos de sorteio, revisão, cadastro e configuração permanecem. A frase de confirmação é validada na API; o banco recebe somente os parâmetros confiáveis do servidor autenticado. A nova função não pode ser chamada por `anon`/`authenticated` diretamente no PostgREST.
