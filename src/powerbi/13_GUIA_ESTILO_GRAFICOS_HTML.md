# Guia de estilo dos graficos HTML

Atualizado em 2026-07-09.

Este arquivo registra apenas diretrizes visuais para os graficos HTML do dashboard. Nao altera regras de negocio, medidas DAX ou Power Query.

## Identidade visual

O dashboard deve ter aparencia de painel executivo industrial: moderno, escuro, robusto, tecnico, limpo, premium e proximo aos visuais nativos do Power BI.

## Paleta obrigatoria

- Amarelo principal: `#FFCC00`
- Vermelho alerta: `#ED1C24`
- Fundo escuro: `#262626`
- Grafite: `#202124`
- Cinza escuro: `#4D4D4F`
- Cinza medio: `#59595B`
- Cinza tecnico: `#636466`
- Cinza apoio: `#87897B`
- Cinza claro: `#9E9EA2`
- Cinza claro 2: `#B1B3B6`
- Branco gelo: `#F2F2F2`

## Regras gerais

- Usar fundo principal escuro.
- Cada grafico deve ficar em card com fundo cinza escuro, bordas arredondadas, sombra suave e espacamento interno confortavel.
- Usar `#FFCC00` como cor principal dos dados positivos, barras, linhas e destaques.
- Usar `#ED1C24` apenas para queda, alerta, divergencia ou indicador critico.
- Usar cinzas para eixos, linhas auxiliares, textos secundarios e series complementares.
- Usar `#F2F2F2` para textos principais.
- Evitar excesso de cores e visuais poluidos.
- Priorizar leitura rapida, impacto visual e clareza analitica.
- Os visuais devem ser responsivos no HTML Content do Power BI.

## Estilo dos cards

- Fundo escuro ou cinza escuro.
- Borda sutil.
- Sombra suave.
- Raio arredondado consistente.
- Titulo centralizado ou alinhado a esquerda conforme o grafico.
- Legenda discreta.
- Boa leitura de rotulos.

## Graficos combinados: colunas + linha

Aplicacao: conclusao das ordens x horas totais, produzido x planejado, indicadores percentuais com volume.

Estrutura:
- Card largo horizontal.
- Barras verticais amarelas para indicador principal.
- Linha cinza sobreposta para indicador secundario.
- Rotulos em badges arredondados.
- Eixo esquerdo para percentual.
- Eixo direito para volume quando necessario.
- Legenda inferior com bolinhas coloridas.
- Fundo limpo, sem grade excessiva.

Estilo:
- Barras amarelas largas com cantos levemente arredondados.
- Linha cinza com espessura media.
- Labels em caixas arredondadas cinza claro.
- Periodos no eixo inferior em branco.

## Graficos de barras ranking

Aplicacao: pecas nao produzidas, ranking de recursos, ranking de itens, maiores perdas.

Estrutura:
- Card medio ou largo.
- Titulo centralizado.
- Barras verticais amarelas.
- Valor no topo de cada barra em badge cinza.
- Categorias no eixo inferior com quebra de linha.
- Separadores verticais pontilhados quando houver muitos rotulos.
- Eixo Y resumido, por exemplo `0 Mi`, `1 Mi`, `2 Mi`.

Estilo:
- Alto contraste entre amarelo e fundo escuro.
- Rotulos inferiores brancos e legiveis.
- Rolagem horizontal ou reducao proporcional quando houver muitos itens.

## Graficos de linha

Aplicacao: media de disponibilidade, evolucao de eficiencia, ranking temporal.

Estrutura:
- Card horizontal.
- Linha amarela principal.
- Pontos ou rotulos percentuais em cada posicao.
- Categorias no eixo inferior.
- Pouca grade.

Estilo:
- Linha amarela espessa e suave.
- Rotulos em branco ou cinza claro.
- Eixo Y discreto com percentuais.
- Categorias podem quebrar linha.

## Card comparativo temporal

Aplicacao: comparacao mes atual x mes anterior ou ano atual x ano anterior.

Estrutura:
- Card horizontal em formato capsula.
- Fundo claro ou cinza muito claro quando necessario destacar comparacao.
- Titulo centralizado.
- Tres ou mais indicadores lado a lado.
- Cada indicador com valor percentual, nome e seta de tendencia.

Estilo:
- Seta positiva em cinza escuro ou amarelo.
- Seta negativa em vermelho.
- Card com bordas arredondadas e sombra.
- Visual de resumo executivo.

## Gauge semicircular

Aplicacao: perdas, progresso, ocupacao, atingimento, pecas nao produzidas.

Estrutura:
- Card quadrado ou retangular.
- Titulo no topo.
- Gauge semicircular.
- Arco base branco gelo ou cinza claro.
- Parte preenchida em amarelo.
- Valor principal grande no centro.
- Valor minimo no canto inferior esquerdo.
- Valor maximo no canto inferior direito.

Estilo:
- Limpo, sem excesso de marcacoes.
- Alto contraste.
- Borda sutil.

## Grafico de composicao empilhada ou fluxo

Aplicacao: custos, composicao de perdas, material x rateio, parcelas dentro de total.

Estrutura:
- Card largo.
- Categorias no eixo inferior.
- Blocos empilhados por categoria.
- Duas ou mais series.
- Rotulos dentro ou acima dos blocos.
- Legenda inferior.

Estilo:
- Serie principal em cinza.
- Serie de destaque em amarelo.
- Bordas arredondadas ou transicoes suaves quando possivel.

## Tabelas premium

- Fundo escuro.
- Cabecalho em grafite.
- Texto do cabecalho em amarelo.
- Linhas alternadas em cinza escuro.
- Numeros alinhados a direita.
- Colunas importantes destacadas.
- Badges para status.
- Rolagem interna quando houver muitos dados.

## Cards de KPI

- Fundo cinza escuro.
- Borda sutil.
- Linha superior ou lateral em amarelo, vermelho ou cinza conforme status.
- Titulo pequeno em caixa alta.
- Valor grande.
- Subtitulo explicativo.
- Comparacao com periodo anterior quando existir.
- Cor do valor conforme regra de negocio.

## Responsividade

- Telas largas: grids com 2 ou 3 colunas.
- Telas medias: 2 colunas.
- Telas pequenas: cards empilhados.
- Manter textos legiveis.
- Evitar quebra dos graficos.
- Usar rolagem interna para rankings longos.

## Regras tecnicas

- Priorizar HTML + CSS + SVG puro.
- Evitar bibliotecas externas.
- Evitar JavaScript complexo.
- Evitar filtros internos desnecessarios.
- O contexto de filtro deve vir do Power BI por meio das medidas DAX.
- Sempre que possivel, a medida HTML deve receber dados ja filtrados pelo Power BI.
- Para dados dinamicos, usar JSON interno com `CONCATENATEX`.
- Tratar brancos com `COALESCE`.
- Garantir formato numerico compativel.
- Escapar aspas e quebras de linha.
- Evitar scripts frageis no HTML Content.

## Sequencia de aplicacao

- Primeiro desenvolver a Pagina 01 - Resumo Geral como modelo visual.
- Apos validacao do padrao, replicar a identidade nas demais paginas.
- Este arquivo define somente estilo; regras de negocio continuam nos arquivos de medidas, Power Query e regras pendentes.
