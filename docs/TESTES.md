# Verificação desta atualização

Verificação realizada em 31/10/2026 sobre a versão alterada a partir do ZIP do usuário.

## Resultado observado

`npm run check` terminou com código de saída 0:

- `next typegen && tsc --noEmit`: passou.
- `vitest run`: **9 arquivos passaram; 93 testes passaram e 5 foram pulados explicitamente**, total de 98 testes.
- `next build`: compilação de produção concluída; páginas e rotas novas incluídas (`/redefinir-codigo`, `/api/participants`, `/api/reset-code`, `/api/admin/clear`).
- `git diff --check`: passou.
- `node --check teste-supabase.mjs`: passou. A conexão real desse script não foi executada sem credenciais.
- Busca nos JavaScripts públicos gerados não encontrou `SUPABASE_SECRET_KEY`, `CODE_LOOKUP_SECRET`, `RATE_LIMIT_SECRET`, `amigo-code-verifier-v2` ou `scrypt-v2`.

O npm emitiu um aviso sobre a variável `http-proxy` herdada deste ambiente; não houve falha de compilação ou teste causada por ele. Não foi executada nova auditoria online de dependências nesta atualização; as versões e o lockfile recebidos foram preservados.

## Cobertura automatizada

| Arquivo | Comportamento verificado |
| --- | --- |
| `tests/domain.test.ts` | Validação, códigos numéricos/legados, zeros iniciais, tamanhos, pepper, presentes, sorteio, CSV. |
| `tests/security.test.ts` | Origem, IP confiável, autorização administrativa. |
| `tests/auth.test.ts` | Decisão de autorização com usuário confirmado, e-mail e sessão de fixture. |
| `tests/http.test.ts` | JSON, limites de corpo, origem, mensagens seguras e respostas privadas. |
| `tests/database.test.ts` | Constraints/RLS/RPCs, três sugestões, sorteios, persistência, cotas, bloqueios e revisões. |
| `tests/service.test.ts` | Cadastro/consulta com SQL, homônimos, código errado, revogação, cotas por nome canônico incluindo Unicode. |
| `tests/api-integration.test.ts` | Rotas reais com banco isolado, lista pública exata, cadastro/sorteio/consulta, admin negado, limpeza, nova rodada. |
| `tests/upgrade.test.ts` | Migração v1 aplicada duas vezes, dados/configurações/Auth de fixture/pares preservados, código legado, overloads revogados, preços no SQL, recuperação e limpeza transacional. |
| `tests/interface.test.ts` | Renderização React do dropdown e estados vazio/erro, três campos de presentes, aviso R$50, campos de código e validação cliente. |

A limpeza é testada com erro provocado após as primeiras exclusões: o rollback mantém todas as tabelas e configurações. O sucesso remove inscrições, verificadores, presentes, tokens e resultados, preserva contas/configurações/cotas e permite registrar/sortear de novo. Confirmação incorreta, revisão antiga, origem indevida e ausência de administrador são recusadas. Códigos e links antigos deixam de funcionar depois da limpeza.

A lista pública é comparada com nomes somente; códigos/hashes/UUIDs/presentes/destinatários não são retornados. Credencial trocada não obtém resultado de outro nome. Dois participantes com mesmo nome e códigos diferentes continuam identificáveis.

## Cinco testes nativos não executados aqui

O ambiente só disponibiliza UID root; PostgreSQL nativo exige usuário sem privilégios. A tentativa isolada de troca para `nobody` falhou com `setresuid: Invalid argument`. O helper usou PGlite, PostgreSQL compilado para WebAssembly, em diretório temporário.

Foram pulados explicitamente:

1. Cadastro concorrente com fechamento, em uma ordem de locks.
2. Fechamento concorrente com cadastro, na ordem oposta.
3. Dois sorteios concorrentes.
4. Dois cadastros concorrentes escolhendo o mesmo código.
5. Redefinições concorrentes e consulta bloqueada enquanto a limpeza conclui.

PGlite executa SQL e transações reais, mas sua fila não prova concorrência de múltiplas conexões. Não tratamos os cinco testes como aprovados. Os testes nativos usam espera limitada pela evidência de lock em `pg_stat_activity`, não somente ordem presumida de Promises.

Em um ambiente compatível, sem root, o helper escolhe PostgreSQL nativo automaticamente. Para exigir esse modo em PowerShell:

```powershell
$env:TEST_DATABASE_ENGINE="native"
npm.cmd test
```

Em shell Linux/macOS, sem root:

```sh
TEST_DATABASE_ENGINE=native npm test
```

Para o modo restrito em PowerShell:

```powershell
$env:TEST_DATABASE_ENGINE="wasm"
npm.cmd test
```

Os testes criam e removem bancos temporários; não leem o `.env.local` para alterar o Supabase real. O site em execução, por outro lado, utiliza o projeto Supabase configurado.

## Limites desta evidência

- O adaptador chama as RPCs diretamente no PostgreSQL isolado. Não valida o transporte HTTP PostgREST nem um login no Supabase Auth hospedado.
- Identidades administrativas de teste exercitam decisões reais de autorização com fixtures. O registro `auth.users` no teste de migração é uma fixture, não uma conta criada no serviço hospedado.
- O navegador conectado não ficou acessível neste ambiente. Os sete testes de interface renderizam HTML React e validam funções; não executam cliques, clipboard, foco, diálogo nativo ou responsividade em um navegador real.
- Não foi feita publicação, conexão ao Supabase do usuário nem limpeza em sua base real.
- Revisões independentes de código complementam os testes, sem constituir certificação externa.

Antes da hospedagem, execute a lista de homologação em [ATUALIZACAO.md](../ATUALIZACAO.md), incluindo a sequência cadastro → sorteio → consulta → limpeza → novo cadastro/sorteio, as cinco verificações nativas e os testes visuais em celular/computador.
