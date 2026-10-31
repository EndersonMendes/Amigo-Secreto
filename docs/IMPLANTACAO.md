# Instalação e publicação, passo a passo

Este guia parte de um computador Windows e do ZIP entregue. Você vai preparar o computador, criar o banco, configurar a conta da organização, testar localmente e publicar o site.

**Não execute arquivos dentro da visualização do ZIP. Extraia tudo primeiro.** “Terminal” é a área em que você digita comandos. “Pasta do projeto” é a pasta que contém `package.json`. “Deploy” é a publicação de uma versão do site.

Os nomes dos menus dos serviços podem mudar. Os links oficiais ao fim deste documento ajudam a localizar a opção equivalente.

> **Atualização de uma instalação existente:** use primeiro [ATUALIZACAO.md](../ATUALIZACAO.md). Não crie outro evento nem rode SQL de instalação sobre a base ativa.

## 1. Instalar os programas

1. Acesse [nodejs.org/en/download](https://nodejs.org/en/download), selecione **Node.js 24 LTS** e baixe o instalador para Windows. O npm acompanha a instalação. Este projeto está configurado para a série 24.x; não escolha versões antigas ou experimentais.
2. Instale o [Visual Studio Code](https://code.visualstudio.com/download).
3. Para a publicação, instale também o [Git para Windows](https://git-scm.com/downloads/win). Você pode manter as opções padrão do instalador.
4. Feche e reabra o VS Code depois de instalar os programas, para que o terminal reconheça os novos comandos.

Não é necessário instalar PostgreSQL, Docker ou a ferramenta de linha de comando do Supabase para colocar o aplicativo em funcionamento.

## 2. Extrair e abrir a pasta

1. No Explorador de Arquivos, clique com o botão direito no ZIP e escolha **Extrair Tudo**.
2. Escolha uma pasta simples, por exemplo `C:\Projetos\amigo-secreto-natal`.
3. Abra o VS Code. Use **File → Open Folder / Arquivo → Abrir Pasta**.
4. Selecione a pasta que contém `package.json`, `.env.example`, `src` e `supabase`. Dependendo da extração, ela pode estar dentro de outra pasta de mesmo nome.
5. Use **Terminal → New Terminal / Novo Terminal**. Os comandos abaixo precisam ser executados nessa pasta, não na pasta Downloads nem na pasta acima dela.
6. Digite, uma linha de cada vez:

```sh
node --version
npm --version
git --version
```

O primeiro deve mostrar `v24...`. Se aparecer “não é reconhecido”, reinstale o programa correspondente e reabra o VS Code. Se o PowerShell bloquear `npm.ps1`, use `npm.cmd` no lugar de `npm` em todos os comandos deste guia. Outra opção é clicar na seta ao lado do `+` do terminal e abrir **Command Prompt / Prompt de Comando**. Não é necessário liberar a execução de scripts no Windows.

## 3. Criar o projeto Supabase

O Supabase guarda os cadastros e resultados e cuida da entrada do administrador. Use um projeto novo e exclusivo para este evento.

1. Acesse [supabase.com](https://supabase.com/) e crie sua conta ou entre nela.
2. No painel, crie uma organização se for solicitado e escolha o plano **Free**, se ele atender ao seu uso.
3. Clique em **New project**.
4. Dê um nome, como `amigo-secreto-natal`.
5. Crie uma senha forte para o banco e guarde-a em um gerenciador de senhas. Essa senha não é a senha de entrada da organização no site.
6. Escolha uma região próxima das pessoas que usarão o evento e crie o projeto.
7. Aguarde o painel indicar que o projeto está pronto.

O [plano gratuito do Supabase](https://supabase.com/pricing) tem cotas e pode pausar projetos após uma semana sem atividade. Antes do evento, abra o painel, confira se o projeto está ativo e faça uma consulta de teste pelo site. Não há garantia de disponibilidade contínua de um plano gratuito.

### Instalar o banco uma única vez

1. No VS Code, abra `supabase/schema.sql`.
2. Selecione todo o conteúdo (`Ctrl+A`) e copie (`Ctrl+C`).
3. No painel do **projeto correto** do Supabase, abra **SQL Editor** e crie uma consulta nova.
4. Cole o conteúdo completo do arquivo. Não cole apenas uma parte nem as marcações de um bloco Markdown.
5. Execute com **Run** e aguarde a confirmação de sucesso.
6. Guarde a consulta se desejar, mas não clique novamente em Run para “abrir o site”, “reiniciar” ou “corrigir” um erro sem antes entender o problema.

`schema.sql` é a instalação inicial, não um botão de reset nem um conjunto de migrações para reaplicar em qualquer banco. **Não o execute cegamente de novo, especialmente depois que houver inscrições.** Se ocorrer um erro, leia a mensagem e confirme o projeto selecionado. Não apague tabelas para tentar resolver. Um novo evento completamente separado deve usar outra instalação/projeto; um novo sorteio do mesmo grupo usa o botão do painel.

### Copiar a URL e as chaves corretas

No projeto Supabase, use **Connect** para localizar a URL do projeto e a chave publicável. Para todas as chaves, abra **Settings → API Keys**. Em versões diferentes do painel, essas opções podem aparecer sob configurações de API.

Você precisará destes três valores:

| Valor no Supabase | Variável do projeto |
| --- | --- |
| Project URL, terminada em `.supabase.co` | `SUPABASE_URL` |
| Publishable key, começando com `sb_publishable_` | `SUPABASE_PUBLISHABLE_KEY` |
| Secret key, começando com `sb_secret_` | `SUPABASE_SECRET_KEY` |

Se o projeto só mostrar chaves legadas, use `anon` no lugar da publicável e `service_role` no lugar da secreta, mantendo os nomes das variáveis deste projeto. Não use a senha do banco em nenhuma dessas três variáveis. Não copie chaves de um projeto e a URL de outro.

A chave secreta dá acesso privilegiado aos dados. Cole-a somente no `.env.local` do seu computador e nas variáveis do servidor na Vercel. Não a coloque no código, em capturas de tela, na página pública ou no GitHub, mesmo em repositório privado.

## 4. Criar a conta da organização

Participantes se inscrevem pelo formulário do evento e escolhem códigos. Eles **não precisam** criar contas no Supabase Auth. A única conta de autenticação necessária para este guia é a da organização.

1. No Supabase, abra **Authentication → Users**.
2. Use **Add user → Create new user** (ou a opção equivalente de criar usuário manualmente).
3. Informe um e-mail seu, que será usado exclusivamente como administrador autorizado desta instalação.
4. Defina uma senha longa e exclusiva; prefira uma senha aleatória guardada em um gerenciador. Não reutilize a senha do banco ou de outra conta.
5. Ao criar, marque **Auto Confirm User / confirmar e-mail**, se disponível. Confira nos detalhes do usuário que o e-mail está confirmado. Esta aplicação exige a confirmação no servidor; criar o endereço sem confirmá-lo não basta.
6. Em **Authentication → Sign In / Providers** ou nas configurações gerais de autenticação, deixe o provedor **Email** habilitado e desative **Allow new users to sign up / permitir novos cadastros**. Mantenha a confirmação de e-mail exigida. Salve.
7. Copie o mesmo e-mail para `ADMIN_EMAIL`, na próxima etapa.

Desativar os cadastros de autenticação não fecha as inscrições de participantes do amigo secreto. São funções diferentes. O administrador já criado continua podendo entrar.

O projeto não tem uma tela pública de criação de administrador nem um fluxo próprio de recuperação da senha administrativa. Guarde a senha e mantenha acesso à conta que administra o projeto Supabase. Se precisar recuperar esse acesso, use os recursos do seu projeto Supabase; não edite o código para desativar a verificação de administrador.

## 5. Criar o arquivo de configuração

1. No painel de arquivos do VS Code, copie `.env.example` e cole na mesma pasta.
2. Renomeie a cópia para **`.env.local`**. O ponto inicial faz parte do nome. Não use `.env.local.txt`. O Explorador do Windows pode esconder extensões; o VS Code mostra o nome completo.
3. Abra `.env.local` e substitua os valores de exemplo. Preserve os nomes à esquerda de `=`.

O conteúdo terá este formato, com **os seus valores reais** no lugar das indicações:

```dotenv
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICAVEL
SUPABASE_SECRET_KEY=SUA_CHAVE_SECRETA
ADMIN_EMAIL=seu-email@exemplo.com
RATE_LIMIT_SECRET=SEU_SEGREDO_ALEATORIO_DE_64_CARACTERES
CODE_LOOKUP_SECRET=OUTRO_SEGREDO_ALEATORIO_DE_64_CARACTERES
APP_URL=http://localhost:3000
```

Para gerar o segredo da quinta linha, execute no terminal:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copie os 64 caracteres mostrados e cole após `RATE_LIMIT_SECRET=`. Gere o seu próprio valor: não use literalmente o texto do exemplo. Esse segredo protege os identificadores usados nos limites de tentativas; não é a senha do administrador.

Execute o comando novamente e preencha `CODE_LOOKUP_SECRET` com **outro valor**. Esse segredo protege os códigos numéricos. Guarde-o e use o mesmo valor em toda instalação que acesse este banco; trocá-lo exige redefinir os códigos dos participantes.

Salve com `Ctrl+S`. As **sete variáveis são obrigatórias**, e nenhuma deve ganhar o prefixo `NEXT_PUBLIC_`. `SUPABASE_PUBLISHABLE_KEY` identifica o projeto para a autenticação; `SUPABASE_SECRET_KEY` é usada exclusivamente pelo servidor para as operações do evento.

### Entender `APP_URL`

`APP_URL` é o endereço exato pelo qual os formulários devem ser abertos. A aplicação rejeita envios que venham de uma origem diferente.

| Onde o site está rodando | Exemplo de `APP_URL` |
| --- | --- |
| Seu computador | `http://localhost:3000` |
| Publicação oficial na Vercel | `https://seu-evento.vercel.app` |
| Domínio próprio, depois de configurado | `https://amigo.seudominio.com.br` |

Use apenas protocolo e domínio, com porta quando necessária; sem `/admin`, sem parâmetros e sem barra final. `localhost`, `127.0.0.1` e um endereço IP da rede são origens diferentes. No guia local, abra exatamente `http://localhost:3000`. Se mudar a porta, atualize `APP_URL` e reinicie o servidor.

## 6. Instalar e abrir no computador

No terminal, execute:

```sh
npm ci
```

Esse comando baixa as versões de dependências registradas em `package-lock.json`. Precisa de internet e pode levar alguns minutos. Espere terminar antes do próximo comando. Não copie uma pasta `node_modules` de outro computador.

Depois, execute:

```sh
npm run dev
```

Quando o terminal indicar que está pronto, abra [http://localhost:3000](http://localhost:3000). Não feche o terminal. Acesse [http://localhost:3000/admin/login](http://localhost:3000/admin/login) e entre com o e-mail e a senha da etapa 4.

Confira se consegue abrir as configurações, alterar uma mensagem e salvar. O conteúdo deve aparecer na página inicial após recarregá-la. Isso confirma uma operação real no seu banco, não apenas que o desenho da página abriu.

Para parar o servidor, use `Ctrl+C`. Sempre que editar `.env.local`, pare e execute `npm run dev` novamente. Se a porta 3000 estiver ocupada, encerre a outra instância antes de continuar ou ajuste também `APP_URL` para a porta utilizada.

**O modo local também grava no Supabase que você configurou.** Faça um ensaio em um projeto de teste separado se já houver um evento real no banco.

### Conferir os arquivos antes da publicação

Pare o servidor e rode uma linha por vez:

```sh
npm run typecheck
npm test
npm run build
```

Se alguma etapa falhar, resolva a mensagem antes de compartilhar o site. Um build concluído não confirma as credenciais nem substitui o ensaio com o Supabase hospedado. O relatório [TESTES.md](TESTES.md) distingue os testes executados das verificações que dependem da sua conta.

Os testes de banco usam uma base temporária. Por padrão, o helper tenta PostgreSQL nativo; ao executar como `root` em Linux, seleciona PGlite automaticamente. Para outros ambientes restritos, você pode escolher PGlite com `TEST_DATABASE_ENGINE=wasm`; nesse modo, os testes de bloqueio entre conexões nativas ficam marcados como pulados. Não há mudança automática para PGlite após qualquer erro do modo nativo.

Para exigir o PostgreSQL nativo, use uma destas formas:

No **Prompt de Comando do Windows**:

```bat
set TEST_DATABASE_ENGINE=native
npm test
set TEST_DATABASE_ENGINE=
```

No **PowerShell**:

```powershell
$env:TEST_DATABASE_ENGINE = "native"
npm.cmd test
Remove-Item Env:TEST_DATABASE_ENGINE
```

O modo nativo depende de binários compatíveis, permissões de criação de processos e disponibilidade de uma porta local. No Linux, PostgreSQL não inicia como `root`; use uma conta sem privilégios. Não coloque o endereço do banco de produção nos testes para contornar problemas do ambiente. Não confunda testes pulados com testes aprovados.

Se o ambiente não permitir o banco nativo e você quiser executar a cobertura disponível em PGlite, repita os comandos acima substituindo `native` por `wasm`. O relatório precisa registrar essa escolha e os testes pulados; uma execução em PGlite não confirma concorrência entre conexões PostgreSQL nativas.

## 7. Enviar o código para um GitHub privado

O repositório é uma cópia versionada dos arquivos do código. Dados dos participantes ficam no Supabase; não são enviados junto com o código.

1. Entre no [GitHub](https://github.com/) e escolha **New repository**.
2. Nomeie como `amigo-secreto-natal` ou outro nome de sua preferência.
3. Marque **Private**.
4. Como você já tem os arquivos, não adicione README, licença ou `.gitignore` pelo formulário do GitHub. Crie um repositório vazio.
5. Copie o endereço HTTPS indicado, por exemplo `https://github.com/SEU-USUARIO/amigo-secreto-natal.git`.
6. No terminal do VS Code, na pasta do projeto, execute:

```sh
git init
git branch -M main
git check-ignore .env.local
```

O último comando deve mostrar `.env.local`: isso confirma que ele está na lista de exclusão. Se não mostrar, confira se o arquivo `.gitignore` do ZIP está presente. Não prossiga com uma configuração real que não esteja excluída.

Prepare os arquivos e revise a lista:

```sh
git add .
git diff --cached --name-only
```

Na lista pode aparecer `.env.example`, que contém apenas exemplos. **Não devem aparecer `.env.local`, outros arquivos com credenciais, `node_modules` ou `.next`.** Não use `git add -f` para forçar a inclusão de arquivos ignorados. Também não preencha `.env.example` com seus segredos.

Se tudo estiver correto:

```sh
git commit -m "Adicionar aplicativo de amigo secreto"
git remote add origin https://github.com/SEU-USUARIO/amigo-secreto-natal.git
git push -u origin main
```

Substitua `SEU-USUARIO` e o nome do repositório pelo endereço real copiado. Se o Git pedir identificação para o commit, configure somente este projeto e repita o commit:

```sh
git config user.name "Seu nome"
git config user.email "seu-email@exemplo.com"
```

Se aparecer uma janela para entrar no GitHub, siga o login do navegador. Não digite chaves do Supabase nem coloque senhas dentro do endereço do repositório. Depois do envio, atualize a página do GitHub e confirme que os arquivos estão presentes e que o repositório continua privado.

Se alguma chave secreta já foi enviada por engano, apagá-la no commit seguinte não remove o segredo do histórico. Revogue/substitua a chave no Supabase, atualize os ambientes e trate também o histórico do repositório antes de continuar.

## 8. Publicar na Vercel

O [plano Hobby da Vercel](https://vercel.com/docs/plans/hobby) é restrito a uso pessoal e não comercial. Um pequeno evento pessoal pode seguir este caminho gratuito, respeitando as cotas. Confira os termos e escolha um plano adequado se o uso for comercial. Não é necessário comprar domínio.

1. Entre em [vercel.com](https://vercel.com/) com sua conta.
2. Escolha **Add New → Project** e conecte sua conta GitHub.
3. Autorize acesso ao repositório privado criado. Se puder escolher, conceda acesso somente a esse repositório.
4. Selecione **Import** no repositório.
5. Confira o **Framework Preset: Next.js**.
6. Confira a **Root Directory**: ela deve ser a pasta em que está `package.json`. Se os arquivos foram enviados na raiz do repositório, mantenha a raiz.
7. Mantenha a configuração padrão de saída do Next.js; não selecione `out` nem publique como site HTML estático. A aplicação precisa das rotas de servidor.
8. Use **Node.js 24.x**. O `package.json` e o arquivo `.nvmrc` do projeto indicam essa série. Se a opção não aparecer na importação, confira depois em **Settings → Build and Deployment → Node.js Version** e faça um novo deploy.
9. Expanda **Environment Variables** e adicione as sete variáveis. Escolha o ambiente **Production**. Marque as chaves secretas como **Secret/Sensitive**, se essa opção estiver disponível.

Use os mesmos valores do `.env.local`, **exceto `APP_URL`**, que deve receber o endereço oficial HTTPS da Vercel. Exemplo: `https://seu-evento.vercel.app`. A Vercel não recebe automaticamente o `.env.local` ignorado pelo Git.

Se você ainda não souber o domínio definitivo, configure a origem esperada a partir do nome do projeto, faça a primeira publicação e corrija-a imediatamente com o endereço confirmado no painel. Não compartilhe nem teste envios de formulário até concluir o ajuste e o novo deploy.

10. Clique em **Deploy** e aguarde concluir.
11. Abra **Settings → Domains** ou o resumo do projeto e copie o domínio de produção. Prefira o endereço estável do projeto; não o endereço temporário de uma publicação nem uma URL de preview.
12. Vá a **Settings → Environment Variables**, confira `APP_URL` e corrija para a origem exata, sem barra final.
13. Se mudou uma variável ou versão de Node, vá a **Deployments**, abra o menu da publicação e escolha **Redeploy** para produção. Aguarde terminar. Alterações de variáveis só entram em uma nova publicação.
14. Abra o site pelo domínio oficial em uma nova aba e teste a entrada em `/admin/login`.

Mantenha `APP_URL=http://localhost:3000` no `.env.local` do computador e o endereço público nas variáveis de produção da Vercel. Uma configuração não precisa substituir a outra.

Se usar um domínio próprio futuramente, configure-o primeiro na Vercel, espere o HTTPS funcionar, atualize `APP_URL` e publique novamente. Use uma única origem oficial para os formulários. Uma URL de preview diferente será rejeitada se usar `APP_URL` de produção. Para ensaios em previews, configure um ambiente próprio com origem e banco de teste próprios.

## 9. Fazer o ensaio e abrir o evento

Antes de divulgar o endereço:

1. Entre pelo endereço oficial e confira nome, data e mensagens no painel.
2. Em um projeto de teste, abra as inscrições, cadastre pelo menos duas pessoas fictícias com três sugestões cada e guarde os códigos.
3. Feche o navegador, reabra e confira se os registros permanecem no painel.
4. Encerre as inscrições e realize o sorteio com `REALIZAR SORTEIO`.
5. Em uma janela privada, consulte cada participante e confira se recebe somente o destinatário e suas sugestões.
6. Verifique que ninguém tirou a si mesmo e que não é possível executar um segundo sorteio por engano.
7. Gere um link de redefinição para uma pessoa de teste, abra-o e escolha outro código: depois da confirmação, o antigo deve parar de funcionar e o novo deve mostrar o mesmo destinatário.
8. Termine o ensaio no projeto de teste. Na instalação real, abra inscrições e compartilhe apenas a página inicial oficial.

Se fez o ensaio no banco que será usado de verdade, não deixe pessoas fictícias na lista. Reinicie o sorteio, se houver um, exclua os cadastros de teste pelo painel e confira a lista vazia antes de abrir as inscrições reais. Isso remove os resultados do ensaio e deve ser feito antes de convidar participantes.

A operação cotidiana — fechar inscrições, sortear, consultar e reiniciar — está explicada no [README](../README.md#usar-o-evento-pela-primeira-vez). Reiniciar preserva participantes e códigos e deixa as inscrições fechadas. Para começar outra lista, use **LIMPAR BASE DE DADOS** no painel; após confirmação explícita, ela remove inscrições e resultados e reabre o cadastro, preservando as configurações.

## Problemas frequentes

| O que aparece | O que conferir |
| --- | --- |
| `npm` não é reconhecido | Node.js instalado; terminal fechado e reaberto. |
| PowerShell bloqueia `npm.ps1` | Use `npm.cmd` ou o Prompt de Comando. |
| “Não foi possível encontrar package.json” | O terminal está na pasta que contém esse arquivo? |
| “O evento ainda não está disponível” | As sete variáveis estão completas, sem textos de exemplo? Reiniciou o servidor ou fez redeploy? |
| Página abre, mas dados não carregam | Projeto Supabase ativo, SQL instalado, URL e chaves do mesmo projeto. |
| “Reabra o site pelo endereço oficial” | `APP_URL` coincide exatamente com protocolo, domínio e porta usados no navegador? |
| Login recusado | E-mail igual a `ADMIN_EMAIL`, conta criada no Auth, e-mail confirmado e senha correta. |
| Inscrição acusa código existente | Escolha outro código. Novas inscrições podem ter nomes iguais. |
| Código desapareceu após atualizar | O cadastro permanece. Confirme a identidade e gere um link de redefinição pelo painel. |
| Resultado desapareceu após atualizar | Consulte novamente com nome e código. Não refaça o sorteio. |
| “Muitas tentativas” | Aguarde a janela do limite. Consulta: até 15 minutos; inscrição: até uma hora. Veja os limites em [SEGURANCA.md](SEGURANCA.md). |
| Muitas pessoas no mesmo Wi-Fi recebem bloqueio | Compartilham o limite por IP. Espalhe as tentativas no tempo; não remova a proteção. |
| Erro após dias sem uso | Confira no painel se o Supabase gratuito foi pausado e reative-o quando necessário. |
| Alterei uma variável e nada mudou | Reinicie `npm run dev` localmente; na Vercel, faça um novo deploy. |
| Teste nativo falha por processo, porta ou usuário root | Consulte [TESTES.md](TESTES.md); não altere o banco real para corrigir o ambiente de teste. |

## Fontes oficiais

- [Node.js: downloads](https://nodejs.org/en/download).
- [Supabase: banco e SQL Editor](https://supabase.com/docs/guides/database/overview).
- [Supabase: URL, chaves publicáveis e secretas](https://supabase.com/docs/guides/getting-started/api-keys).
- [Supabase: configurações de autenticação e novos cadastros](https://supabase.com/docs/guides/auth/general-configuration).
- [Supabase: autenticação com senha](https://supabase.com/docs/guides/auth/passwords).
- [Supabase: limites dos planos](https://supabase.com/pricing).
- [GitHub: criar um repositório](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository).
- [Vercel: importar projetos do GitHub](https://vercel.com/docs/git/vercel-for-github).
- [Vercel: variáveis de ambiente](https://vercel.com/docs/environment-variables).
- [Vercel: versões do Node.js](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
- [Vercel: condições do plano Hobby](https://vercel.com/docs/plans/hobby).
