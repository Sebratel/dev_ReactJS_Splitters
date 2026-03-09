# Documentacao de Abertura de Massivas

## Objetivo

Este documento descreve o que o aplicativo ja entrega hoje para abertura de massivas e organiza as proximas fases de evolucao para fechar o ciclo completo do processo, desde a abertura inicial ate o tratamento automatizado dos clientes que permanecerem sem sinal.

O foco aqui e separar com clareza:

- o que ja esta implementado no app;
- o que depende de novas validacoes apos o encerramento da massiva;
- o que exigira integracoes adicionais com Elleven e Matrix.

## Visao Geral do Cenario Atual

Hoje o aplicativo ja possui uma tela dedicada para abertura de massivas, com suporte a:

- selecao de AP, slot, porta e splitter;
- definicao de janela de abertura e prazo de fechamento;
- definicao do tipo de solicitacao e descricao tecnica;
- apoio por eventos recentes do AutoISP;
- validacao previa da lista de clientes afetados via middleware;
- abertura da massiva no Elleven;
- fallback automatico para abertura individual em lote quando a abertura massiva padrao falha;
- consulta de massivas ja abertas/encerradas;
- exportacao basica da lista de massivas.

Em termos de produto, a Fase 1 ja cobre a abertura operacional da massiva pela nossa propria tela. As Fases 2, 3 e 4 ainda nao estao implementadas no app hoje.

## Fase 1

### O que ja foi feito

A Fase 1 ja esta entregue no aplicativo com os seguintes blocos:

1. Acesso controlado a tela de massivas
- O acesso depende da permissao `canOpenMassiva`.
- A navegacao para a tela parte da `HomePage`.

2. Tela dedicada para abertura
- Existe uma tela especifica de massivas com formulario operacional.
- O operador informa:
  - data e hora de abertura;
  - data e hora prevista de fechamento;
  - AP(s), slot(s) e porta(s);
  - tipo de solicitacao;
  - descricao tecnica;
  - opcionalmente, pode forcar fallback individual.

3. Apoio por eventos AutoISP
- O app consulta eventos recentes do AutoISP.
- Esses eventos ajudam a preencher rapidamente dados base da ocorrencia, principalmente slot/porta e descricao inicial.
- O AutoISP hoje atua como apoio a decisao, nao como gatilho automatico de abertura.

4. Validacao previa da lista limpa
- Antes da abertura, o app pode chamar o middleware para identificar a lista limpa de clientes afetados.
- O retorno traz:
  - `correlationId`;
  - lista de `cleanAuthenticationIds`;
  - total de clientes afetados.

5. Abertura da massiva no Elleven
- Se houver middleware configurado, o fluxo ideal e:
  - montar o incidente;
  - consultar o middleware para filtrar os clientes afetados;
  - abrir a massiva no Elleven usando os `authenticationIds` retornados.
- Se nao houver middleware configurado, o app ainda consegue abrir a massiva diretamente no endpoint do Elleven, sem a etapa de filtro granular.

6. Fallback operacional
- Quando a abertura massiva padrao falha, o app faz fallback automatico para `bulk_individual`.
- Tambem existe opcao manual para forcar esse fallback desde o formulario.

7. Consulta e acompanhamento
- O app tambem lista massivas existentes, com status aberta/encerrada.
- Ha indicadores de quantidade, clientes afetados e tempo de resolucao quando os dados existem no retorno.
- A lista pode ser exportada em CSV.

### Fluxo funcional atual

1. Operador acessa a tela de massivas.
2. Seleciona a topologia impactada.
3. Informa tipo da solicitacao, descricao e prazo.
4. Opcionalmente usa um evento do AutoISP como apoio.
5. Executa a validacao da lista limpa.
6. App consulta o middleware e retorna os clientes impactados.
7. App envia a abertura para o Elleven.
8. Se a abertura massiva falhar, o app tenta fallback individual.
9. O protocolo retornado e exibido na tela.
10. A massiva passa a aparecer na listagem do painel.

### Integracoes ja utilizadas na Fase 1

- `AUTOISP_AUTH_ENDPOINT`
- `AUTOISP_EVENTS_ENDPOINT`
- `MIDDLEWARE_MASSIVA_BASE_URL`
- `ELLEVEN_MASSIVA_ENDPOINT`
- `ELLEVEN_MASSIVA_LIST_ENDPOINT`

### Resultado de negocio da Fase 1

Com a Fase 1, a equipe deixa de depender exclusivamente de abertura manual fora do app e passa a centralizar a abertura operacional de massivas em uma tela propria, com apoio de filtro tecnico e retorno de protocolo.

## Fase 2

### Objetivo

Validar quais clientes nao voltaram ao normal depois que a massiva for encerrada.

### O que esta faltando hoje

Hoje o app:

- consegue abrir massivas;
- consegue listar massivas;
- consegue identificar a lista limpa de clientes afetados na abertura.

Mas ainda nao existe fluxo implementado para:

- detectar automaticamente o encerramento de uma massiva;
- reconsultar o estado dos clientes apos o encerramento;
- comparar a lista original impactada com a lista que permaneceu offline;
- gerar uma nova classificacao de "clientes nao normalizados".

### Escopo recomendado da implementacao

1. Persistir o vinculo da massiva com a lista original de clientes afetados.
2. Detectar quando a massiva mudar para status encerrada.
3. Executar uma nova validacao tecnica apos uma janela configuravel.
4. Identificar os clientes que continuam fora do estado normal.
5. Salvar o resultado como "pendentes pos-massiva".

### Regras sugeridas

- A validacao nao deve ocorrer imediatamente no encerramento; idealmente deve haver uma tolerancia operacional.
- O criterio de "normalizado" precisa ser padronizado.
- O processo precisa ser idempotente para nao duplicar reprocessamentos.

### Entrega esperada da Fase 2

Ao final desta fase, cada massiva encerrada devera gerar uma lista confiavel de clientes que permaneceram sem sinal ou fora do status esperado.

## Fase 3

### Objetivo

Abrir protocolos automaticos no Elleven para os clientes especificos que nao voltaram ao normal apos o encerramento da massiva, direcionando esses casos para atendimento de campo.

### O que esta faltando hoje

Hoje o app ja conversa com o Elleven para abertura massiva, inclusive com fallback individual. Porem ainda nao existe uma automacao pos-massiva para:

- receber a lista de clientes remanescentes da Fase 2;
- abrir protocolos individualizados para cada cliente;
- classificar o protocolo como atendimento de campo;
- evitar duplicidade de protocolo para o mesmo cliente e mesma massiva;
- registrar rastreabilidade entre massiva original e protocolos gerados.

### Escopo recomendado da implementacao

1. Consumir a lista de clientes nao normalizados produzida na Fase 2.
2. Montar payload individual por cliente para o Elleven.
3. Abrir os protocolos automaticamente.
4. Gravar o numero do protocolo vinculado ao cliente e a massiva de origem.
5. Marcar clientes com erro de abertura para reprocessamento.

### Regras sugeridas

- Garantir deduplicacao por cliente + massiva.
- Registrar motivo da abertura automatica no historico do protocolo.
- Definir fila de reprocessamento para falhas transientes.
- Separar claramente protocolo gerado por automacao de protocolo aberto manualmente.

### Entrega esperada da Fase 3

Ao final desta fase, os clientes que permanecerem sem sinal apos o encerramento da massiva passarao automaticamente para uma trilha de tratamento operacional no Elleven, reduzindo acao manual da equipe.

## Fase 4

### Objetivo

Criar, na mensageria da Matrix, um fluxo para identificar os clientes que continuaram sem sinal apos a finalizacao da massiva e enviar uma mensagem via WhatsApp.

### O que esta faltando hoje

Nao existe no app atual:

- integracao com a mensageria da Matrix;
- fila de clientes aptos para comunicacao pos-massiva;
- controle de template, tentativa e status de entrega do WhatsApp;
- trilha de auditoria da comunicacao enviada.

### Escopo recomendado da implementacao

1. Receber da Fase 2 a lista de clientes nao normalizados.
2. Validar elegibilidade de contato de cada cliente.
3. Publicar esses clientes em um fluxo de mensageria da Matrix.
4. Disparar mensagem padrao via WhatsApp.
5. Registrar envio, entrega, falha e reenvio quando aplicavel.

### Regras sugeridas

- Respeitar opt-in, politicas internas e consistencia cadastral do telefone.
- Evitar reenvios repetidos para o mesmo evento.
- Usar template padronizado por tipo de incidente.
- Vincular a mensagem a massiva original e, quando existir, ao protocolo individual aberto no Elleven.

### Entrega esperada da Fase 4

Ao final desta fase, o processo passa a ter comunicacao ativa com o cliente impactado, reduzindo incerteza no pos-massiva e melhorando a experiencia de atendimento.

## Arquitetura Evolutiva Sugerida

Para fechar o ciclo completo, o desenho mais consistente e:

1. App
- segue como interface operacional para abertura, acompanhamento e visibilidade.

2. Middleware / orquestrador
- concentra a inteligencia de filtro, revalidacao pos-encerramento, deduplicacao e reprocessamento.

3. Elleven
- continua como destino de abertura massiva e de protocolos individuais.

4. Matrix
- passa a ser a camada de comunicacao com o cliente via WhatsApp.

O ponto principal e que as Fases 2, 3 e 4 tendem a funcionar melhor como automacoes backend, e nao somente dentro da interface Flutter, porque exigem:

- processamento assinado por eventos;
- reprocessamento;
- rastreabilidade;
- execucao agendada;
- resiliencia a falhas externas.

## Sequencia Recomendada de Implementacao

1. Consolidar a Fase 1
- garantir persistencia da lista original impactada e do `correlationId`.

2. Entregar a Fase 2
- revalidacao pos-encerramento e geracao da lista residual de clientes afetados.

3. Entregar a Fase 3
- abertura automatica de protocolos individuais no Elleven para os casos residuais.

4. Entregar a Fase 4
- integracao com Matrix para comunicacao automatizada via WhatsApp.

## Resumo Executivo

Hoje o aplicativo ja entrega a abertura de massivas pela propria tela, com apoio do AutoISP, filtro tecnico via middleware, envio ao Elleven, fallback individual e consulta das massivas abertas/encerradas.

As proximas fases para deixar o processo mais completo sao:

1. validar os clientes que nao normalizaram apos o encerramento;
2. abrir protocolos automaticos no Elleven para esses clientes;
3. acionar a Matrix para comunicacao automatizada via WhatsApp.

Em outras palavras, a base operacional da abertura ja existe. O proximo passo e transformar esse fluxo em um ciclo completo de tratamento pos-massiva e comunicacao proativa.
