# Painel da Rede - Documentacao das Analises

Este documento explica como funcionam as analises do `Painel da rede`, para apoio na comunicacao com operacao, supervisao e gestao.

## 1) Objetivo do painel

O painel foi desenhado para responder, de forma rapida:

- Onde agir primeiro
- Qual o risco atual da rede
- Qual o impacto operacional potencial
- Em qual contexto (OLT/geografia) o problema esta concentrado

## 2) Fontes de dados

As informacoes do painel combinam dados do BFF local:

- `/api/stats`: indicadores gerais da rede
- `/api/splitters`: catalogo de splitters (metadados como OLT, rua, tipo local, condominio, coordenadas)
- `/api/splitters/trends`: tendencia de uso por splitter (uso atual, delta 7d e delta 30d)
- `/api/massiva/history/splitter-stats`: historico de massivas por splitter

Se o backend local estiver indisponivel, o painel usa fallback mock para manter a tela funcional.

## 3) Estrutura de navegacao da tela

A tela e dividida por janelas (abas):

- `Visao Geral`
- `Risco`
- `Operacao`
- `Geografico`

Isso reduz scroll vertical e melhora foco por contexto.

## 4) Filtros da tela

Filtros disponiveis no topo:

- Janela temporal: `7d`, `30d`, `90d`, `custom`
- Busca textual: splitter/OLT
- Filtro de banda de risco: todos, critico, alto, moderado, baixo
- Selecao de quadrante na matriz impacto x urgencia
- Botao `Limpar filtros` (zera busca, banda e matriz)

## 5) Regra de delta dinamico (muito importante)

O painel nao fixa delta de 30 dias em todas as visoes. Ele adapta ao filtro temporal:

- Se periodo = `7d` -> referencia = `Delta 7d`
- Se periodo = `30d` ou `90d` -> referencia = `Delta 30d`
- Se periodo = `custom`:
  - ate 14 dias -> `Delta 7d`
  - acima de 14 dias -> `Delta 30d`

Esse delta de referencia e usado no ranking, score, matriz e agregacoes relacionadas.

## 6) Ranking de risco por splitter

O ranking ordena splitters pelo `Score` (maior score = maior prioridade).

### 6.1 Formula do Score

O score soma quatro componentes com limites:

1. `Uso atual`:
   - base: `currentUsagePercent`
   - faixa: `0` a `100`

2. `Crescimento no periodo`:
   - base: `deltaReferencia * 4`
   - `deltaReferencia` = Delta 7d ou Delta 30d (regra da secao 5)
   - faixa: `-20` a `40`

3. `Pressao por massiva aberta`:
   - base: `openTickets * 8`
   - faixa: `0` a `24`

4. `Impacto em clientes`:
   - base: `log10(affectedClientsTotal + 1) * 12`
   - faixa: `0` a `36`

Score final:

- soma das quatro parcelas
- clamp final entre `0` e `200`

### 6.2 Faixas do Score

- `critico`: score >= 120
- `alto`: score >= 90 e < 120
- `moderado`: score >= 60 e < 90
- `baixo`: score < 60

### 6.3 Leitura operacional

- Score alto + uso alto + delta positivo: priorizar acao preventiva/capacidade
- Score alto com muitas massivas abertas: priorizar estabilizacao operacional
- Score alto com alto afetados: priorizar impacto ao cliente

## 7) KPIs de decisao

Bloco no topo com leitura executiva:

- `Risco critico`: splitters com uso >= 95%
- `Crescimento forte`: splitters com deltaReferencia >= 5%
- `Impacto em risco alto`: clientes afetados em splitters de risco alto/critico
- `Pressao operacional`: participacao de splitters em criticidade + crescimento forte

## 8) Matriz impacto x urgencia

Cada splitter e classificado em 1 de 4 quadrantes:

- Alto impacto + Alta urgencia
- Alto impacto + Baixa urgencia
- Baixo impacto + Alta urgencia
- Baixo impacto + Baixa urgencia

### 8.1 Regra de impacto

`alto impacto` quando:

- `affectedClientsTotal >= 50` **ou**
- `totalTickets >= 4`

### 8.2 Regra de urgencia

`alta urgencia` quando:

- `currentUsagePercent >= 85` **ou**
- `deltaReferencia >= 5` **ou**
- `openTickets > 0`

### 8.3 Interacao

Ao clicar em um quadrante, a tela filtra contextualmente:

- ranking
- drill-down por OLT
- drill-down geografico

## 9) Drill-down por OLT (AP/OLT)

Agrega por OLT e exibe:

- quantidade de splitters
- quantidade de criticos
- uso medio
- deltaReferencia medio
- massivas abertas/total
- afetados totais

Uso tipico:

- identificar OLTs com concentracao de risco
- comparar tendencia media entre OLTs

## 10) Drill-down geografico

Mostra agregacoes por contexto local:

- distribuicao por tipo local (`CONDOMINIO`, `UNIDADE`, `SEM_CLASSIFICACAO`)
- top condominios por impacto
- top ruas com criticidade

Uso tipico:

- localizar concentracao territorial de risco e impacto
- apoiar priorizacao de frentes de campo

## 11) Mapa de saturacao

Exibe splitters com coordenadas validas e cor por faixa de uso:

- verde: folga (<70%)
- amarelo: atencao (70-94%)
- vermelho: critico (>=95%)

Para performance e legibilidade, o mapa limita pontos e usa amostragem estratificada (nao mostra apenas os mais criticos).

## 12) Versao mobile

A experiencia mobile foi otimizada com:

- abas em navegacao horizontal
- filtros compactos no topo
- cards no lugar de tabelas nas areas mais densas (ex.: risco e geografia)

## 13) Regras de consistencia (importante para explicacao ao time)

- Cards, ranking, matriz e drill-down usam o mesmo conjunto base filtrado
- O delta exibido e o mesmo usado no score (deltaReferencia dinamico)
- Mudanca de periodo muda automaticamente o significado do delta

## 14) Limites conhecidos

- O score e um modelo de priorizacao operacional, nao previsao estatistica formal
- Falta de coordenada impede exibicao no mapa
- Em indisponibilidade do backend local, dados mock podem ser usados

## 15) Mensagem curta para apresentar ao time

"O painel combina risco tecnico (ocupacao e tendencia), pressao operacional (massivas) e impacto ao cliente em um score unico de priorizacao. A tela e segmentada por janelas para decisao rapida, e toda a analise responde ao periodo filtrado (7d/30d/custom) com consistencia entre ranking, matriz e drill-down."
