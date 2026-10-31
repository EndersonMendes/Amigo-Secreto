# Relação de arquivos modificados

Comparação com a versão recebida em `Amigo_Secreto_Natal_Completo - Copia.zip`. Todos os demais arquivos-fonte foram preservados. `package.json` e `package-lock.json` mantêm as mesmas versões e dependências.

| Situação | Arquivo |
| --- | --- |
| Modificado | `.env.example` |
| Adicionado | `ARQUIVOS_MODIFICADOS.md` |
| Adicionado | `ATUALIZACAO.md` |
| Modificado | `README.md` |
| Modificado | `docs/ARQUITETURA.md` |
| Modificado | `docs/CONTRATOS.md` |
| Modificado | `docs/DATABASE.md` |
| Modificado | `docs/ESTRUTURA.md` |
| Modificado | `docs/IMPLANTACAO.md` |
| Modificado | `docs/REVISAO_TECNICA.md` |
| Modificado | `docs/SEGURANCA.md` |
| Modificado | `docs/TESTES.md` |
| Modificado | `src/app/(public)/consultar/page.tsx` |
| Modificado | `src/app/(public)/inscricao-concluida/page.tsx` |
| Modificado | `src/app/(public)/page.tsx` |
| Adicionado | `src/app/(public)/redefinir-codigo/page.tsx` |
| Modificado | `src/app/(public)/resultado/page.tsx` |
| Modificado | `src/app/admin/(protected)/page.tsx` |
| Modificado | `src/app/admin/(protected)/participantes/page.tsx` |
| Adicionado | `src/app/api/admin/clear/route.ts` |
| Adicionado | `src/app/api/participants/route.ts` |
| Adicionado | `src/app/api/reset-code/route.ts` |
| Modificado | `src/app/globals.css` |
| Adicionado | `src/components/access-code-fields.tsx` |
| Adicionado | `src/components/clear-database.tsx` |
| Modificado | `src/components/flow-provider.tsx` |
| Modificado | `src/components/participant-dialog.tsx` |
| Modificado | `src/components/participant-fields.tsx` |
| Modificado | `src/lib/backend.ts` |
| Modificado | `src/lib/client-api.ts` |
| Modificado | `src/lib/codes.ts` |
| Modificado | `src/lib/env.ts` |
| Modificado | `src/lib/errors.ts` |
| Adicionado | `src/lib/gift-limit.ts` |
| Modificado | `src/lib/service.ts` |
| Modificado | `src/lib/types.ts` |
| Modificado | `src/lib/validation.ts` |
| Adicionado | `supabase/migrations/20261031_numeric_codes_and_clear.sql` |
| Modificado | `supabase/schema.sql` |
| Modificado | `teste-supabase.mjs` |
| Modificado | `tests/api-integration.test.ts` |
| Modificado | `tests/auth.test.ts` |
| Modificado | `tests/database.test.ts` |
| Modificado | `tests/domain.test.ts` |
| Adicionado | `tests/fixtures/schema-v1.sql` |
| Modificado | `tests/helpers/postgres.ts` |
| Modificado | `tests/http.test.ts` |
| Adicionado | `tests/interface.test.ts` |
| Modificado | `tests/service.test.ts` |
| Adicionado | `tests/upgrade.test.ts` |

## Distribuição das alterações

- Interface: cadastro do código, confirmação temporária, lista de nomes, avisos de R$50, recuperação e diálogo de limpeza.
- Servidor: validação, hash com segredo, impressão HMAC única, rotas de nomes/limpeza/redefinição e autorização existente preservada.
- PostgreSQL: estrutura atual, migração transacional, homônimos, tokens, limpeza e permissões de RPC.
- Testes: atualização dos testes existentes e novos testes de migração, segurança, integração e renderização dos formulários.
- Documentação: migração, `.env.local`, substituição no computador, funcionamento, evidência e checklist.
- `teste-supabase.mjs`, acrescentado no ZIP do usuário, foi preservado e corrigido para ler `.env.local` com Node 24, sem depender de `dotenv` ausente no manifesto e sem imprimir erros brutos potencialmente sensíveis.

O arquivo gerado `next-env.d.ts` recebido no ZIP é recriado automaticamente por `npm run typecheck`, `npm run dev` ou `npm run build`, conforme o `.gitignore` original; não integra a distribuição. `node_modules` e `.next` também são gerados e não integram o ZIP. Nenhuma funcionalidade foi eliminada para reduzir a entrega.
