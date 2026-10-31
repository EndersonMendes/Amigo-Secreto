# Banco PostgreSQL / Supabase

Para instalação nova: `supabase/schema.sql`. Para uma instalação da versão recebida: `supabase/migrations/20261031_numeric_codes_and_clear.sql`. Ambos transacionais e repetíveis; nenhum executa a limpeza automaticamente. O roteiro para o usuário está em [ATUALIZACAO.md](../ATUALIZACAO.md).

## Tabelas

| Tabela | Dados / invariantes |
| --- | --- |
| `as_event` | Singleton id=1; nome, mensagens, data, inscrições abertas, draw_id único, draw_at e revision. |
| `as_participants` | UUID, nome normalizado, verificador scrypt, impressão HMAC única para novos códigos, created_at. Legados têm fingerprint nula e nome único entre legados. |
| `as_gifts` | FK participante, posição 1–3, descrição, chave normalizada; exatamente três diferentes por participante. |
| `as_assignments` | Origem PK, destino UNIQUE, FKs de participantes/rodada e CHECK de não autoatribuição. |
| `as_rate_limits` | Chave HMAC, início da janela e contagem; dados antigos são eliminados após 48h. |
| `as_recovery_tokens` | FK participante PK, hash de token único, expires_at; no máximo um token atual por pessoa. |

Gatilhos de restrição adiados garantem exatamente três presentes no commit. Exclusão de participante remove presentes e token por FK, mas pares precisam ser removidos antes por restrições. As RPCs mantêm os invariantes mesmo quando invocadas sem a interface. A regra de valores explícitos R$50 é aplicada em `as_valid_gifts` para cadastro/edição; a migração não altera presentes existentes.

## Credenciais

`as_valid_hash` admite `scrypt$...` antigo e `scrypt-v2$...` atual. `as_credential_version` relaciona versão do verificador com presença/formato da impressão HMAC. O índice único `as_participants_fingerprint_key` impede duplicidade mesmo sob concorrência. O segredo HMAC fica no ambiente do servidor, nunca em tabela.

A migração remove a antiga unicidade geral do nome e cria uma unicidade parcial somente para credenciais legadas. Novos homônimos são permitidos. `as_public_participants` agrupa pela chave normalizada e retorna apenas uma grafia pública por grupo. A identificação interna usa nome+fingerprint com fallback legado, sem vazar os candidatos.

A reserva de novos códigos de 32 dígitos enquanto houver legados é conferida dentro da transação, sob o mesmo lock do evento. Não é somente uma restrição da interface.

## Operações transacionais

`as_register`, edição, exclusão, emissão/redeem de token, configurações, sorteio, reinício e limpeza bloqueiam a linha do evento. O sorteio valida a revisão e a totalidade dos pares antes de gravar. A consulta final usa `FOR SHARE`, revalida o hash atual e exige a rodada correspondente. Essas operações seguem a mesma ordem de locks, coordenando limpeza/consulta/troca de código.

`as_clear_database(revision)`:

1. Bloqueia o evento `FOR UPDATE` e confere a revisão.
2. Apaga registros de `as_assignments`, `as_recovery_tokens`, `as_gifts` e `as_participants`.
3. Atualiza apenas `draw_id=NULL`, `draw_at=NULL`, `registrations_open=true` e incrementa `revision`.
4. Retorna o estado administrativo. Qualquer falha reverte todas as alterações.

Não usa DROP TABLE/TRUNCATE e não toca contas Auth, configurações do conteúdo, estrutura, funções, políticas, permissões, contadores de tentativas nem tabelas alheias à aplicação. É uma aplicação de evento único: os quatro conjuntos apagados pertencem a esse evento. Transformar o produto em multievento exigirá rever esse escopo.

`as_reset_draw` permanece separado: apaga somente pares, mantém participantes/códigos e não reabre inscrições.

## Privilégios

RLS restritiva para `anon`/`authenticated`; acesso direto a tabelas revogado. As RPCs usam `SECURITY DEFINER SET search_path=''`, referências qualificadas e EXECUTE exclusivamente para `service_role`. A rota Next.js valida o administrador antes de chamar as RPCs administrativas. Um token comum do Supabase Auth não ganha direito de executar a limpeza.

A migração substitui três assinaturas obsoletas (`as_register(text,text[],text)`, `as_reset_code(uuid,text)`, `as_find_participant(text)`) e configura privilégios somente das funções conhecidas da aplicação. Funções e permissões de outros sistemas não são alteradas. NOTIFY solicita atualização do cache de schema do PostgREST.

## Migração e validação

Os testes criam um schema v1 isolado com participantes, sugestões, sorteio e um registro de Auth de fixture, aplicam a migração duas vezes e verificam preservação e acesso por código antigo. Verificam também roles negadas, novas RPCs, rollback da limpeza com falha provocada e um ciclo completo após limpar.

Nenhum desses testes usa a base real do usuário. PGlite executa SQL PostgreSQL, mas não prova concorrência de conexões nativas nem o transporte PostgREST/Auth hospedado. A evidência e os testes pulados estão em [TESTES.md](TESTES.md).

## Backup e retorno de versão

Antes de migrar uma base importante, mantenha uma cópia recuperável do banco e da configuração. Não basta copiar a pasta do aplicativo. O CSV não contém códigos/sorteio.

Voltar apenas ao código antigo depois da migração não funciona, pois as assinaturas das funções mudaram. Para um rollback, pare todos os servidores e restaure uma cópia consistente da base anterior junto com o código e a configuração correspondentes. Isso também descarta dados criados após aquele backup. Nunca use a função de limpeza como substituto de rollback de migração.
