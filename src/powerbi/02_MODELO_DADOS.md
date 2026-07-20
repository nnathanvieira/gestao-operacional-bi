# Modelo de Dados

## Convencoes

- Todas as chaves de negocio sao texto: ordem, item, molde e matricula.
- Colunas tecnicas usam PascalCase sem acentos.
- Dimensoes ficam no lado `1`; fatos ficam no lado `*`.
- A direcao de filtro padrao e unica, da dimensao para a fato.
- Relacionamentos muitos-para-muitos e bidirecionais nao sao usados no nucleo.

## Tabelas fato

### fato_ordens

Origem: `ORDENS_AUX`.

Grao: uma ordem no estado mais recente.

Filtro de carga: `MAIS_RECENTE = 1`.

Uso: demanda, planejamento, status, quantidade do sistema, item, maquina planejada, molde e datas previstas.

Regra: ordens suspensas permanecem na tabela, mas sao excluidas de medidas de demanda ativa.

### fato_producao

Origem: `PRODUCAO_GERAL`.

Grao: um lancamento de producao materializado na origem.

Filtro de carga: `DATA <> null`, removendo as linhas fantasmas criadas pelas consultas mensais.

Uso: fonte oficial de quantidade, maquina real, turno, duracao, grupo/matricula e data de execucao.

Regra: repeticoes exatas sao marcadas por `ChaveEvento` e `PossivelDuplicidade`, mas nao excluidas automaticamente.

### fato_producao_sistema

Origem: `fato_ordens`.

Grao: uma ordem.

Uso exclusivo: reconciliacao da quantidade informada no sistema com a producao oficial.

Proibido usar para maquina real, turno, duracao, grupo ou pessoa.

### fato_programacao

Origem: `PROGRAMACAO_ORDENS`.

Grao real observado: setor + maquina + item + molde + intervalo previsto.

Filtro de carga: `SETOR <> null`.

Regra: `TEMPO_ESTIMADO_H` e `HORAS_ALOCADAS` representam a mesma demanda no arquivo atual e nunca devem ser somadas entre si.

### fato_disponibilidade

Origem: `CALENDARIO FABRIL`.

Grao: data + turno + recurso.

Uso: disponibilidade, horas reais, capacidade, parada e setup planejado.

Regra: nao agregar linhas de maquinas com recursos agregados no mesmo indicador. A coluna `TipoCapacidade` da dimensao controla a exclusao.

### fato_manutencao_detalhe

Origem: `DVWM11[Relatorio Macro]`.

Grao: ordem de manutencao + tecnico/tarefa.

Uso: auditoria de tecnicos, sintomas, causas e tarefas. Nao usar para somar horas de parada.

### fato_manutencao_ordem

Origem: agrupamento de `fato_manutencao_detalhe`.

Grao: ordem de manutencao.

Regra: `HorasParada` usa o maior `Tempo total maquina parada` da ordem. Isso evita multiplicacao quando varios tecnicos aparecem na mesma ordem.

### fato_grupos_eventos

Origem: `GRUPOS_TRABALHO` apos remover linhas sem tipo de cadastro.

Grao: data do evento + grupo + matricula.

### fato_grupos_vigencia

Origem: eventos `CAD_GRUPOS` expandidos da data de alteracao ate a vespera da proxima alteracao do grupo.

Grao: data + grupo + matricula.

### fato_ausencias

Origem: eventos `CAD_AUSENCIA`.

Grao: data + matricula + periodo de ausencia.

### fato_producao_pessoa

Origem: atribuicao de `fato_producao`.

Grao: evento de producao + matricula atribuida.

Regras:

- lancamento individual: 100% da quantidade e duracao para a matricula;
- lancamento de grupo: quantidade dividida pelo numero de integrantes vigentes;
- a soma de `QuantidadeAtribuida` por evento deve ser igual a quantidade original;
- somente M2 multiplica a meta individual pela quantidade real de integrantes do grupo no dia;
- fora do M2, a meta unica do recurso e dividida entre os integrantes, de modo que a soma nao seja multiplicada pela quantidade de pessoas;
- M2 usa a meta do item calculada pela soma das operacoes vigentes do DVCP09;
- M1 usa `ORDENS_AUX[PecasHoraPadrao]`, ja preparada na unidade convertida; sem essa meta, usa `CAD_MAQUINAS[MetaPecasHora]` da maquina real do lancamento;
- demais setores usam `ORDENS_AUX[PecasHoraPadrao]`, sem multiplicador por pessoas;
- `QuantidadeEficienciaAtribuida` e `MetaPecasAtribuida` ficam vazias quando a meta nao e clara, a duracao e invalida, a ordem nao existe ou o setor lancado difere do setor da ordem;
- grupo sem composicao vigente gera alerta e nao e rateado silenciosamente.

### fato_alertas

Origem: `ALERTAS_CADASTRO` mais validacoes criadas no Power Query.

Grao: um alerta.

Campos: data, tipo, base, coluna, valor, severidade, ordem, item, setor, maquina e acao recomendada.

### fato_refugo

Estrutura reservada, sem linhas. Nao criar dados ficticios.

## Dimensoes

| Dimensao | Chave | Fonte principal |
|---|---|---|
| `dim_data` | `Data` | calendario continuo entre menor e maior data das fatos |
| `dim_setor` | `Setor` | `NOMES_SETORES` |
| `dim_maquina` | `Maquina` | `CAD_MAQUINAS` + aliases de `NOMES_MAQUINAS` |
| `dim_item` | `Item` | ordens + `ITEM_CATEGORIA[CATEGORIA]` + operacoes vigentes de `ATUALIZAR_DVCP09` |
| `dim_molde` | `Molde` | `CAD_MOLDES` |
| `dim_funcionario` | `Matricula` | `CAD_FUNCIONARIOS` |
| `dim_turno` | `Turno` | lista controlada `1`, `2`, `3`, `HN`, `NORMAL` |
| `dim_ordem` | `Ordem` | `fato_ordens` |
| `dim_tipo_apontamento` | `Codigo` | `TIPOS DE APONTAMENTO` |

## Relacionamentos ativos

| De | Para | Cardinalidade |
|---|---|---|
| `dim_data[Data]` | `fato_producao[Data]` | 1:* |
| `dim_data[Data]` | `fato_disponibilidade[Data]` | 1:* |
| `dim_data[Data]` | `fato_manutencao_ordem[Data]` | 1:* |
| `dim_data[Data]` | `fato_grupos_vigencia[Data]` | 1:* |
| `dim_data[Data]` | `fato_ausencias[Data]` | 1:* |
| `dim_data[Data]` | `fato_producao_pessoa[Data]` | 1:* |
| `dim_setor[Setor]` | campos `Setor` das fatos | 1:* |
| `dim_maquina[Maquina]` | campos `Maquina` das fatos | 1:* |
| `dim_item[Item]` | `fato_ordens[Item]` e `fato_producao[Item]` | 1:* |
| `dim_ordem[Ordem]` | `fato_ordens[Ordem]`, `fato_producao[Ordem]`, `fato_producao_sistema[Ordem]` | 1:* |
| `dim_funcionario[Matricula]` | fatos de pessoas, grupos e ausencias | 1:* |
| `dim_turno[Turno]` | campos `Turno` das fatos | 1:* |

`fato_programacao[InicioPrevistoData]` nao precisa de relacionamento fisico com `dim_data[Data]`. As medidas de comparacao por periodo usam `TREATAS(VALUES(dim_data[Data]), fato_programacao[InicioPrevistoData])`, evitando erro quando o relacionamento inativo nao existir.

## Relacionamentos que nao devem ser criados

- Nao relacionar fatos diretamente entre si.
- Nao ligar `fato_producao_sistema` a maquina, turno, grupo ou pessoa.
- Nao usar `ITEM_CATEGORIA` como fato de demanda.
- Nao ligar `fato_grupos_vigencia` bidirecionalmente a `fato_producao`.
- Nao ligar `dim_maquina` simultaneamente por aliases; normalize antes do modelo.

## Regras contra dupla contagem

1. Producao oficial vem somente de `fato_producao[Quantidade]`.
2. Producao do sistema vem somente de `fato_producao_sistema[QtdeProduzidaSistemaAnalitica]`.
3. `QtdeOrdem` e `QtdeOrdemConv` sao medidas alternativas, nunca aditivas.
4. `TempoEstimadoH` e `HorasAlocadas` sao medidas alternativas, nunca aditivas.
5. Parada de manutencao usa `fato_manutencao_ordem`, nao a tabela de detalhe.
6. Agregados M1 sao excluidos quando maquinas componentes estiverem no mesmo contexto.
7. Classificacao de categoria vem somente de `ITEM_CATEGORIA` e nao altera quantidades.
8. Rateio por pessoa deve reconciliar com a quantidade original por evento.

## Diagrama logico

```text
dim_data -----------+--> fato_producao <------- dim_ordem
                    +--> fato_disponibilidade   dim_item
                    +--> fato_manutencao_ordem  dim_maquina
                    +--> fato_grupos_vigencia   dim_setor
                    +--> fato_ausencias          dim_turno
                    +--> fato_producao_pessoa    dim_funcionario

dim_ordem ----------+--> fato_ordens
                    +--> fato_producao_sistema

dim_maquina --------+--> fato_programacao
```

## Atualizacao - fontes historicas e resumo analise

### Novas tabelas finais

- `fato_resumo_analise`
  - Fonte: `CALENDARIO_FABRIL_OPERACIONAL.xlsm`, aba `RESUMO_ANALISE`.
  - Uso: analise critica, disponibilidade planejada, ociosidade por horas, ociosidade em pecas, ocupacao e planejamento mensal por maquina/setor.
  - Colunas principais: `Setor`, `Maquina`, `HorasDisponiveis`, `HorasNecessarias`, `Capacidade`, `QtdePlanejada`, `QtdeProduzidaResumo`, `Saldo`, `PercentualProduzido`, `HorasOciosas`, `OciosidadePecas`, `OcupacaoPercentual`, `StatusRecurso`.

- `fato_dados_mensais`
  - Fonte: `DADOS MENSAIS.xlsm`, aba `PRODUCAO_MESES`.
  - Uso: historico mensal, pagina `Comparativo Meses`, producao mensal, horas produtivas, horas extras, horas totais e funcionarios por setor/mes.
  - Colunas principais: `DataMes`, `MesAno`, `MesNome`, `Ano`, `MesNumero`, `Setor`, `HorasProdutivas`, `HorasExtras`, `HorasTotais`, `QtdFuncionarios`, `QtdePlanejada`, `QtdeProduzida`, `QtdeNaoProduzida`, `PercentualProduzido`.

- `fato_param_turnos`
  - Fonte: `CALENDARIO_FABRIL_OPERACIONAL.xlsm`, aba `PARAM_TURNOS`.
  - Uso: funcionamento planejado diario de maquinas e pessoas. Deve ser usado para calcular horas executadas quando houver lancamento real em `fato_producao`.
  - Colunas principais: `Data`, `Setor`, `Turno`, `Maquina`, `Matricula`, `TipoRecurso`, `Trabalha`, `HorasTotais`, `HorasReaisRef`, `HorasParadas`, `HorasSetup`.
  - Regra: nao representa producao real. A producao real continua vindo de `PRODUCAO_INTERVENCOES_QUERY`.

- `fato_horas_prod`
  - Fonte: `CALENDARIO_FABRIL_OPERACIONAL.xlsm`, aba `HORAS_PROD`.
  - Uso: horas produtivas novas/futuras por data e setor.
  - Colunas principais: `Data`, `Setor`, `QtdFuncionarios`, `HorasExtras`, `HorasProdutivas`, `HorasTotais`.

### Relacionamentos recomendados

- `fato_dados_mensais[DataMes]` -> `dim_data[Data]`
  - Direcao: dimensao filtra fato.
  - Cardinalidade: muitos para um.
  - Observacao: `DataMes` representa a data do mes na base historica, normalmente o primeiro dia do mes.

- `fato_resumo_analise[Maquina]` -> `dim_maquina[Maquina]`
  - Direcao: dimensao filtra fato.
  - Cardinalidade: muitos para um.
  - Observacao: se houver nomes divergentes, revisar aliases ou padronizacao.

- `fato_disponibilidade[Data]` -> `dim_data[Data]`
  - Ja utilizado para disponibilidade diaria e planejamento semanal proporcional.

- `fato_producao[Data]` -> `dim_data[Data]`
  - Ja utilizado para producao real.

- `fato_param_turnos[Data]` -> `dim_data[Data]`
  - Direcao: dimensao filtra fato.
  - Cardinalidade: muitos para um.

- `fato_horas_prod[Data]` -> `dim_data[Data]`
  - Direcao: dimensao filtra fato.
  - Cardinalidade: muitos para um.

### Observacao sobre setor

Ainda nao usar `dim_setor[Setor]`, pois essa dimensao nao existia no modelo anterior. Enquanto ela nao for criada, os visuais e medidas devem usar os campos de setor das proprias fatos ou `TREATAS` quando necessario.

### Historico mensal

- Historico confirmado: `DADOS MENSAIS.xlsm` / `PRODUCAO_MESES`.
- O historico novo usa `RESUMO_ANALISE`, `PRODUCAO_INTERVENCOES_QUERY`, `HORAS_PROD` e `PARAM_TURNOS` quando essas bases forem preservadas mensalmente no Power Query.
- `DADOS MENSAIS` deve ser usado apenas como fallback para periodos anteriores ao inicio do historico detalhado.
- As demais abas do `CALENDARIO_FABRIL_OPERACIONAL.xlsm` continuam sendo consideradas mes vigente, nao historico.

### Regras criticas de calculo

- `fato_producao[DuracaoHoras]` e a base de horas executadas, eficiencia e performance para todos os setores, inclusive M1. A antiga excecao que substituia a duracao de M1 por `PARAM_TURNOS[HorasReaisRef]` esta revogada.
- `fato_param_turnos[HorasReaisRef]` deve ser usado somente para disponibilidade, capacidade e distribuicao do planejamento semanal. Nao pode substituir a duracao de um lancamento real.
- Quando dois ou mais lancamentos tiverem a mesma combinacao de data, setor, maquina, turno e todos tiverem `DuracaoHoras >= 8`, a duracao do turno deve ser considerada uma unica vez e rateada proporcionalmente a `Quantidade` de cada lancamento.
- `fato_eficiencia_lancamento` e a fato final de eficiencia. Relacione-a a `dim_data`, `dim_maquina` e `dim_turno` com filtro em sentido unico, da dimensao para a fato. Enquanto `dim_setor` nao existir no modelo, mantenha o filtro de setor pelos campos das fatos; nao crie relacionamentos entre fatos.
- Disponibilidade deve ser calculada como `(HorasDisponiveis - ManutencaoCorretivaAplicavel) / HorasDisponiveis`.
- Manutencao preventiva nao deve reduzir producao, eficiencia ou disponibilidade.
- `HorasOciosas` representa sobra/sobrecarga apos planejamento e nao deve ser usada como disponibilidade.
