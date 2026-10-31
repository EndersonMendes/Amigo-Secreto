# Arquitetura

A atualização usa a estrutura do ZIP recebido: Next.js App Router, React, TypeScript, Tailwind, Supabase PostgreSQL e Supabase Auth. Não foi criado um aplicativo substituto.

- Um único evento por instalação. Nome, textos e data configuráveis; abertura/encerramento manuais.
- Navegador → rotas `/api` → `PartyService` → repositório RPC → PostgreSQL. Somente o servidor tem a chave de serviço.
- Autorização administrativa em cada rota por sessão Supabase validada e e-mail confirmado em `ADMIN_EMAIL`.
- Códigos novos escolhidos pelo participante: scrypt com salt e HMAC prévio usando segredo do servidor; impressão HMAC separada com índice único. Compatibilidade de verificadores antigos descrita em [SEGURANCA.md](SEGURANCA.md).
- Lista pública contendo apenas nomes, agrupados por normalização SQL. Nome e código determinam a inscrição; o resultado exige verificação do segredo.
- Recuperação por token aleatório temporário de uso único; o participante escolhe outro código. Nenhum código recuperável pelo painel.
- Fisher–Yates criptográfico com rejeição de pontos fixos permanece. O SQL valida toda a permutação antes de gravar uma rodada atômica.
- Linha singleton do evento coordena escritas e revisão. Limpeza/redefinição de código também a bloqueiam; consulta final bloqueia em leitura. Revisão impede confirmação sobre estado antigo.
- Limites de tentativas persistem em PostgreSQL. Limpeza do evento preserva contadores.
- Estado React mantém somente a confirmação e o resultado em memória; dados reais permanecem no Supabase.
- Limpar base remove dados de participação e reabre inscrições; reiniciar sorteio remove somente pares e mantém inscrições fechadas.
- Limite R$ 50 por sugestão é explicado na UI; valores explicitamente reconhecidos são validados na interface, servidor e RPC. Não há consulta de preço externo nem novo campo obrigatório.

Instalação nova usa `supabase/schema.sql`. Atualização usa `supabase/migrations/20261031_numeric_codes_and_clear.sql`. A migração é transacional e repetível, sem apagar dados existentes. As assinaturas antigas que ignorariam a unicidade são substituídas; código antigo e servidor novo não devem rodar ao mesmo tempo sobre a base migrada.

Testes de domínio, API e SQL são complementados por renderização React dos formulários. O modo PGlite executa PostgreSQL/WebAssembly, mas não simula concorrência de conexões nativas. A verificação no Supabase hospedado e em navegador é uma etapa de homologação explícita em [ATUALIZACAO.md](../ATUALIZACAO.md).
