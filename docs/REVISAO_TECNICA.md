# Revisão técnica da atualização

A base desta entrega é o ZIP fornecido pelo usuário. As alterações preservaram arquitetura, versões das dependências, sorteio existente, autenticação administrativa e exportação CSV.

A revisão de interface independente aprovou o escopo e a qualidade: código escolhido mantido em memória, dropdown consumindo somente nomes, três sugestões preservadas, avisos de R$50 nos dois momentos, confirmação cancelável da limpeza e redefinição sem expor código ao administrador. A revisão foi de código; não substitui cliques e conferência visual em navegador.

O backend foi aprovado em revisão separada de autenticação, grants, hashes, migração, bloqueios, invalidação de tokens e transação de limpeza. O relatório final de verificações está em [TESTES.md](TESTES.md). Esta é uma revisão interna durante o desenvolvimento, não uma auditoria ou certificação independente da entrega.

## Decisões de compatibilidade

- Nomes repetidos ocupam uma opção pública; o código distingue a inscrição. Não são necessários UUIDs públicos ou dados pessoais adicionais.
- A assistência a códigos perdidos foi mantida por link temporário para o participante escolher outro código. O painel deixa de gerar/mostrar códigos de acesso.
- Hashes antigos são mantidos para que acessos existentes continuem funcionando. Uma proteção temporária recusa novos códigos de exatamente 32 dígitos enquanto houver verificadores antigos, evitando colisão entre formatos sem tentar recuperar segredos.
- Os campos de sugestões continuam livres e na mesma quantidade. Apenas valores em reais explicitamente reconhecidos são comparados a R$ 50; não é possível garantir preço de mercado sem dados de preço verificados.
- A limpeza preserva cotas de tentativas e personalizações, e apaga dados de participação em uma transação. Backups externos e resultados já vistos não são apagados por ela.
- O ZIP atualizado é uma nova entrega; o arquivo recebido permanece inalterado.

Os impactos dessas decisões e o procedimento de migração estão em [ATUALIZACAO.md](../ATUALIZACAO.md). Nenhuma operação destrutiva foi realizada na base real.
