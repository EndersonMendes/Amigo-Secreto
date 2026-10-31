# Atualização do Amigo Secreto de Natal

Esta versão foi alterada diretamente a partir de **Amigo_Secreto_Natal_Completo - Copia.zip**. Preserva Next.js, TypeScript, Tailwind, Supabase Auth/PostgreSQL, login e painel administrativo, configurações, CSV, edição/exclusão de participantes, sorteio e reinício de rodada.

## O que mudou

- **Código escolhido no cadastro:** 4 a 128 números, com confirmação digitada, zeros iniciais preservados e rejeição de repetidos. O banco guarda scrypt com salt individual e segredo do servidor, além de HMAC para impedir repetições mesmo em cadastros simultâneos. A API não devolve o código: a confirmação usa apenas o valor que a pessoa acabou de digitar, temporariamente na memória.
- **Consulta por seleção:** a lista recebe somente nomes. Nomes iguais aparecem uma vez; o código único identifica a inscrição. Nenhum código, hash, UUID, presente ou destinatário entra na lista pública.
- **R$ 50,00 por presente:** aviso amigável na inscrição e no resultado. As três sugestões continuam obrigatórias e diferentes. Frontend, servidor e RPCs rejeitam valores explícitos reconhecidos acima de R$ 50. Texto sem preço continua permitido: o sistema não conhece o preço real de um produto.
- **Limpeza administrativa:** confirmação digitada, cancelamento e mensagem de sucesso. Uma única transação remove inscrições, sugestões, verificadores, links de redefinição e pares; reabre inscrições e preserva nome, mensagens, data, demais configurações e contas administrativas.
- **Código esquecido:** a organização gera um link temporário, e o próprio participante escolhe outro código. O administrador não visualiza o código atual nem o novo. O link é de uso único, expira em 30 minutos e pode ser substituído por outro. A troca só ocorre quando a pessoa conclui o formulário.

## Antes de substituir a versão no computador

1. No terminal do projeto antigo, pressione **Ctrl+C** para parar o servidor.
2. Preserve uma cópia da pasta antiga e do seu `.env.local`. Não compartilhe esse arquivo nem suas chaves.
3. Se o Supabase contém dados que precisam ser mantidos, tenha uma cópia de segurança recuperável antes da migração. O CSV não guarda códigos nem sorteio e não substitui um backup.
4. Extraia o novo ZIP em **outra pasta**, por exemplo `Amigo_Secreto_Natal_Atualizado`. Abra no VS Code a pasta que contém `package.json`. Não misture `node_modules` ou `.next` antigos com a nova pasta.
5. Copie seu `.env.local` antigo para essa nova pasta. Mantenha os valores existentes; adicione o segredo abaixo.

## Mudança no .env.local

Há **uma nova variável obrigatória**, somente de servidor:

```dotenv
CODE_LOOKUP_SECRET=COLE_AQUI_UM_NOVO_SEGREDO_DE_64_CARACTERES_HEXADECIMAIS
```

Gere o valor no terminal:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Use um valor **diferente de `RATE_LIMIT_SECRET`**. Não coloque o prefixo `NEXT_PUBLIC_`. Guarde o valor de forma segura e mantenha-o estável: perdê-lo ou trocá-lo impede validar os códigos numéricos existentes. Ao publicar, configure esse mesmo segredo no servidor que acessa o mesmo banco. Não gere valores diferentes para localhost e hospedagem se ambos usam o mesmo Supabase.

As seis variáveis anteriores continuam: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `ADMIN_EMAIL`, `RATE_LIMIT_SECRET`, `APP_URL`. Localmente, use `APP_URL=http://localhost:3000`.

## SQL no Supabase existente

1. Suspenda o uso da versão antiga durante a atualização. Não mantenha servidores antigos e novos gravando na mesma base; as assinaturas das RPCs de cadastro e acesso mudaram.
2. Abra seu projeto existente no **Supabase → SQL Editor → New query**.
3. Copie o conteúdo integral de **`supabase/migrations/20261031_numeric_codes_and_clear.sql`** e execute.
4. Aguarde a conclusão sem erros. O script usa uma transação, pode ser reaplicado e preserva os dados existentes. Não executa a limpeza automaticamente.
5. Não execute os arquivos de `tests/fixtures`: são somente modelos para testes isolados.
6. Em uma instalação completamente nova, execute **somente `supabase/schema.sql`**, que já inclui a estrutura atual. Não é necessário executar a migração depois dele.

A migração adiciona a impressão HMAC dos códigos, a tabela de links temporários, as funções novas e os controles de acesso. Troca as antigas RPCs de cadastro/redefinição/identificação pelas assinaturas atuais para impedir acessos que ignorem a unicidade. Isso não apaga cadastros, sorteios ou contas do Auth. **A função de limpeza, quando usada pelo painel, não remove tabelas, funções nem permissões.**

### Compatibilidade com códigos anteriores

Os códigos longos da versão anterior continuam funcionando. Como só existe seu hash, não é possível convertê-los de volta nem preencher suas impressões HMAC sem conhecer o código.

Para impedir coincidência com esses códigos antigos, **novos códigos com exatamente 32 dígitos ficam temporariamente indisponíveis enquanto houver algum cadastro com código antigo**. Os demais tamanhos de 4 a 128 são aceitos. Após cada participante antigo escolher outro código pelo link, ou após uma limpeza confirmada da base de testes, a restrição desaparece. Códigos antigos válidos nunca são rejeitados por essa restrição na consulta.

Novos participantes podem ter nomes iguais. Dois cadastros ainda com código antigo não podem ser editados para o mesmo nome normalizado até que um deles redefina o código; essa proteção evita verificações lentas e ambíguas.

## Instalar e abrir a nova versão

Execute uma linha de cada vez na nova pasta:

```sh
npm ci
npm run check
npm run dev
```

No PowerShell, se a execução de scripts estiver bloqueada, use `npm.cmd` no lugar de `npm`; não precisa mudar a política do Windows.

Abra `http://localhost:3000` e `http://localhost:3000/admin/login`. Use a mesma conta administrativa. A versão não exige criar outra conta. Para testar a conexão separadamente, execute `node teste-supabase.mjs`: o script agora lê `.env.local` diretamente com Node 24.

O comando `npm run check` usa bases locais temporárias para seus testes. Já o site aberto em localhost usa o Supabase indicado no `.env.local`, portanto **Limpar base de dados também apaga os dados desse Supabase**. Faça o ensaio em um projeto de testes.

## Como limpar os testes

1. Entre no painel administrativo.
2. No início do painel, localize **LIMPAR BASE DE DADOS**.
3. Leia o aviso. **Cancelar** fecha a confirmação sem alterar os dados.
4. Para prosseguir, digite `LIMPAR BASE DE DADOS` e confirme em **Apagar dados e reabrir inscrições**.
5. Confira a mensagem de sucesso, zero participantes, inscrições abertas e sorteio aguardando. O nome, a data e os textos devem continuar iguais.
6. Cadastre novas pessoas, encerre as inscrições e faça um novo sorteio normalmente.

A limpeza preserva contadores de tentativas para não permitir que ela contorne bloqueios de acesso. Se estiver testando muitas vezes pelo mesmo IP, aguarde a janela indicada pela aplicação.

## Testes antes de publicar

- [ ] Login com o administrador autorizado funciona; conta comum, sessão encerrada e visitante não acessam ações administrativas.
- [ ] Cadastro rejeita letras, espaços, menos de 4 números e confirmação divergente; aceita `0012`, quatro números e código maior.
- [ ] Dois cadastros não aceitam o mesmo código. Tente também enviar duas inscrições simultâneas com um código igual.
- [ ] Três sugestões continuam obrigatórias/diferentes; três itens de R$ 50,00 são aceitos, pois o limite não é uma soma. `Livro R$ 50,01` é rejeitado.
- [ ] Lista de consulta carrega os nomes e suporta dois novos cadastros com nome igual. Cada código acessa somente sua própria inscrição. Nome/código trocados não mostram destinatário.
- [ ] Com inscrições abertas, sorteio é bloqueado; com menos de duas pessoas também. Depois de fechar, sorteio ocorre uma vez, sem autoatribuição ou destinatário repetido.
- [ ] Aviso de R$ 50,00 aparece ao abrir o resultado. Atualizar/fechar a página exige nova consulta.
- [ ] Código antigo continua válido após a migração. Redefinição via link altera o código, mantém o destinatário e invalida o link usado e o código anterior. Link expirado ou substituído falha.
- [ ] Exportação CSV mantém nomes e sugestões, sem códigos/hashes/pares. Edição, exclusão, configurações e reinício do sorteio continuam funcionando.
- [ ] Cancelar a limpeza não muda nada. Confirmação incorreta, revisão antiga e requisição sem administrador não apagam nada.
- [ ] Confirmar limpeza apaga participantes, sugestões, verificadores, links e resultados, preservando personalizações e login. Códigos/links anteriores não funcionam. Uma nova rodada completa funciona.
- [ ] Muitas tentativas retornam HTTP 429; recarregar a página não remove o bloqueio.
- [ ] No navegador, em 320, 390, 768 e 1440 px, teste cadastro, dropdown, diálogo, teclado, foco, mensagens e ausência de rolagem horizontal.
- [ ] Confira no painel Network que `/api/participants` retorna apenas nomes e que respostas privadas usam `no-store`. Não há chaves secretas no JavaScript público.
- [ ] Execute `npm run check` no seu computador e teste também em uma instalação Supabase de homologação, antes da hospedagem definitiva.

Ao publicar, adicione `CODE_LOOKUP_SECRET` às variáveis da hospedagem, mantenha `APP_URL` igual à origem HTTPS oficial e faça novo deploy. Os resultados exatos das verificações desta entrega e suas limitações estão em [docs/TESTES.md](docs/TESTES.md). A lista completa de arquivos alterados está em [ARQUIVOS_MODIFICADOS.md](ARQUIVOS_MODIFICADOS.md).
