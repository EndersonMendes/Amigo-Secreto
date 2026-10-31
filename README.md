# Amigo Secreto de Natal 🎁

Site em português para organizar **um evento de amigo secreto por instalação**, com inscrição, três sugestões de presente, código individual e painel da organização. O projeto usa Next.js, TypeScript, Tailwind CSS e Supabase (PostgreSQL e autenticação).

**Já utiliza a versão anterior? Comece por [ATUALIZACAO.md](ATUALIZACAO.md), com o SQL de migração, a nova variável e o passo a passo de substituição.**

Para uma instalação nova, use o [guia de instalação e publicação](docs/IMPLANTACAO.md). Ele explica o caminho desde extrair o ZIP no Windows até compartilhar o endereço da Vercel, sem exigir experiência anterior com programação.

Este ZIP contém o código-fonte. Para funcionar, você precisa criar seu próprio projeto Supabase, instalar o SQL e preencher as variáveis de configuração. Não há credenciais reais nem site hospedado incluídos. As verificações realizadas e suas limitações estão em [docs/TESTES.md](docs/TESTES.md); não houve teste desta entrega com uma conta Supabase hospedada ou publicação Vercel fornecida pelo usuário.

## O que o site faz

- Recebe nome e exatamente três sugestões de presente diferentes.
- Permite escolher um código numérico pessoal de 4 a 128 dígitos, com proteção contra repetição e armazenamento por hash.
- Carrega uma lista pública somente com os nomes; o código continua obrigatório para consultar o resultado.
- Mostra o limite de R$ 50,00 por presente na inscrição e no resultado; valida valores explícitos em reais.
- Permite limpar a base pelo painel com confirmação, preservando as configurações do evento.
- Mostra ao participante somente quem ele vai presentear e as três sugestões dessa pessoa.
- Permite à organização configurar nome, mensagens e data do evento; abrir e encerrar inscrições; editar ou excluir participantes antes do sorteio; exportar a lista em CSV; substituir códigos perdidos; realizar e reiniciar o sorteio.
- Mantém participantes, configurações, verificadores dos códigos e resultados no banco Supabase. Fechar o navegador ou reiniciar o servidor não apaga esses registros.

O limite desta versão é de **1.000 participantes**. O sorteio exige **pelo menos duas pessoas**. Com duas, necessariamente uma tira a outra. Cada participante presenteia exatamente uma pessoa e é presenteado por exatamente uma pessoa; ninguém tira a si mesmo. Não há restrições extras de casais, famílias ou resultados de anos anteriores.

## O que você precisa

| Item | Para que serve |
| --- | --- |
| [Node.js 24 LTS](https://nodejs.org/en/download) | Executar o projeto no computador. Instale a versão 24.x para acompanhar este guia. |
| [Visual Studio Code](https://code.visualstudio.com/download) | Abrir a pasta, editar a configuração e usar o terminal. |
| Conta no [Supabase](https://supabase.com/) | Guardar os dados e autenticar a organização. |
| [Git](https://git-scm.com/downloads/win) e conta no [GitHub](https://github.com/) | Enviar o código a um repositório privado para publicar. |
| Conta na [Vercel](https://vercel.com/) | Publicar o site com HTTPS. |

Não são obrigatórios domínio próprio, Redis, serviço de e-mail pago ou assinatura paga para um pequeno evento pessoal dentro dos limites gratuitos. O [Vercel Hobby permite uso pessoal e não comercial](https://vercel.com/docs/plans/hobby). O [Supabase Free tem limites e pode pausar projetos após uma semana de inatividade](https://supabase.com/pricing). Consulte os planos antes de usar o site para uma organização ou finalidade comercial.

## Instalar no seu computador

O roteiro completo, incluindo os cliques no Supabase, está em [IMPLANTACAO.md](docs/IMPLANTACAO.md). A sequência resumida é:

1. Extraia o ZIP e abra no VS Code a pasta que contém `package.json`.
2. Crie um projeto no Supabase e execute `supabase/schema.sql` no SQL Editor **uma única vez, em um projeto novo destinado a este site**.
3. Crie manualmente a conta administrativa em Supabase Authentication, com e-mail confirmado; desative a criação pública de contas de autenticação.
4. Copie `.env.example` para `.env.local` e preencha as sete variáveis da tabela abaixo.
5. No terminal do VS Code, dentro da pasta do projeto, execute uma linha de cada vez:

```sh
npm ci
npm run dev
```

6. Abra [http://localhost:3000](http://localhost:3000). Para organizar o evento, acesse [http://localhost:3000/admin/login](http://localhost:3000/admin/login).

Mantenha o terminal aberto enquanto estiver usando o site local. Para desligar, clique no terminal e pressione `Ctrl+C`. No PowerShell, se aparecer que a execução de scripts está desabilitada, use `npm.cmd ci` e `npm.cmd run dev`, ou escolha **Command Prompt / Prompt de Comando** como terminal. Não é necessário alterar a política de segurança do Windows.

### As sete variáveis

Todas são lidas no servidor. **Mantenha os nomes exatamente assim, sem acrescentar `NEXT_PUBLIC_`.**

| Variável | O que preencher |
| --- | --- |
| `SUPABASE_URL` | URL do seu projeto, como `https://xxxxxxxx.supabase.co`. |
| `SUPABASE_PUBLISHABLE_KEY` | Chave publicável `sb_publishable_...`; aceita também a chave `anon` legada. |
| `SUPABASE_SECRET_KEY` | Chave secreta `sb_secret_...`; aceita também `service_role` legada. Nunca publique esse valor. |
| `ADMIN_EMAIL` | E-mail da conta confirmada que você criou manualmente no Supabase Auth. |
| `RATE_LIMIT_SECRET` | Segredo aleatório de 64 caracteres hexadecimais, gerado com o comando abaixo. |
| `CODE_LOOKUP_SECRET` | Outro segredo aleatório de 64 caracteres hexadecimais. Gere um valor diferente do anterior; mantenha-o estável e guardado, inclusive ao publicar. |
| `APP_URL` | No computador, `http://localhost:3000`. Publicado, a origem HTTPS oficial do site, como `https://seu-evento.vercel.app`, sem barra final nem caminho. |

Gere `RATE_LIMIT_SECRET` e, executando novamente o comando, gere `CODE_LOOKUP_SECRET`:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copie o resultado para `.env.local`. A senha de entrada do administrador é definida no Supabase Auth; ela **não** entra no `.env.local`. A senha do banco de dados também é diferente das chaves de API.

## Usar o evento pela primeira vez

1. Entre em `/admin/login` com o e-mail e a senha da conta administrativa.
2. Em **Configurações**, defina nome, mensagem, texto da inscrição e data da troca. A data é informativa: não abre inscrições, não encerra inscrições e não sorteia automaticamente.
3. Ative **Inscrições abertas** e clique em **Salvar configurações**.
4. Compartilhe a página inicial oficial. Cada pessoa informa o nome, três sugestões diferentes de até R$ 50,00 por presente e escolhe seu código. Depois, confirma a inscrição e guarda o código.
5. Em **Participantes**, confira a lista e corrija nomes ou sugestões antes de sortear. Novas inscrições podem ter o mesmo nome: na consulta, os nomes normalizados aparecem uma vez e o código identifica a pessoa. Maiúsculas/minúsculas e espaços extras compartilham a mesma opção. Para organizar a lista administrativa, prefira nomes que os amigos reconheçam.
6. Em **Configurações**, desative as inscrições e salve. Confira se o painel mostra inscrições encerradas.
7. Em **Sorteio**, revise a quantidade de pessoas. Digite exatamente `REALIZAR SORTEIO` na confirmação e execute o sorteio uma vez.
8. Após a confirmação de sucesso, avise os participantes para abrir **Consultar meu amigo** e selecionar seu nome e informar o código.

Não compartilhe `localhost`: esse endereço só abre o seu próprio computador. Para outras pessoas acessarem, conclua a [publicação na Vercel](docs/IMPLANTACAO.md#8-publicar-na-vercel).

### Códigos e atualização da página

O **cadastro é salvo no Supabase**, mas a tela de confirmação guarda o código apenas temporariamente, na memória da página. Salve-o antes de fechar ou atualizar a tela. O banco guarda um verificador protegido, e não o código original recuperável.

Se uma pessoa atualizar a confirmação sem guardar o código, ou se a conexão cair depois do cadastro ser salvo, não é necessário criar outro cadastro. A organização deve confirmar a identidade por um contato já conhecido e gerar um link de redefinição em **Participantes**. O link dura 30 minutos e permite que a própria pessoa escolha outro código. O código anterior deixa de funcionar somente quando ela confirma a troca; o painel não exibe nenhum código. A substituição também funciona depois do sorteio e não muda o destinatário.

Ao atualizar ou fechar a tela de resultado, o conteúdo exibido desaparece por privacidade. Basta consultar novamente com nome e código: o sorteio continua salvo no banco.

### Situações do sorteio

| Situação | Como proceder |
| --- | --- |
| Há zero ou uma pessoa | Aguarde pelo menos duas inscrições. |
| As inscrições estão abertas | Encerre-as e salve antes de sortear. |
| O painel informa que o evento mudou | Recarregue, confira a lista e confirme novamente. Outra aba pode ter alterado os dados. |
| O sorteio já foi feito | Consulte o estado atual. Um segundo clique não substitui os pares existentes. |
| A conexão caiu ao confirmar | Reabra o painel e confira se o sorteio foi concluído antes de tentar outra vez. Não reinicie por causa de uma resposta perdida. |
| É preciso editar/excluir alguém após sortear | Primeiro decida com o grupo se realmente fará outro sorteio; os pares atuais precisam ser descartados. |
| É preciso sortear novamente | Use **Reiniciar sorteio**, confirme `REINICIAR SORTEIO` e siga o fluxo abaixo. |

**Reiniciar apaga os resultados da rodada atual, preserva participantes e códigos e mantém as inscrições fechadas.** Depois, você pode editar a lista, reabrir inscrições se precisar e encerrar novamente antes de realizar outro sorteio. Avise todos se alguém já consultou o resultado antigo. O sistema não conserva um histórico de pares das rodadas descartadas, nem impede que um par se repita em uma nova rodada.

A organização pode revelar todos os pares no painel por uma ação explícita. Portanto, a privacidade do participante depende também da confiança em quem administra o evento.

### Limpar os dados de teste

No **Painel**, clique em **LIMPAR BASE DE DADOS**. Confira o aviso, digite a mesma frase e confirme, ou clique em **Cancelar**. A limpeza apaga participantes, sugestões, verificadores de acesso, links de redefinição e todos os pares. Preserva nome, data, mensagens, conta administrativa e estrutura do banco, e reabre inscrições. Não há recuperação da rodada antiga pelo aplicativo. Consulte os limites sobre backups e cópias externas em [SEGURANCA.md](docs/SEGURANCA.md).

Os códigos antigos continuam válidos após a migração. Enquanto existir algum código antigo, novos códigos com **exatamente 32 dígitos** ficam reservados para impedir coincidências com o formato anterior. Escolha 4 a 31 ou 33 a 128 dígitos; após todos migrarem por redefinição, ou após limpar a base, 32 também fica disponível.

### Exportar a lista

Em **Participantes**, use a opção de exportar CSV. O arquivo inclui nomes, sugestões e data de inscrição; não inclui códigos, hashes nem resultados. Ele usa UTF-8 com BOM e ponto e vírgula como separador para facilitar a abertura no Excel. Se as colunas não separarem automaticamente, use **Dados → De Texto/CSV**, selecione UTF-8 e delimitador `;`.

Campos que começam com caracteres de fórmula recebem um apóstrofo de proteção. Isso reduz o risco de executar uma fórmula ao abrir a planilha. Trate o CSV como uma cópia privada dos dados: ele não é um backup completo do evento.

## Comandos de verificação

Execute na pasta que contém `package.json`:

```sh
npm run typecheck
npm test
npm run build
```

Para abrir a versão de produção local depois do build:

```sh
npm start
```

`npm test` usa um banco temporário de testes; não deve usar o seu banco Supabase de produção. Há um modo PostgreSQL nativo e um modo PGlite para ambientes restritos. PGlite executa PostgreSQL compilado para WebAssembly, mas não substitui a verificação de concorrência entre conexões nativas: os testes específicos dessas corridas são pulados nesse modo. Veja comandos, resultados reais e limitações em [docs/TESTES.md](docs/TESTES.md).

## Onde encontrar cada parte

| Arquivo ou pasta | Conteúdo |
| --- | --- |
| `src/app/` | Páginas e rotas do servidor. |
| `src/components/` | Elementos reutilizáveis da interface. |
| `src/lib/` | Validação, autenticação, códigos, sorteio e acesso ao banco. |
| `supabase/schema.sql` | Instalação do banco, funções e permissões. |
| `.env.example` | Modelo de configuração, sem credenciais reais. |
| `tests/` | Testes automatizados. |
| [docs/IMPLANTACAO.md](docs/IMPLANTACAO.md) | Instalação e publicação passo a passo. |
| [docs/SEGURANCA.md](docs/SEGURANCA.md) | Proteções implementadas e limites de confiança. |
| [docs/TESTES.md](docs/TESTES.md) | O que foi verificado nesta entrega. |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Decisões técnicas. |
| [docs/CONTRATOS.md](docs/CONTRATOS.md) | Formatos da API e funções do banco. |

O aplicativo grava dados reais no Supabase configurado, inclusive quando você o executa no computador. Para experimentar sem afetar um evento em uso, configure outro projeto Supabase de teste.
