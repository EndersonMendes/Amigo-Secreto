# Segurança e privacidade

## Quem pode acessar

| Perfil | Dados e operações permitidos |
| --- | --- |
| Visitante | Configurações públicas, quantidade de inscritos e lista somente com nomes. |
| Participante com nome selecionado e código válido | Nome e três sugestões da pessoa sorteada para sua inscrição. |
| Administrador autenticado e autorizado | Configurações, inscrições, CSV, sorteio, pares por ação explícita, reinício, links para redefinição e limpeza confirmada. Nenhum código de participante é exibido ou recuperado. |

Supabase Auth valida a sessão no servidor por `getUser()`. O e-mail precisa estar confirmado e corresponder a `ADMIN_EMAIL`. Esconder botões na interface não é o controle de acesso: cada rota administrativa exige essa autorização. As contas do Auth não são registros de participantes e não são apagadas na limpeza.

Quem administra o evento pode ver os pares pelo painel. Não há criptografia ponta a ponta do sorteio. Quem controla o servidor, seus segredos e o banco possui privilégios superiores aos de um participante; as garantias do painel não impedem um operador de alterar o próprio sistema.

## Banco e credenciais

Tabelas com RLS restritiva e privilégios diretos revogados para `anon`, `authenticated` e `service_role`. RPCs privilegiadas recebem `EXECUTE` somente para `service_role`; usam `SECURITY DEFINER` e `search_path` vazio. O navegador chama as rotas Next.js, sem acesso direto às tabelas. A chave `SUPABASE_SECRET_KEY` é exclusivamente do servidor. Módulos sensíveis importam `server-only`.

Não há chave real no ZIP. As sete variáveis estão em `.env.example`; nenhuma usa `NEXT_PUBLIC_`. O código não registra corpos, senhas, tokens, códigos ou mensagens brutas do SDK nas falhas da API. O script de diagnóstico do Supabase também evita imprimir detalhes de credenciais.

## Códigos escolhidos

- Novos códigos: 4 a 128 dígitos ASCII (`0–9`), sem remover espaços ou hífens; zeros iniciais são parte do código.
- Verificador `scrypt-v2`: salt aleatório de 16 bytes, `N=32768`, `r=8`, `p=1`, saída de 32 bytes e limite de memória de 64 MiB. Antes do scrypt, HMAC-SHA256 usa `CODE_LOOKUP_SECRET` como segredo do servidor.
- Outro domínio HMAC gera `code_fingerprint`, com índice único. A unicidade não depende de comparar hashes com salts diferentes; funciona também entre requisições simultâneas.
- O código original não fica no banco. Cadastro e redefinição retornam somente `{name}`; a tela de confirmação usa temporariamente o que o próprio participante digitou. Não há recuperação administrativa.
- `CODE_LOOKUP_SECRET` deve ser diferente de `RATE_LIMIT_SECRET`, estável e compartilhado pelas instâncias que acessam o mesmo banco. Sua perda/troca exige redefinição dos códigos numéricos. Não há rotação automática com múltiplas versões de chave.
- Códigos de quatro dígitos têm poucas combinações. O segredo do servidor protege contra testar combinações usando apenas uma cópia do banco; cotas persistentes restringem tentativas online. A proteção não equivale à entropia dos códigos aleatórios antigos.

Códigos longos anteriores conservam o verificador scrypt original e sua normalização (maiúsculas/minúsculas, espaços e hífens). Enquanto houver códigos antigos, novos códigos de exatamente 32 dígitos são recusados de forma explícita para impedir coincidências não detectáveis a partir dos hashes antigos. Demais tamanhos válidos continuam disponíveis. Depois da migração dos participantes por redefinição, ou da limpeza, 32 dígitos também é permitido. A consulta com o código antigo não sofre essa restrição.

## Lista pública e homônimos

`GET /api/participants` retorna apenas `string[]`, agrupado pela chave de nome normalizada no PostgreSQL. UUIDs, hashes, impressões HMAC, datas, sugestões e pares não fazem parte da resposta. A lista fica disponível para visitantes por requisito do evento.

Para nomes iguais, o código único seleciona o cadastro correspondente. O serviço verifica o scrypt antes de pedir o resultado. O destinatário só sai de `as_reveal` após revalidar o hash atual; a função também bloqueia a linha do evento em leitura, serializando com limpeza e troca de código. Um código de outra pessoa com outro nome não autoriza a consulta.

Cadastros novos aceitam homônimos. Um índice parcial mantém no máximo um verificador legado por nome normalizado, evitando executar centenas de scrypts para uma consulta. Antes de editar dois cadastros legados para o mesmo nome, redefina o código de um deles.

## Redefinição sem mostrar código ao administrador

1. A organização confirma a identidade por um contato já conhecido. O nome público, sozinho, não comprova identidade.
2. Em Participantes, gera um link de redefinição. O código atual permanece válido até a conclusão da troca.
3. O token do link possui 256 bits aleatórios; somente seu SHA-256 com domínio específico fica no banco. Expira em 30 minutos, é de uso único, e emitir outro link invalida o anterior.
4. O token está no fragmento `#token=...`, que não é enviado na requisição da página. A tela o remove do histórico e o mantém somente em memória; envia-o no corpo do POST protegido por origem. Recarregar exige abrir novamente o link completo.
5. O participante escolhe um código ainda não usado. A mesma transação altera o verificador, reserva a impressão HMAC, elimina o token e incrementa a revisão. O código anterior deixa de funcionar, sem mudar os pares.

O link concede poder de redefinição e deve ser entregue apenas à pessoa correta. Ele não revela o código atual. Limpeza/exclusão do cadastro elimina também seus tokens. Expiração é conferida pelo relógio do PostgreSQL.

## Limites de tentativas

Contadores PostgreSQL são incrementados atomicamente e têm identificadores HMAC. Não armazenam IP ou nome em texto nas chaves. Registros antigos são eliminados após 48 horas. Limpar a base do evento **não zera essas cotas**.

| Operação | Cota |
| --- | --- |
| Cadastro | 20 por IP em 1 hora. |
| Consulta | 60 por IP e 10 por nome normalizado no banco em 15 minutos. Homônimos e aliases Unicode compartilham a cota do nome. |
| Login | 10 por IP e 10 por e-mail em 15 minutos. |
| Concluir redefinição | 20 por IP e 10 por token em 15 minutos. |

A API retorna HTTP 429 e `Retry-After`. O IP da infraestrutura Vercel é aceito apenas no ambiente identificado; em outras hospedagens usa-se uma cota compartilhada conservadora. Não confia arbitrariamente em `x-forwarded-for` fornecido pelo visitante. Pessoas na mesma rede podem compartilhar bloqueios. Ataques distribuídos e indisponibilidade não são eliminados por essas cotas.

## Validação e preço

Nome 2–100 caracteres; três sugestões diferentes de 1–160 caracteres; normalização NFC e espaços; bloqueio de caracteres de controle; máximo de 1.000 participantes. Mantém sorteio com pelo menos duas pessoas, sem autoatribuição e com um destinatário por participante.

Validação adicional reconhece preços explícitos após `R$`: inteiros, uma ou duas casas com vírgula ou ponto, ou milhar brasileiro com ponto e decimal opcional com vírgula. Exemplos: `R$ 50`, `R$ 50,00`, `R$ 50.00` aceitos; `R$ 50,01`, `R$ 51`, `R$ 1.000,00` recusados. O limite é por item, nunca a soma das três sugestões. Implementado na interface, no serviço e nas RPCs PostgreSQL de cadastro/edição.

Não consulta preços de lojas. Texto sem preço e notações ambíguas/não suportadas não são comprovação do valor real e não são validados como preço. Dados antigos são preservados pela migração; editar sugestões passa a exigir a regra atual.

## Limpeza e concorrência

A rota `POST /api/admin/clear` exige autenticação administrativa, origem válida, frase exata e revisão atual. A RPC recebe somente a revisão já validada no servidor e pode ser executada apenas pelo papel de serviço. Bloqueia a linha do evento e apaga, em ordem, pares, tokens, sugestões e participantes. Atualiza somente estado do sorteio, abertura das inscrições e revisão. Erro em qualquer etapa reverte tudo, incluindo exclusões anteriores.

Não usa `DROP TABLE` nem `TRUNCATE`. Não toca `auth.users`, configurações de conteúdo, tabelas de outros aplicativos, funções ou permissões. Um sorteio calculado com revisão anterior não pode ser gravado depois da limpeza. O aplicativo não mantém histórico recuperável dos pares apagados.

Essa remoção não apaga screenshots, CSVs, respostas já entregues, lembranças dos participantes ou backups/snapshots administrados fora do aplicativo. Não é uma operação de eliminação forense dos arquivos do PostgreSQL. Uma restauração administrativa de backup antigo pode trazer dados antigos de volta; a retenção desses backups é responsabilidade da infraestrutura.

**Reiniciar sorteio** continua sendo outra função: apaga apenas os pares e mantém participantes/códigos e inscrições fechadas. **Limpar base** apaga todos os dados de participação e reabre inscrições.

## Transporte e interface

Mutações JSON exigem `Origin` correspondente a `APP_URL`, corpo de até 16 KiB e esquema estrito. Respostas usam `private, no-store`. Sessões usam cookies HttpOnly, SameSite=Lax e Secure em HTTPS. Produção pública exige origem HTTPS. Exportação CSV não inclui códigos/hashes/pares e protege células que poderiam ser interpretadas como fórmulas.

Códigos e resultados ficam temporariamente em estado React, sem `localStorage`, `sessionStorage` ou URL. Fechar/atualizar elimina a exibição local; isso não apaga o cadastro no Supabase nem revoga cópias externas já vistas.

Veja [TESTES.md](TESTES.md) para evidências e limites da verificação. Nenhuma limpeza foi executada no Supabase do usuário durante o desenvolvimento.
