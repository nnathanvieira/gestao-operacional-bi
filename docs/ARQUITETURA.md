# Arquitetura da solução

## Camadas

### 1. Fontes operacionais

| Domínio | Estrutura esperada | Finalidade |
|---|---|---|
| Planejamento | ordem, item, setor, recurso, quantidade e datas | demanda e programação |
| Produção | data, ordem, item, recurso, turno, quantidade e duração | execução real |
| Disponibilidade | data, recurso, turno, horas e indicador de trabalho | capacidade utilizável |
| Manutenção | data, recurso, tipo, sintoma e horas paradas | desconto do tempo produtivo |
| Pessoas e grupos | data, grupo, matrícula, turno e vigência | composição e rateio |
| Histórico mensal | mês, setor, produção, horas e pessoas | comparativos históricos |

Os nomes físicos dos arquivos originais são mantidos apenas nas consultas como
contrato técnico. Nenhum arquivo de origem é distribuído.

### 2. Staging

Consultas `stg_*` leem e tipam as fontes, preservando o conteúdo bruto necessário
para auditoria. Funções `fx*` concentram leitura de abas e normalização de chaves.
As consultas de staging e funções permanecem com carga desabilitada.

### 3. Modelo dimensional

Dimensões:

- `dim_data`
- `dim_ordem`
- `dim_item`
- `dim_maquina`
- `dim_turno`
- `dim_molde`
- `dim_funcionario`

Fatos principais:

- `fato_ordens`
- `fato_producao`
- `fato_eficiencia_lancamento`
- `fato_disponibilidade`
- `fato_manutencao_ordem`
- `fato_producao_pessoa`
- `fato_resumo_analise`
- `fato_dados_mensais`
- `fato_alertas`

Os relacionamentos seguem o padrão `1:*`, com filtro em direção única da
dimensão para o fato. Fatos não se relacionam diretamente entre si.

### 4. Regras analíticas

#### Eficiência

```text
horas líquidas = duração rateada - horas paradas rateadas
meta esperada = meta por hora × horas líquidas
eficiência = quantidade válida ÷ meta esperada
```

Registros sem meta positiva e fonte identificada não participam da eficiência.

#### Planejamento semanal

```text
planejado da semana =
planejado do mês × horas disponíveis da semana ÷ horas disponíveis do mês
```

A distribuição mensal é preservada quando filtros exibem apenas algumas semanas.

#### Qualidade

Uma ordem pode gerar alerta quando:

- setor do lançamento diverge do setor da ordem;
- duração não é positiva;
- quantidade é inválida;
- meta não é positiva ou não possui fonte identificada;
- lançamento excede a quantidade disponível da ordem.

### 5. Apresentação

O relatório combina:

- filtros nativos do Power BI;
- cartões e gráficos nativos quando a interação nativa é prioritária;
- medidas HTML para layouts densos, tabelas analíticas e visuais especiais;
- páginas separadas para produção e análise crítica, reduzindo o volume de HTML.

## Fluxo de atualização

1. Atualização das fontes.
2. Execução das consultas de staging.
3. Materialização das dimensões e fatos.
4. Validação dos alertas e reconciliações.
5. Cálculo das medidas.
6. Renderização dos visuais nativos e HTML.
