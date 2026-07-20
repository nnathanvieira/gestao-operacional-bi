# Checklist de validação

Este checklist foi sanitizado para publicação. Totais, ordens, itens, máquinas,
matrículas e fotografias de produção reais foram removidos.

## Estrutura

- [ ] As consultas `stg_*` permanecem com carga desabilitada.
- [ ] As funções `fx*` permanecem com carga desabilitada.
- [ ] As dimensões possuem chaves únicas.
- [ ] Chaves de ordem, item, molde e matrícula estão tipadas como texto.
- [ ] Datas estão tipadas como data antes dos relacionamentos.
- [ ] Relacionamentos seguem cardinalidade `1:*` e direção única.
- [ ] Não existem relacionamentos ativos entre tabelas fato.

## Produção

- [ ] `fato_producao` contém somente registros com data válida.
- [ ] Quantidade produzida reconcilia com a fonte oficial.
- [ ] Setor, máquina, turno e ordem são normalizados sem descartar divergências.
- [ ] Valores sem equivalência permanecem visíveis e geram alerta.
- [ ] Lançamentos duplicados de duração são rateados conforme a regra vigente.

## Ordens e planejamento

- [ ] Cada ordem possui uma única linha vigente na dimensão.
- [ ] Quantidade planejada usa a unidade correta para cada setor.
- [ ] Produção acima da quantidade disponível é identificada.
- [ ] Ordens sem lançamento permanecem visíveis na análise crítica.
- [ ] Planejamento semanal preserva a distribuição mensal.
- [ ] A última semana recebe proporção compatível com suas horas disponíveis.

## Eficiência

- [ ] Registros sem meta positiva não participam do indicador.
- [ ] A fonte da meta está identificada.
- [ ] Horas paradas são descontadas antes do cálculo da meta esperada.
- [ ] Horas líquidas não podem ser negativas.
- [ ] Eficiência é calculada no grão do lançamento.
- [ ] A agregação usa soma de quantidade válida e soma de meta esperada.
- [ ] Regras de quantidade de pessoas são aplicadas apenas aos setores válidos.

## Manutenção

- [ ] Eventos técnicos da mesma ordem não multiplicam horas de parada.
- [ ] Tipo de manutenção está padronizado.
- [ ] Máquina e setor são reconciliados com as dimensões.
- [ ] Sintomas sem descrição permanecem classificados para revisão.

## Pessoas e grupos

- [ ] Matrículas estão tipadas como texto.
- [ ] A composição do grupo respeita a vigência na data da produção.
- [ ] Ausências retiram a pessoa apenas do período aplicável.
- [ ] O rateio por pessoa reconcilia com a quantidade original do evento.
- [ ] Grupos sem composição geram alerta.
- [ ] A eficiência do grupo não é multiplicada pela quantidade de componentes.

## Histórico e filtros

- [ ] Filtros de data, mês, setor, recurso, turno, item e grupo propagam pelas dimensões.
- [ ] O mês selecionado representa o mês completo quando essa é a regra do visual.
- [ ] Comparativos históricos não misturam snapshots mensais com lançamentos detalhados.
- [ ] Sem filtro de período, os visuais usam todo o histórico disponível.

## HTML Content

- [ ] A medida HTML não ultrapassa o limite aceito pelo visual.
- [ ] O JSON é agregado antes de ser concatenado.
- [ ] Nenhuma tabela detalhada desnecessária é serializada.
- [ ] O HTML retorna conteúdo com filtros nativos aplicados.
- [ ] Menu e botões respondem ao clique.
- [ ] Textos em fundos escuros usam cores claras.
- [ ] Acentuação está correta em UTF-8.
- [ ] Gráficos com muitos recursos usam rolagem interna.
- [ ] Cabeçalhos de tabelas permanecem acima das linhas durante a rolagem.

## Privacidade da demonstração

- [ ] Dados em `demo/` são inteiramente sintéticos.
- [ ] Não existem nomes, matrículas, ordens, itens ou recursos reais.
- [ ] Não existem arquivos PBIX, Excel, Word ou backups no repositório.
- [ ] Não existem caminhos pessoais, credenciais ou tokens.
