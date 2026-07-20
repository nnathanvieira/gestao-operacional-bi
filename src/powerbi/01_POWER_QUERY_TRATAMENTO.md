# Tratamento Power Query

## Configuracao

Crie um parametro de texto chamado `pPastaDashboard`:

```powerquery
"C:\CAMINHO_LOCAL\DASHBOARD_PRODUCAO"
```

Se o nome real da pasta possuir acento, selecione-a pela interface de parametros para evitar erro de digitacao. No Power BI Service, substitua caminhos locais por SharePoint/OneDrive ou configure um gateway.

## Funcoes auxiliares

### fxLerAba

```powerquery
(Caminho as text, Aba as text) as table =>
let
    Fonte = Excel.Workbook(File.Contents(Caminho), null, true),
    ComoAba = Table.SelectRows(Fonte, each [Item] = Aba and [Kind] = "Sheet"),
    ComoTabela = Table.SelectRows(Fonte, each [Item] = Aba and [Kind] = "Table"),
    Dados =
        if Table.RowCount(ComoAba) > 0 then ComoAba{0}[Data]
        else if Table.RowCount(ComoTabela) > 0 then ComoTabela{0}[Data]
        else error "Aba ou tabela nao encontrada: " & Aba
in
    Dados
```

### fxTexto

```powerquery
(Valor as any) as nullable text =>
let
    Resultado =
        if Valor = null then null
        else
            let T = Text.Trim(Text.From(Valor, "pt-BR"))
            in if T = "" then null else T
in
    Resultado
```

### fxChaveTexto

```powerquery
(Valor as any) as nullable text =>
let
    T = fxTexto(Valor)
in
    if T = null then null else Text.Upper(T)
```

## Staging do calendario

### stg_ordens_aux

```powerquery
let
    Caminho = pPastaDashboard & "\CALENDARIO_FABRIL_OPERACIONAL.xlsm",
    Fonte = fxLerAba(Caminho, "ORDENS_AUX"),
    Cabecalhos = Table.PromoteHeaders(Fonte, [PromoteAllScalars=true]),
    SemVazias = Table.SelectRows(Cabecalhos, each List.NonNullCount(Record.FieldValues(_)) > 0),
    Identificadores = Table.TransformColumns(SemVazias, {
        {"ORDEM", fxTexto, type text}, {"ITEM", fxTexto, type text},
        {"MAQUINA", fxTexto, type text}, {"MOLDE_SUGERIDO", fxTexto, type text}
    }),
    Tipos = Table.TransformColumnTypes(Identificadores, {
        {"DATA_STATUS", type date}, {"STATUS", type text},
        {"SETOR_DVCP07", type text}, {"SETOR_PADRAO", type text},
        {"DESCRICAO", type text}, {"QTDE_ORDEM", type number},
        {"QTDE_PRODUZIDA", type number}, {"FATOR_CONVERSAO", type number},
        {"QTDE_ORDEM_CONV", type number}, {"QTDE_PRODUZIDA_CONV", type number},
        {"TEMPO_1000_MAQ_PREP", type number}, {"PECAS_HORA", type number},
        {"HORAS_NECESSARIAS", type number}, {"MAIS_RECENTE", Int64.Type},
        {"PRIORIDADE", Int64.Type}, {"TEMPO_ESTIMADO_H", type number},
        {"INICIO_PREVISTO", type datetime}, {"FIM_PREVISTO", type datetime},
        {"SEQUENCIA_SUGERIDA", Int64.Type}, {"STATUS_PROGRAMACAO", type text}
    }, "pt-BR")
in
    Tipos
```

### stg_item_categoria

Le a classificacao oficial da nova aba `ITEM_CATEGORIA`. Codigos numericos curtos sao completados com zeros a esquerda ate nove posicoes, para coincidir com `ORDENS_AUX`. Codigos alfanumericos sao preservados. Desabilite a carga desta consulta.

```powerquery
let
    Caminho = pPastaDashboard & "\CALENDARIO_FABRIL_OPERACIONAL.xlsm",
    Fonte = fxLerAba(Caminho, "ITEM_CATEGORIA"),
    Cabecalhos = Table.PromoteHeaders(Fonte, [PromoteAllScalars=true]),
    RegistrosReais = Table.SelectRows(Cabecalhos, each fxTexto([ITEM]) <> null),
    ChaveItem = Table.TransformColumns(RegistrosReais, {{"ITEM", each
        let T = Text.Upper(fxTexto(_)), SomenteDigitos = Text.Select(T, {"0".."9"}) = T
        in if SomenteDigitos and Text.Length(T) <= 9 then Text.PadStart(T, 9, "0") else T,
        type text}}),
    Textos = Table.TransformColumns(ChaveItem, {
        {"CATEGORIA", fxTexto, type text}, {"LINHA", fxTexto, type text}
    }),
    Renomeadas = Table.RenameColumns(Textos, {
        {"ITEM", "Item"}, {"CATEGORIA", "TipoItem"}, {"LINHA", "LinhaCategoria"}
    }),
    Agrupada = Table.Group(Renomeadas, {"Item"}, {
        {"TipoItem", each
            let L = List.Distinct(List.Select([TipoItem], (x) => x <> null and x <> ""))
            in if List.IsEmpty(L) then null else Text.Combine(L, " / "), type nullable text},
        {"LinhaCategoria", each List.First(List.RemoveNulls([LinhaCategoria]), null), type nullable text}
    })
in
    Agrupada
```

### stg_dvcp09_meta

Soma todas as operacoes vigentes do item. Os tempos sao tratados como horas para produzir 1.000 pecas, conforme a regra do calendario. Desabilite a carga desta consulta.

```powerquery
let
    Caminho = pPastaDashboard & "\CALENDARIO_FABRIL_OPERACIONAL.xlsm",
    Fonte = fxLerAba(Caminho, "ATUALIZAR_DVCP09"),
    Cabecalhos = Table.PromoteHeaders(Fonte, [PromoteAllScalars=true]),
    RegistrosReais = Table.SelectRows(Cabecalhos, each fxTexto([ITEM]) <> null),
    Identificadores = Table.TransformColumns(RegistrosReais, {{"ITEM", fxTexto, type text}}),
    Tipos = Table.TransformColumnTypes(Identificadores, {
        {"TEMPO HOMEM", type number}, {"TEMPO MAQUINA", type number},
        {"TEMPO PREPARACAO", type number}, {"NUM HOMEM", type number},
        {"DT TERMINO", type date}
    }, "pt-BR"),
    Vigentes = Table.SelectRows(Tipos, each [#"DT TERMINO"] <> null and [#"DT TERMINO"] > Date.From(DateTime.LocalNow())),
    Renomeada = Table.RenameColumns(Vigentes, {{"ITEM", "Item"}}),
    Agrupada = Table.Group(Renomeada, {"Item"}, {
        {"QtdOperacoesAtivas", each Table.RowCount(_), Int64.Type},
        {"TempoHomemAtivo", each List.Sum(List.RemoveNulls([#"TEMPO HOMEM"])), type number},
        {"TempoMaquinaAtivo", each List.Sum(List.RemoveNulls([#"TEMPO MAQUINA"])), type number},
        {"TempoPreparacaoAtivo", each List.Sum(List.RemoveNulls([#"TEMPO PREPARACAO"])), type number},
        {"NumHomemDVCP09", each
            let L = List.Select(List.RemoveNulls([#"NUM HOMEM"]), (x) => x > 0)
            in if List.IsEmpty(L) then null else List.Max(L), type nullable number}
    })
in
    Agrupada
```

### fato_ordens

```powerquery
let
    Fonte = stg_ordens_aux,
    MaisRecente = Table.SelectRows(Fonte, each [MAIS_RECENTE] = 1),
    Selecionadas = Table.SelectColumns(MaisRecente, {
        "ORDEM", "DATA_STATUS", "STATUS", "SETOR_PADRAO", "MAQUINA", "ITEM",
        "DESCRICAO", "QTDE_ORDEM", "QTDE_PRODUZIDA", "FATOR_CONVERSAO",
        "QTDE_ORDEM_CONV", "QTDE_PRODUZIDA_CONV", "HORAS_NECESSARIAS",
        "PECAS_HORA", "TEMPO_1000_MAQ_PREP",
        "MAIS_RECENTE", "MOLDE_SUGERIDO", "PRIORIDADE", "TEMPO_ESTIMADO_H",
        "INICIO_PREVISTO", "FIM_PREVISTO", "SEQUENCIA_SUGERIDA", "STATUS_PROGRAMACAO"
    }, MissingField.UseNull),
    Renomeadas = Table.RenameColumns(Selecionadas, {
        {"ORDEM", "Ordem"}, {"DATA_STATUS", "DataStatus"}, {"STATUS", "StatusOrdem"},
        {"SETOR_PADRAO", "Setor"}, {"MAQUINA", "MaquinaPlanejada"}, {"ITEM", "Item"},
        {"DESCRICAO", "DescricaoItem"}, {"QTDE_ORDEM", "QtdeOrdem"},
        {"QTDE_PRODUZIDA", "QtdeProduzidaSistema"}, {"FATOR_CONVERSAO", "FatorConversao"},
        {"QTDE_ORDEM_CONV", "QtdeOrdemConv"}, {"QTDE_PRODUZIDA_CONV", "QtdeProduzidaConv"},
        {"HORAS_NECESSARIAS", "HorasNecessarias"}, {"MAIS_RECENTE", "MaisRecente"},
        {"PECAS_HORA", "PecasHoraPadrao"}, {"TEMPO_1000_MAQ_PREP", "Tempo1000Padrao"},
        {"MOLDE_SUGERIDO", "MoldeSugerido"}, {"PRIORIDADE", "Prioridade"},
        {"TEMPO_ESTIMADO_H", "TempoEstimadoH"}, {"INICIO_PREVISTO", "InicioPrevisto"},
        {"FIM_PREVISTO", "FimPrevisto"}, {"SEQUENCIA_SUGERIDA", "SequenciaSugerida"},
        {"STATUS_PROGRAMACAO", "StatusProgramacao"}
    }),
    JuntaItem = Table.NestedJoin(Renomeadas, {"Item"}, dim_item, {"Item"}, "DadosItem", JoinKind.LeftOuter),
    ExpandeItem = Table.ExpandTableColumn(JuntaItem, "DadosItem", {
        "TipoItem", "LinhaCategoria", "QtdOperacoesAtivas", "TempoPessoa1000", "MetaPessoaPecasHora"
    }, {
        "TipoItem", "LinhaCategoria", "QtdOperacoesAtivas", "TempoPessoa1000", "MetaPessoaPecasHora"
    })
in
    ExpandeItem
```

### fato_producao_sistema

```powerquery
let
    Fonte = fato_ordens,
    Selecionadas = Table.SelectColumns(Fonte, {
        "Ordem", "Item", "Setor", "QtdeOrdem", "QtdeOrdemConv",
        "QtdeProduzidaSistema", "QtdeProduzidaConv", "StatusOrdem"
    }),
    QuantidadeAnalitica = Table.AddColumn(Selecionadas, "QtdeProduzidaSistemaAnalitica", each
        if [Setor] = "M1" then
            (if [QtdeProduzidaConv] = null then [QtdeProduzidaSistema] else [QtdeProduzidaConv])
        else [QtdeProduzidaSistema], type nullable number)
in
    QuantidadeAnalitica
```

## Normalizacao de setores e maquinas

### dim_setor_alias

```powerquery
let
    Caminho = pPastaDashboard & "\CALENDARIO_FABRIL_OPERACIONAL.xlsm",
    Fonte = fxLerAba(Caminho, "NOMES_SETORES"),
    Cabecalhos = Table.PromoteHeaders(Fonte, [PromoteAllScalars=true]),
    Tipos = Table.TransformColumnTypes(Cabecalhos, {
        {"PADRONIZADO", type text}, {"LINHA", type text}, {"COMPLETO", type text},
        {"DVCP07", type text}, {"DVWM11", type text}
    }),
    Despivotada = Table.UnpivotOtherColumns(Tipos, {"PADRONIZADO"}, "Origem", "Alias"),
    Validada = Table.SelectRows(Despivotada, each fxTexto([Alias]) <> null),
    Chave = Table.AddColumn(Validada, "AliasChave", each fxChaveTexto([Alias]), type text),
    Renomeada = Table.RenameColumns(Chave, {{"PADRONIZADO", "SetorPadrao"}})
in
    Table.Distinct(Renomeada, {"AliasChave"})
```

### dim_maquina_alias

```powerquery
let
    Caminho = pPastaDashboard & "\CALENDARIO_FABRIL_OPERACIONAL.xlsm",
    Fonte = fxLerAba(Caminho, "NOMES_MAQUINAS"),
    Cabecalhos = Table.PromoteHeaders(Fonte, [PromoteAllScalars=true]),
    SomenteAliases = Table.SelectColumns(Cabecalhos, {"PADRONIZADO", "PD104", "DVWM11"}),
    Despivotada = Table.UnpivotOtherColumns(SomenteAliases, {"PADRONIZADO"}, "Origem", "Alias"),
    Proprio = Table.RenameColumns(
        Table.SelectColumns(SomenteAliases, {"PADRONIZADO"}),
        {{"PADRONIZADO", "Alias"}}
    ),
    ProprioComPadrao = Table.AddColumn(Proprio, "PADRONIZADO", each [Alias], type text),
    ProprioComOrigem = Table.AddColumn(ProprioComPadrao, "Origem", each "PADRONIZADO", type text),
    Combinada = Table.Combine({Despivotada, ProprioComOrigem}),
    Valida = Table.SelectRows(Combinada, each fxTexto([Alias]) <> null and [Alias] <> "-"),
    Chave = Table.AddColumn(Valida, "AliasChave", each fxChaveTexto([Alias]), type text),
    Renomeada = Table.RenameColumns(Chave, {{"PADRONIZADO", "MaquinaPadrao"}})
in
    Table.Distinct(Renomeada, {"AliasChave"})
```

## Producao oficial

### stg_producao

```powerquery
let
    Caminho = pPastaDashboard & "\PRODUCAO_INTERVENCOES_QUERY.xlsx",
    Fonte = fxLerAba(Caminho, "PRODUCAO_GERAL"),
    Cabecalhos = Table.PromoteHeaders(Fonte, [PromoteAllScalars=true]),
    RegistrosReais = Table.SelectRows(Cabecalhos, each [DATA] <> null),
    Identificadores = Table.TransformColumns(RegistrosReais, {
        {"MATRÍCULA/GRUPO", fxTexto, type text}, {"ORDEM", fxTexto, type text},
        {"MÁQUINA", fxTexto, type text}, {"TURNO", fxTexto, type text},
        {"LINHA", fxTexto, type text}
    }),
    Tipos = Table.TransformColumnTypes(Identificadores, {
        {"DATA", type date}, {"QUANTIDADE", type number}, {"DURAÇÃO", type number}
    }, "pt-BR"),
    ChaveMaquina = Table.AddColumn(Tipos, "MaquinaChave", each fxChaveTexto([MÁQUINA]), type text),
    ChaveSetor = Table.AddColumn(ChaveMaquina, "LinhaChave", each fxChaveTexto([LINHA]), type text)
in
    ChaveSetor
```

### fato_producao

```powerquery
let
    Fonte = stg_producao,
    JuntaMaquina = Table.NestedJoin(Fonte, {"MaquinaChave"}, dim_maquina_alias, {"AliasChave"}, "MapMaq", JoinKind.LeftOuter),
    ExpandeMaquina = Table.ExpandTableColumn(JuntaMaquina, "MapMaq", {"MaquinaPadrao"}, {"MaquinaPadrao"}),
    MaquinaFinal = Table.AddColumn(ExpandeMaquina, "Maquina", each
        if [MaquinaPadrao] <> null then [MaquinaPadrao] else fxChaveTexto([MÁQUINA]), type text),
    JuntaSetor = Table.NestedJoin(MaquinaFinal, {"LinhaChave"}, dim_setor_alias, {"AliasChave"}, "MapSetor", JoinKind.LeftOuter),
    ExpandeSetor = Table.ExpandTableColumn(JuntaSetor, "MapSetor", {"SetorPadrao"}, {"Setor"}),
    Renomeadas = Table.RenameColumns(ExpandeSetor, {
        {"DATA", "Data"}, {"MATRÍCULA/GRUPO", "MatriculaGrupo"},
        {"ORDEM", "Ordem"}, {"TURNO", "Turno"}, {"QUANTIDADE", "Quantidade"},
        {"LINHA", "Linha"}, {"DURAÇÃO", "DuracaoHoras"}
    }),
    JuntaMetaMaquina = Table.NestedJoin(Renomeadas, {"Maquina"}, dim_maquina, {"Maquina"}, "CadastroMaquina", JoinKind.LeftOuter),
    ExpandeMetaMaquina = Table.ExpandTableColumn(JuntaMetaMaquina, "CadastroMaquina",
        {"MetaPecasHora", "Setor"}, {"MetaMaquinaRealPecasHora", "SetorMaquinaCadastro"}),
    JuntaOrdem = Table.NestedJoin(ExpandeMetaMaquina, {"Ordem"}, fato_ordens, {"Ordem"}, "DadosOrdem", JoinKind.LeftOuter),
    ExpandeOrdem = Table.ExpandTableColumn(JuntaOrdem, "DadosOrdem",
        {"Item", "DescricaoItem", "TipoItem", "LinhaCategoria", "MoldeSugerido", "StatusOrdem", "Setor", "MaquinaPlanejada", "PecasHoraPadrao",
         "MetaPessoaPecasHora",
         "QtdOperacoesAtivas", "TempoPessoa1000", "Tempo1000Padrao", "FatorConversao",
         "QtdeOrdem", "QtdeOrdemConv", "QtdeProduzidaConv"},
        {"Item", "DescricaoItem", "TipoItem", "LinhaCategoria", "Molde", "StatusOrdem", "SetorOrdem", "MaquinaPlanejada", "PecasHoraPadrao",
         "MetaPessoaPecasHora",
         "QtdOperacoesAtivas", "TempoPessoa1000", "Tempo1000Padrao", "FatorConversao",
         "QtdeOrdem", "QtdeOrdemConv", "QtdeProduzidaSistemaConv"}),
    // Regra unica para todos os setores: DURAÇÃO e a base do lancamento real.
    // PARAM_TURNOS permanece apenas como fonte de disponibilidade e planejamento.
    HorasEficiencia = Table.AddColumn(ExpandeOrdem, "HorasEficiencia", each [DuracaoHoras], type nullable number),
    PlanejadaAnalitica = Table.AddColumn(HorasEficiencia, "QtdePlanejadaAnalitica", each
        if [SetorOrdem] = "M1" then [QtdeOrdemConv] else [QtdeOrdem], type nullable number),
    SetorCoerente = Table.AddColumn(PlanejadaAnalitica, "SetorCoerente", each
        [Setor] <> null and [SetorOrdem] <> null and [Setor] = [SetorOrdem], type logical),
    MetaItemM1Convertida = Table.AddColumn(SetorCoerente, "MetaItemM1Convertida", each
        if [PecasHoraPadrao] <> null and [PecasHoraPadrao] > 0 then [PecasHoraPadrao] else null,
        type nullable number),
    MetaEficiencia = Table.AddColumn(MetaItemM1Convertida, "MetaEficienciaHora", each
        if [Setor] = "M2" then
            if [MetaPessoaPecasHora] <> null and [MetaPessoaPecasHora] > 0 then [MetaPessoaPecasHora] else null
        else if [Setor] = "M1" then
            if [MetaItemM1Convertida] <> null and [MetaItemM1Convertida] > 0 then [MetaItemM1Convertida]
            else if [MetaMaquinaRealPecasHora] <> null and [MetaMaquinaRealPecasHora] > 0 then [MetaMaquinaRealPecasHora]
            else null
        else
            if [PecasHoraPadrao] <> null and [PecasHoraPadrao] > 0 then [PecasHoraPadrao] else null,
        type nullable number),
    FonteMeta = Table.AddColumn(MetaEficiencia, "FonteMetaEficiencia", each
        if [MetaEficienciaHora] = null then "SEM_META"
        else if [Setor] = "M2" then "M2_ITEM_DVCP09_POR_PESSOA"
        else if [Setor] = "M1" and [MetaItemM1Convertida] <> null then "M1_ITEM_ORDENS_AUX_CONVERTIDA"
        else if [Setor] = "M1" then "M1_MAQUINA_REAL_CAD_MAQUINAS"
        else "ORDEM_PECAS_HORA", type text),
    MetaValida = Table.AddColumn(FonteMeta, "MetaValidaEficiencia", each
        [Item] <> null and [SetorCoerente] and [HorasEficiencia] <> null and [HorasEficiencia] > 0 and
        [Quantidade] <> null and [Quantidade] >= 0 and [MetaEficienciaHora] <> null and [MetaEficienciaHora] > 0,
        type logical),
    MotivoExclusao = Table.AddColumn(MetaValida, "MotivoExclusaoEficiencia", each
        if [Item] = null then "ORDEM_NAO_LOCALIZADA"
        else if not [SetorCoerente] then "SETOR_LANCADO_DIFERENTE_DA_ORDEM"
        else if [HorasEficiencia] = null or [HorasEficiencia] <= 0 then "DURACAO_INVALIDA"
        else if [Quantidade] = null or [Quantidade] < 0 then "QUANTIDADE_INVALIDA"
        else if [MetaEficienciaHora] = null or [MetaEficienciaHora] <= 0 then "ITEM_SEM_META_CLARA"
        else null, type nullable text),
    QuantidadeEficiencia = Table.AddColumn(MotivoExclusao, "QuantidadeEficiencia", each
        if [MetaValidaEficiencia] then [Quantidade] else null, type nullable number),
    ChaveEvento = Table.AddColumn(QuantidadeEficiencia, "ChaveEvento", each Text.Combine({
        Date.ToText([Data], "yyyyMMdd"), fxTexto([MatriculaGrupo]) ?? "",
        fxTexto([Ordem]) ?? "", fxTexto([Maquina]) ?? "", fxTexto([Turno]) ?? "",
        Number.ToText([Quantidade] ?? 0, "0.############", "en-US"),
        Number.ToText([HorasEficiencia] ?? 0, "0.############", "en-US")
    }, "|"), type text),
    Contagem = Table.Group(ChaveEvento, {"ChaveEvento"}, {{"QtdIguais", each Table.RowCount(_), Int64.Type}}),
    JuntaContagem = Table.NestedJoin(ChaveEvento, {"ChaveEvento"}, Contagem, {"ChaveEvento"}, "Dup", JoinKind.LeftOuter),
    ExpandeContagem = Table.ExpandTableColumn(JuntaContagem, "Dup", {"QtdIguais"}, {"QtdIguais"}),
    MarcaDuplicidade = Table.AddColumn(ExpandeContagem, "PossivelDuplicidade", each [QtdIguais] > 1, type logical),
    Selecionadas = Table.SelectColumns(MarcaDuplicidade, {
        "Data", "MatriculaGrupo", "Ordem", "Maquina", "Turno", "Quantidade",
        "Linha", "DuracaoHoras", "HorasEficiencia", "Setor", "Item", "DescricaoItem", "TipoItem", "Molde",
        "LinhaCategoria", "StatusOrdem", "SetorOrdem", "MaquinaPlanejada", "PecasHoraPadrao",
        "MetaPessoaPecasHora", "MetaMaquinaRealPecasHora", "SetorMaquinaCadastro",
        "QtdOperacoesAtivas", "TempoPessoa1000", "Tempo1000Padrao", "FatorConversao",
        "MetaItemM1Convertida", "MetaEficienciaHora", "FonteMetaEficiencia",
        "MetaValidaEficiencia", "MotivoExclusaoEficiencia", "QuantidadeEficiencia", "SetorCoerente",
        "QtdePlanejadaAnalitica", "QtdeProduzidaSistemaConv", "ChaveEvento", "PossivelDuplicidade"
    })
in
    Selecionadas
```

> `??` e suportado nas versoes atuais do Power Query. Se sua versao nao aceitar o operador, substitua `X ?? Y` por `if X = null then Y else X`.

## Programacao e disponibilidade

### fato_programacao

```powerquery
let
    Caminho = pPastaDashboard & "\CALENDARIO_FABRIL_OPERACIONAL.xlsm",
    Fonte = fxLerAba(Caminho, "PROGRAMACAO_ORDENS"),
    Cabecalhos = Table.PromoteHeaders(Fonte, [PromoteAllScalars=true]),
    RegistrosReais = Table.SelectRows(Cabecalhos, each fxTexto([SETOR]) <> null),
    Identificadores = Table.TransformColumns(RegistrosReais, {
        {"SETOR", fxChaveTexto, type text}, {"MAQUINA", fxTexto, type text},
        {"ITEM", fxTexto, type text}, {"MOLDE_SUGERIDO", fxTexto, type text}
    }),
    Tipos = Table.TransformColumnTypes(Identificadores, {
        {"QTDE_PROGRAMADA_SLOT", type number}, {"TEMPO_ESTIMADO_H", type number},
        {"HORAS_ALOCADAS", type number}, {"INICIO_PREVISTO", type datetime},
        {"FIM_PREVISTO", type datetime}, {"DIAS_NECESSARIOS", type number},
        {"DIAS_DISPONIVEIS", type number}, {"PRIORIDADE", Int64.Type}, {"STATUS", type text}
    }, "pt-BR"),
    Renomeadas = Table.RenameColumns(Tipos, {
        {"SETOR", "Setor"}, {"MAQUINA", "Maquina"}, {"ITEM", "Item"},
        {"QTDE_PROGRAMADA_SLOT", "QtdeProgramada"}, {"MOLDE_SUGERIDO", "Molde"},
        {"TEMPO_ESTIMADO_H", "TempoEstimadoH"}, {"HORAS_ALOCADAS", "HorasAlocadas"},
        {"INICIO_PREVISTO", "InicioPrevisto"}, {"FIM_PREVISTO", "FimPrevisto"},
        {"DIAS_NECESSARIOS", "DiasNecessarios"}, {"DIAS_DISPONIVEIS", "DiasDisponiveis"},
        {"PRIORIDADE", "Prioridade"}, {"STATUS", "StatusProgramacao"}
    }),
    DataInicio = Table.AddColumn(Renomeadas, "InicioPrevistoData", each try Date.From([InicioPrevisto]) otherwise null, type date)
in
    DataInicio
```

### fato_disponibilidade

```powerquery
let
    Caminho = pPastaDashboard & "\CALENDARIO_FABRIL_OPERACIONAL.xlsm",
    Fonte = fxLerAba(Caminho, "CALENDARIO FABRIL"),
    Cabecalhos = Table.PromoteHeaders(Fonte, [PromoteAllScalars=true]),
    RegistrosReais = Table.SelectRows(Cabecalhos, each [DATA] <> null and fxTexto([SETOR]) <> null),
    Identificadores = Table.TransformColumns(RegistrosReais, {
        {"MATRICULA", fxTexto, type text}, {"MAQUINA", fxTexto, type text},
        {"MOLDE", fxTexto, type text}, {"TURNO", fxTexto, type text}, {"SETOR", fxChaveTexto, type text}
    }, null, MissingField.Ignore),
    Tipos = Table.TransformColumnTypes(Identificadores, {
        {"DATA", type date}, {"QTDE DE PESSOAS", type number}, {"META", type number},
        {"CICLO", type number}, {"CAVIDADES", type number}, {"HORAS PARADAS", type number},
        {"HORAS SETUP", type number}, {"HORAS TOTAIS", type number},
        {"HORAS TRABALHADAS REAIS", type number}, {"CAPACIDADE PECAS", type number}
    }, "pt-BR"),
    Renomeadas = Table.RenameColumns(Tipos, {
        {"DATA", "Data"}, {"SETOR", "Setor"}, {"MATRICULA", "Matricula"},
        {"QTDE DE PESSOAS", "QtdPessoas"}, {"MAQUINA", "Maquina"}, {"META", "Meta"},
        {"CICLO", "Ciclo"}, {"CAVIDADES", "Cavidades"}, {"TURNO", "Turno"},
        {"TRABALHA?", "Trabalha"}, {"HORAS PARADAS", "HorasParadas"},
        {"HORAS SETUP", "HorasSetup"}, {"MOLDE", "Molde"}, {"HORAS TOTAIS", "HorasTotais"},
        {"HORAS TRABALHADAS REAIS", "HorasTrabalhadasReais"},
        {"CAPACIDADE PECAS", "CapacidadePecas"}, {"STATUS", "StatusRecurso"},
        {"ALERTA", "Alerta"}, {"ID REGISTRO", "IdRegistro"}, {"OBS", "Observacao"}
    }, MissingField.Ignore)
in
    Renomeadas
```

### stg_param_turnos

Base diária planejada de funcionamento de máquinas e pessoas. Use esta consulta para horas executadas por referência quando houver lançamento real em `fato_producao`; não use como produção real. A coluna válida para horas é `HORAS_REAIS_REF`.

```powerquery
let
    Caminho = pPastaDashboard & "\CALENDARIO_FABRIL_OPERACIONAL.xlsm",
    Fonte = fxLerAba(Caminho, "PARAM_TURNOS"),
    Cabecalhos = Table.PromoteHeaders(Fonte, [PromoteAllScalars=true]),
    RegistrosReais = Table.SelectRows(Cabecalhos, each [DATA] <> null and fxTexto([SETOR]) <> null),
    Identificadores = Table.TransformColumns(RegistrosReais, {
        {"SETOR", fxChaveTexto, type text}, {"TURNO", fxTexto, type text},
        {"MAQUINA", fxTexto, type text}, {"MATRICULA", fxTexto, type text},
        {"NOME", fxTexto, type text}, {"TIPO_RECURSO", fxChaveTexto, type text},
        {"TRABALHA?", fxChaveTexto, type text}
    }, null, MissingField.Ignore),
    Tipos = Table.TransformColumnTypes(Identificadores, {
        {"DATA", type date}, {"HORA_INICIO", type number}, {"HORA_FIM", type number},
        {"HORAS_TOTAIS", type number}, {"DDS", type number}, {"INICIO_DESC", type number},
        {"CHECK_LIST", type number}, {"LIMPEZA", type number}, {"ALMOCO", type number},
        {"HORAS_REAIS_REF", type number}, {"DIA_MES", Int64.Type},
        {"HORAS_PARADAS", type number}, {"HORAS_SETUP", type number}
    }, "pt-BR"),
    Renomeadas = Table.RenameColumns(Tipos, {
        {"SETOR", "Setor"}, {"TURNO", "Turno"}, {"MAQUINA", "Maquina"},
        {"DATA", "Data"}, {"HORA_INICIO", "HoraInicio"}, {"HORA_FIM", "HoraFim"},
        {"HORAS_TOTAIS", "HorasTotais"}, {"HORAS_REAIS_REF", "HorasReaisRef"},
        {"DIA_MES", "DiaMes"}, {"DIA DA SEMANA", "DiaSemana"},
        {"TRABALHA?", "Trabalha"}, {"HORAS_PARADAS", "HorasParadas"},
        {"HORAS_SETUP", "HorasSetup"}, {"TIPO_RECURSO", "TipoRecurso"},
        {"MATRICULA", "Matricula"}, {"NOME", "Nome"}, {"OBS", "Observacao"}
    }, MissingField.Ignore),
    RecursoChave = Table.AddColumn(Renomeadas, "RecursoChave", each
        if fxTexto([Maquina]) <> null then fxChaveTexto([Maquina]) else fxChaveTexto([Matricula]), type nullable text)
in
    RecursoChave
```

### fato_param_turnos

```powerquery
let
    Fonte = stg_param_turnos,
    SomenteValidas = Table.SelectRows(Fonte, each [Trabalha] = "SIM" and [HorasReaisRef] <> null)
in
    SomenteValidas
```

### stg_horas_prod

Base nova para horas produtivas futuras. Ela possui data e substitui a dependência de `DADOS MENSAIS` para dados novos, quando houver carga futura.

```powerquery
let
    Caminho = pPastaDashboard & "\CALENDARIO_FABRIL_OPERACIONAL.xlsm",
    Fonte = fxLerAba(Caminho, "HORAS_PROD"),
    Cabecalhos = Table.PromoteHeaders(Fonte, [PromoteAllScalars=true]),
    RegistrosReais = Table.SelectRows(Cabecalhos, each [DATA] <> null and fxTexto([SETOR]) <> null),
    Tipos = Table.TransformColumnTypes(RegistrosReais, {
        {"DATA", type date}, {"QTDE FUNCIONARIOS", type number},
        {"HORAS EXTRAS", type number}, {"HORAS PRODUTIVAS", type number},
        {"HORAS TOTAIS", type number}
    }, "pt-BR"),
    Renomeadas = Table.RenameColumns(Tipos, {
        {"DATA", "Data"}, {"SETOR", "Setor"}, {"QTDE FUNCIONARIOS", "QtdFuncionarios"},
        {"HORAS EXTRAS", "HorasExtras"}, {"HORAS PRODUTIVAS", "HorasProdutivas"},
        {"HORAS TOTAIS", "HorasTotais"}
    }, MissingField.Ignore),
    SetorPadrao = Table.TransformColumns(Renomeadas, {{"Setor", fxChaveTexto, type text}}, null, MissingField.Ignore)
in
    SetorPadrao
```

### fato_horas_prod

```powerquery
let
    Fonte = stg_horas_prod
in
    Fonte
```

## Manutencao

### stg_manutencao_detalhe

Esta consulta apenas le e tipa o arquivo DVWM11. Manter a leitura separada da combinacao com aliases evita o erro `Formula.Firewall`.

```powerquery
let
    Caminho = pPastaDashboard & "\DVWM11.xlsm",
    Fonte = fxLerAba(Caminho, "Relatório Macro"),
    Cabecalhos = Table.PromoteHeaders(Fonte, [PromoteAllScalars=true]),
    RegistrosReais = Table.SelectRows(Cabecalhos, each fxTexto([Ordem]) <> null),
    Identificadores = Table.TransformColumns(RegistrosReais, {
        {"Matricula", fxTexto, type text}, {"Ordem", fxTexto, type text},
        {"Equipamento", fxTexto, type text}, {"Equipamento2", fxTexto, type text}
    }),
    Tipos = Table.TransformColumnTypes(Identificadores, {
        {"Data e hora abertura ordem", type datetime}, {"Data e hora início da tarefa", type datetime},
        {"Data e hora término da tarefa", type datetime}, {"Tempo total máquina parada", type number},
        {"Duração da Ordem", type number}, {"Tempo de Resposta", type number},
        {"Horas de Manutenção no Equipamento", type number}, {"Data", type date}
    }, "pt-BR"),
    ColunasErroAux = List.Intersect({Table.ColumnNames(Tipos), {"Turno2", "Turno", "Setor", "Tipo de manutenção", "Intervenção", "Sintoma", "Causa"}}),
    SemErrosAuxiliares = Table.ReplaceErrorValues(Tipos, List.Transform(ColunasErroAux, each {_, null})),
    MaquinaOrigem = Table.AddColumn(SemErrosAuxiliares, "MaquinaOrigem", each
        if fxTexto([Equipamento2]) <> null then fxTexto([Equipamento2]) else fxTexto([Equipamento]), type text),
    ChaveMaquina = Table.AddColumn(MaquinaOrigem, "MaquinaChave", each fxChaveTexto([MaquinaOrigem]), type text)
in
    ChaveMaquina
```

### fato_manutencao_detalhe

Esta consulta nao abre arquivo diretamente. Ela combina o staging da manutencao com a tabela de aliases.

```powerquery
let
    Fonte = stg_manutencao_detalhe,
    JuntaMaquina = Table.NestedJoin(Fonte, {"MaquinaChave"}, dim_maquina_alias, {"AliasChave"}, "Map", JoinKind.LeftOuter),
    Expande = Table.ExpandTableColumn(JuntaMaquina, "Map", {"MaquinaPadrao"}, {"MaquinaPadrao"}),
    Maquina = Table.AddColumn(Expande, "Maquina", each if [MaquinaPadrao] <> null then [MaquinaPadrao] else fxChaveTexto([MaquinaOrigem]), type text),
    Renomeadas = Table.RenameColumns(Maquina, {
        {"Matricula", "MatriculaTecnico"}, {"Técnico", "Tecnico"}, {"Ordem", "OrdemManutencao"},
        {"Setor", "SetorOrigem"}, {"Tipo de manutenção", "TipoManutencao"},
        {"Intervenção", "Intervencao"},
        {"Tempo total máquina parada", "HorasParada"}, {"Tempo de Resposta", "HorasResposta"},
        {"Horas de Manutenção no Equipamento", "HorasExecucao"}
    })
in
    Renomeadas
```

### fato_manutencao_ordem

```powerquery
let
    Fonte = fato_manutencao_detalhe,
    Agrupada = Table.Group(Fonte, {"OrdemManutencao"}, {
        {"Data", each List.Min(List.RemoveNulls([Data]), null), type nullable date},
        {"Maquina", each List.First(List.RemoveNulls([Maquina]), null), type nullable text},
        {"Setor", each List.First(List.RemoveNulls([SetorOrigem]), null), type nullable text},
        {"TipoManutencao", each List.First(List.RemoveNulls([TipoManutencao]), null), type nullable text},
        {"Sintoma", each List.First(List.RemoveNulls([Sintoma]), null), type nullable text},
        {"Causa", each List.First(List.RemoveNulls([Causa]), null), type nullable text},
        {"HorasParada", each List.Max(List.RemoveNulls([HorasParada]), 0), type number},
        {"HorasResposta", each List.Min(List.RemoveNulls([HorasResposta]), null), type nullable number},
        {"HorasExecucao", each List.Max(List.RemoveNulls([HorasExecucao]), 0), type number},
        {"QtdTecnicosTarefas", each Table.RowCount(_), Int64.Type}
    }),
    Classificada = Table.AddColumn(Agrupada, "ClasseManutencao", each
        let
            T = Text.Upper(Text.Trim([TipoManutencao] ?? "")),
            Mapa = [
                #"AJUSTE DE MAQUINA / MOLDE" = "CORRETIVA",
                #"VEDAÇÃO DE CAVIDADE" = "CORRETIVA",
                #"SAINDO PARA FERRAMENTARIA" = "CORRETIVA",
                #"INICIO DE PRODUÇÃO" = "CORRETIVA",
                SETUP = "CORRETIVA",
                #"PADRAO MANUT. INDUSTRIAL" = "PREVENTIVA",
                PREDITIVA = "PREVENTIVA",
                #"CORRETIVA MECÂNICA" = "CORRETIVA",
                #"CORRETIVA MECANICA" = "CORRETIVA",
                PREVENTIVAS = "PREVENTIVA",
                #"RETROFIT MOLDES" = "PREVENTIVA",
                #"CORRETIVA MOLDES" = "CORRETIVA",
                #"MANUTENCAO GERAL FERRAMENTARIA SEM OM" = "CORRETIVA",
                #"MANUTENCAO CORRETIVA LOCAL" = "CORRETIVA",
                #"PROJETOS NOVOS" = "PREVENTIVA",
                #"TROCA DE VERSAO DO MOLDE" = "PREVENTIVA",
                #"LIGAR SETOR" = "PREVENTIVA",
                PROJETOS = "PREVENTIVA",
                #"RETORNO DA FERRAMENTARIA" = "CORRETIVA",
                #"CORRETIVA ELETRICA" = "CORRETIVA",
                #"CORRETIVA ELETRONICA" = "CORRETIVA",
                PADRAO = "PREVENTIVA",
                #"PREVENTIVA MOLDES" = "PREVENTIVA",
                #"INSTALAÇÃO" = "PREVENTIVA",
                #"CORRETIVA HIDRAULICA" = "CORRETIVA",
                #"CHECK- LISTER" = "PREVENTIVA",
                #"QUEIMA DE BICO" = "PREVENTIVA",
                #"CORRETIVA REFRIGERAÇÃO" = "CORRETIVA",
                #"INSTALACAO REFRIGERAÇÃO" = "PREVENTIVA",
                #"PREVENTIVA REFRIGERAÇÃO" = "PREVENTIVA",
                #"POS PREVENTIVA" = "CORRETIVA"
            ]
        in
            Record.FieldOrDefault(
                Mapa,
                T,
                if Text.Contains(T, "PREVENT") then "PREVENTIVA"
                else if Text.Contains(T, "CORRET") then "CORRETIVA"
                else if Text.Contains(T, "SETUP") or Text.Contains(T, "AJUSTE") then "CORRETIVA"
                else "OUTRA"
            ), type text)
in
    Classificada
```

## Grupos, ausencias e rateio

### fato_grupos_eventos

```powerquery
let
    Caminho = pPastaDashboard & "\GRUPOS_TRABALHO_QUERY.xlsx",
    Fonte = fxLerAba(Caminho, "GRUPOS_TRABALHO"),
    Cabecalhos = Table.PromoteHeaders(Fonte, [PromoteAllScalars=true]),
    RegistrosReais = Table.SelectRows(Cabecalhos, each fxTexto([TIPO DE CADASTRO]) <> null),
    Identificadores = Table.TransformColumns(RegistrosReais, {
        {"GRUPO", fxTexto, type text}, {"MATRÍCULA", fxTexto, type text},
        {"TURNO", fxTexto, type text}, {"SETOR", fxChaveTexto, type text},
        {"TIPO DE CADASTRO", fxChaveTexto, type text}
    }),
    Tipos = Table.TransformColumnTypes(Identificadores, {
        {"DATA", type date}, {"HR INICIO", type time}, {"HR FIM", type time}
    }, "pt-BR"),
    Renomeadas = Table.RenameColumns(Tipos, {
        {"DATA", "DataEvento"}, {"GRUPO", "Grupo"}, {"MATRÍCULA", "Matricula"},
        {"TURNO", "Turno"}, {"SETOR", "Setor"}, {"TIPO DE CADASTRO", "TipoCadastro"},
        {"HR INICIO", "HoraInicio"}, {"HR FIM", "HoraFim"}
    })
in
    Renomeadas
```

### fato_grupos_vigencia

```powerquery
let
    Fonte = Table.SelectRows(fato_grupos_eventos, each [TipoCadastro] = "CAD_GRUPOS"),
    DataMaxima = List.Max(fato_disponibilidade[Data]),
    DatasMudanca = Table.Distinct(Table.SelectColumns(Fonte, {"Grupo", "DataEvento"})),
    IntervalosPorGrupo = Table.Group(DatasMudanca, {"Grupo"}, {{"Intervalos", (t as table) =>
        let
            Ordenada = Table.Sort(t, {{"DataEvento", Order.Ascending}}),
            Indexada = Table.AddIndexColumn(Ordenada, "Idx", 0, 1, Int64.Type),
            Proxima = Table.AddColumn(Indexada, "DataFimExclusiva", each
                try Indexada[DataEvento]{[Idx] + 1} otherwise Date.AddDays(DataMaxima, 1), type date)
        in
            Table.RemoveColumns(Proxima, {"Grupo", "Idx"}), type table}}),
    ExpandeIntervalos = Table.ExpandTableColumn(IntervalosPorGrupo, "Intervalos", {"DataEvento", "DataFimExclusiva"}),
    JuntaMembros = Table.NestedJoin(ExpandeIntervalos, {"Grupo", "DataEvento"}, Fonte, {"Grupo", "DataEvento"}, "Membros", JoinKind.LeftOuter),
    ExpandeMembros = Table.ExpandTableColumn(JuntaMembros, "Membros", {"Matricula", "Turno", "Setor"}),
    Datas = Table.AddColumn(ExpandeMembros, "Data", each List.Dates(
        [DataEvento], Duration.Days([DataFimExclusiva] - [DataEvento]), #duration(1,0,0,0)), type list),
    ExpandeDatas = Table.ExpandListColumn(Datas, "Data"),
    Selecionadas = Table.SelectColumns(ExpandeDatas, {"Data", "Grupo", "Matricula", "Turno", "Setor", "DataEvento"})
in
    Selecionadas
```

### fato_ausencias

```powerquery
let
    Fonte = Table.SelectRows(fato_grupos_eventos, each [TipoCadastro] = "CAD_AUSENCIA"),
    Duracao = Table.AddColumn(Fonte, "HorasAusentes", each
        if [HoraInicio] = null or [HoraFim] = null then null
        else
            let H = (Number.From([HoraFim]) - Number.From([HoraInicio])) * 24
            in if H < 0 then H + 24 else H, type number),
    Renomeada = Table.RenameColumns(Duracao, {{"DataEvento", "Data"}})
in
    Renomeada
```

### fato_producao_pessoa

```powerquery
let
    Fonte = fato_producao,
    Individual = Table.SelectRows(Fonte, each [MatriculaGrupo] <> null and not Text.StartsWith(Text.Upper([MatriculaGrupo]), "GRUPO")),
    IndividualMatricula = Table.AddColumn(Individual, "Matricula", each [MatriculaGrupo], type text),
    IndividualGrupo = Table.AddColumn(IndividualMatricula, "Grupo", each null, type nullable text),
    IndividualTipo = Table.AddColumn(IndividualGrupo, "TipoAtribuicao", each "INDIVIDUAL", type text),
    IndividualQtd = Table.AddColumn(IndividualTipo, "QuantidadeAtribuida", each [Quantidade], type number),
    IndividualQtdValida = Table.AddColumn(IndividualQtd, "QuantidadeEficienciaAtribuida", each [QuantidadeEficiencia], type nullable number),
    IndividualDur = Table.AddColumn(IndividualQtdValida, "DuracaoAtribuida", each [DuracaoHoras], type nullable number),
    IndividualMembros = Table.AddColumn(IndividualDur, "QtdMembros", each 1, Int64.Type),

    GrupoFonte = Table.SelectRows(Fonte, each [MatriculaGrupo] <> null and Text.StartsWith(Text.Upper([MatriculaGrupo]), "GRUPO")),
    GrupoRenomeado = Table.RenameColumns(GrupoFonte, {{"MatriculaGrupo", "Grupo"}}),
    JuntaVigencia = Table.NestedJoin(GrupoRenomeado, {"Data", "Grupo"}, fato_grupos_vigencia, {"Data", "Grupo"}, "Membros", JoinKind.LeftOuter),
    ExpandeMembros = Table.ExpandTableColumn(JuntaVigencia, "Membros", {"Matricula"}, {"Matricula"}),
    Contagem = Table.Group(ExpandeMembros, {"ChaveEvento"}, {{"QtdMembros", each List.NonNullCount([Matricula]), Int64.Type}}),
    JuntaContagem = Table.NestedJoin(ExpandeMembros, {"ChaveEvento"}, Contagem, {"ChaveEvento"}, "Cont", JoinKind.LeftOuter),
    ExpandeContagem = Table.ExpandTableColumn(JuntaContagem, "Cont", {"QtdMembros"}, {"QtdMembros"}),
    GrupoTipo = Table.AddColumn(ExpandeContagem, "TipoAtribuicao", each
        if [QtdMembros] = null or [QtdMembros] = 0 then "GRUPO_SEM_COMPOSICAO" else "RATEIO_GRUPO", type text),
    GrupoQtd = Table.AddColumn(GrupoTipo, "QuantidadeAtribuida", each
        if [QtdMembros] = null or [QtdMembros] = 0 then null else [Quantidade] / [QtdMembros], type nullable number),
    GrupoQtdValida = Table.AddColumn(GrupoQtd, "QuantidadeEficienciaAtribuida", each
        if [QtdMembros] = null or [QtdMembros] = 0 or [QuantidadeEficiencia] = null
        then null else [QuantidadeEficiencia] / [QtdMembros], type nullable number),
    GrupoDur = Table.AddColumn(GrupoQtdValida, "DuracaoAtribuida", each
        let HorasBase = [DuracaoHoras]
        in if [QtdMembros] = null or [QtdMembros] = 0 or HorasBase = null then null else HorasBase,
        type nullable number),

    Colunas = {"Data", "Ordem", "Maquina", "Setor", "Turno", "Item", "Grupo", "Matricula",
        "DescricaoItem", "TipoItem", "LinhaCategoria", "PecasHoraPadrao", "MetaPessoaPecasHora",
        "MetaEficienciaHora", "FonteMetaEficiencia", "MetaValidaEficiencia", "MotivoExclusaoEficiencia",
        "QtdOperacoesAtivas", "TempoPessoa1000", "HorasEficiencia", "QuantidadeAtribuida", "QuantidadeEficienciaAtribuida", "DuracaoAtribuida",
        "QtdMembros", "TipoAtribuicao", "ChaveEvento"},
    CombinadaBase = Table.Combine({
        Table.SelectColumns(IndividualMembros, Colunas, MissingField.UseNull),
        Table.SelectColumns(GrupoDur, Colunas, MissingField.UseNull)
    }),
    MetaAtribuida = Table.AddColumn(CombinadaBase, "MetaPecasAtribuida", each
        if [Matricula] = null or not [MetaValidaEficiencia] or [DuracaoAtribuida] = null or [MetaEficienciaHora] = null
        then null
        else if [TipoAtribuicao] = "RATEIO_GRUPO" and [Setor] <> "M2" then
            ([DuracaoAtribuida] * [MetaEficienciaHora]) / [QtdMembros]
        else [DuracaoAtribuida] * [MetaEficienciaHora], type nullable number),
    MetaGrupoHora = Table.AddColumn(MetaAtribuida, "MetaGrupoPecasHora", each
        if [QtdMembros] = null or [QtdMembros] <= 0 or [MetaEficienciaHora] = null then null
        else if [Setor] = "M2" then [MetaEficienciaHora] * [QtdMembros]
        else [MetaEficienciaHora], type nullable number)
in
    MetaGrupoHora
```

Somente o setor `M2` multiplica a meta pela composicao real do grupo no dia. Nos demais setores, quantidade e meta sao rateadas entre os componentes apenas para permitir a leitura individual; a soma retorna a meta unica do recurso, sem multiplicacao por pessoas.

### fato_eficiencia_lancamento

> Crie esta nova consulta com carga habilitada. Ela e a fonte unica das horas executadas e da eficiencia a partir de junho/2026. A duracao de um turno repetida por engano e considerada uma unica vez e rateada pela quantidade produzida.

```powerquery
let
    Fonte = fato_producao,
    ComRecurso = Table.AddColumn(Fonte, "RecursoEficiencia", each if [Maquina] <> null and Text.Trim(Text.From([Maquina])) <> "" then Text.From([Maquina]) else if [MatriculaGrupo] <> null then Text.From([MatriculaGrupo]) else null, type nullable text),
    ComIndice = Table.AddIndexColumn(ComRecurso, "IdLancamentoEficiencia", 1, 1, Int64.Type),
    AgrupadoTurno = Table.Group(ComIndice, {"Data", "Setor", "RecursoEficiencia", "Turno"}, {
        {"Linhas", each _, type table},
        {"QtdLancamentosTurno", each Table.RowCount(_), Int64.Type},
        {"MenorDuracaoTurno", each let v = List.RemoveNulls([DuracaoHoras]) in if List.IsEmpty(v) then null else List.Min(v), type nullable number},
        {"DuracaoUnicaTurno", each let v = List.RemoveNulls([DuracaoHoras]) in if List.IsEmpty(v) then null else List.Max(v), type nullable number},
        {"QuantidadeTurno", each List.Sum(List.Transform([Quantidade], each if _ = null then 0 else _)), type number}
    }),
    RateiaDuracao = Table.AddColumn(AgrupadoTurno, "LinhasRateadas", each let ql = [QtdLancamentosTurno], md = [MenorDuracaoTurno], du = [DuracaoUnicaTurno], qt = [QuantidadeTurno], repetir = ql >= 2 and md <> null and md >= 8 and qt > 0 in Table.AddColumn([Linhas], "DuracaoRateada", (r) => if repetir then du * (if r[Quantidade] = null then 0 else r[Quantidade]) / qt else r[DuracaoHoras], type nullable number), type table),
    SemChavesExternas = Table.RemoveColumns(RateiaDuracao, {"Data", "Setor", "RecursoEficiencia", "Turno", "Linhas"}),
    Expandida = Table.ExpandTableColumn(SemChavesExternas, "LinhasRateadas", List.Combine({Table.ColumnNames(ComIndice), {"DuracaoRateada"}})),
    ParadasBase = Table.SelectRows(fato_disponibilidade, each [Trabalha] = "SIM"),
    ParadasRecurso = Table.AddColumn(ParadasBase, "RecursoEficiencia", each if [Maquina] <> null and Text.Trim(Text.From([Maquina])) <> "" then Text.From([Maquina]) else if [Matricula] <> null then Text.From([Matricula]) else null, type nullable text),
    ParadasTurno = Table.Group(ParadasRecurso, {"Data", "Setor", "RecursoEficiencia", "Turno"}, {{"HorasParadasTurno", each List.Sum(List.Transform([HorasParadas], each if _ = null then 0 else _)), type number}}),
    JuntaParadas = Table.NestedJoin(Expandida, {"Data", "Setor", "RecursoEficiencia", "Turno"}, ParadasTurno, {"Data", "Setor", "RecursoEficiencia", "Turno"}, "Paradas", JoinKind.LeftOuter),
    ExpandeParadas = Table.ExpandTableColumn(JuntaParadas, "Paradas", {"HorasParadasTurno"}, {"HorasParadasTurno"}),
    ParadaRateada = Table.AddColumn(ExpandeParadas, "HorasParadasRateadas", each if [HorasParadasTurno] = null or [HorasParadasTurno] <= 0 then 0 else if [QtdLancamentosTurno] > 1 and [QuantidadeTurno] > 0 then [HorasParadasTurno] * (if [Quantidade] = null then 0 else [Quantidade]) / [QuantidadeTurno] else [HorasParadasTurno], type number),
    HorasLiquidas = Table.AddColumn(ParadaRateada, "HorasTrabalhadasLiquidas", each let h = (if [DuracaoRateada] = null then 0 else [DuracaoRateada]) - [HorasParadasRateadas] in if h < 0 then 0 else h, type number),
    MembrosM2Base = Table.SelectRows(fato_producao_pessoa, each [Setor] = "M2"),
    MembrosM2 = Table.Group(MembrosM2Base, {"ChaveEvento"}, {{"QtdMembrosEficiencia", each let v = List.RemoveNulls([QtdMembros]) in if List.IsEmpty(v) then 1 else List.Max(v), Int64.Type}}),
    JuntaMembros = Table.NestedJoin(HorasLiquidas, {"ChaveEvento"}, MembrosM2, {"ChaveEvento"}, "MembrosM2", JoinKind.LeftOuter),
    ExpandeMembros = Table.ExpandTableColumn(JuntaMembros, "MembrosM2", {"QtdMembrosEficiencia"}, {"QtdMembrosEficiencia"}),
    FatorPessoas = Table.AddColumn(ExpandeMembros, "FatorPessoasEficiencia", each if [Setor] = "M2" then (if [QtdMembrosEficiencia] = null or [QtdMembrosEficiencia] < 1 then 1 else [QtdMembrosEficiencia]) else 1, type number),
    MetaEsperada = Table.AddColumn(FatorPessoas, "MetaEsperadaEficiencia", each if [MetaValidaEficiencia] = true then [HorasTrabalhadasLiquidas] * [MetaEficienciaHora] * [FatorPessoasEficiencia] else null, type nullable number),
    Eficiencia = Table.AddColumn(MetaEsperada, "EficienciaLancamento", each if [MetaEsperadaEficiencia] = null or [MetaEsperadaEficiencia] <= 0 or [QuantidadeEficiencia] = null then null else [QuantidadeEficiencia] / [MetaEsperadaEficiencia], type nullable number),
    SomaEficiencia = Table.AddColumn(Eficiencia, "SomaEficienciaLancamento", each if [EficienciaLancamento] = null then 0 else [EficienciaLancamento], type number),
    Resultado = Table.AddColumn(SomaEficiencia, "QtdLancamentosEficiencia", each if [EficienciaLancamento] = null then 0 else 1, Int64.Type)
in
    Resultado
```

> Paradas tambem sao rateadas entre os lancamentos do mesmo recurso/turno. Isso impede que uma unica parada seja descontada integralmente em mais de uma ordem.

## Alertas

### fato_alertas_cadastro

```powerquery
let
    Caminho = pPastaDashboard & "\CALENDARIO_FABRIL_OPERACIONAL.xlsm",
    Fonte = fxLerAba(Caminho, "ALERTAS_CADASTRO"),
    Cabecalhos = Table.PromoteHeaders(Fonte, [PromoteAllScalars=true]),
    RegistrosReais = Table.SelectRows(Cabecalhos, each fxTexto([TIPO_ALERTA]) <> null),
    Identificadores = Table.TransformColumns(RegistrosReais, {
        {"ORDEM", fxTexto, type text}, {"ITEM", fxTexto, type text},
        {"MAQUINA", fxTexto, type text}, {"MOLDE", fxTexto, type text}
    }),
    Renomeadas = Table.RenameColumns(Identificadores, {
        {"TIPO_ALERTA", "TipoAlerta"}, {"ORDEM", "Ordem"}, {"ITEM", "Item"},
        {"SETOR", "Setor"}, {"MAQUINA", "Maquina"}, {"DESCRICAO", "Descricao"},
        {"ACAO_RECOMENDADA", "AcaoRecomendada"}, {"ABA_CORRECAO", "BaseAfetada"}
    }),
    Severidade = Table.AddColumn(Renomeadas, "Severidade", each
        if Text.Contains(Text.Upper([TipoAlerta]), "SEM_") then "CRITICA" else "ATENCAO", type text)
in
    Severidade
```

Crie tambem consultas de alertas a partir de `fato_producao`:

```powerquery
// alertas_producao_sem_campos
let
    Fonte = fato_producao,
    Registros = Table.AddColumn(Fonte, "Alertas", each List.RemoveNulls({
        if [Ordem] = null then [TipoAlerta="PRODUCAO_SEM_ORDEM", Coluna="Ordem"] else null,
        if [Maquina] = null then [TipoAlerta="PRODUCAO_SEM_MAQUINA", Coluna="Maquina"] else null,
        if [Setor] <> "M1" and [DuracaoHoras] = null then [TipoAlerta="PRODUCAO_SEM_DURACAO", Coluna="DuracaoHoras"] else null,
        if [Quantidade] = null then [TipoAlerta="PRODUCAO_SEM_QUANTIDADE", Coluna="Quantidade"] else null,
        if [PossivelDuplicidade] then [TipoAlerta="POSSIVEL_DUPLICIDADE_PRODUCAO", Coluna="ChaveEvento"] else null
    }), type list),
    ExpandeLista = Table.ExpandListColumn(Registros, "Alertas"),
    SomenteAlertas = Table.SelectRows(ExpandeLista, each [Alertas] <> null),
    ExpandeRegistro = Table.ExpandRecordColumn(SomenteAlertas, "Alertas", {"TipoAlerta", "Coluna"}),
    Base = Table.AddColumn(ExpandeRegistro, "BaseAfetada", each "fato_producao", type text),
    Severidade = Table.AddColumn(Base, "Severidade", each "CRITICA", type text),
    Acao = Table.AddColumn(Severidade, "AcaoRecomendada", each "Corrigir o lancamento na fonte de producao", type text)
in
    Acao
```

Inclua tambem os lancamentos que nao podem entrar nos calculos de eficiencia/performance por falharem nas regras obrigatorias:

```powerquery
// alertas_producao_regras_eficiencia
let
    Fonte = fato_producao,
    Registros = Table.AddColumn(Fonte, "Alertas", each List.RemoveNulls({
        if [SetorCoerente] <> true then
            [TipoAlerta="EFICIENCIA_SETOR_LANCAMENTO_DIFERENTE_ORDEM", Coluna="Setor"]
        else null,
        if [HorasEficiencia] = null or [HorasEficiencia] <= 0 then
            [TipoAlerta="EFICIENCIA_DURACAO_INVALIDA", Coluna="DuracaoHoras"]
        else null,
        if [Quantidade] = null or [Quantidade] < 0 then
            [TipoAlerta="EFICIENCIA_QUANTIDADE_INVALIDA", Coluna="Quantidade"]
        else null,
        if [MetaEficienciaHora] = null or [MetaEficienciaHora] <= 0 or [FonteMetaEficiencia] = null or [FonteMetaEficiencia] = "SEM_META" then
            [TipoAlerta="EFICIENCIA_META_SEM_FONTE_VALIDA", Coluna="MetaEficienciaHora"]
        else null
    }), type list),
    ExpandeLista = Table.ExpandListColumn(Registros, "Alertas"),
    SomenteAlertas = Table.SelectRows(ExpandeLista, each [Alertas] <> null),
    ExpandeRegistro = Table.ExpandRecordColumn(SomenteAlertas, "Alertas", {"TipoAlerta", "Coluna"}),
    Base = Table.AddColumn(ExpandeRegistro, "BaseAfetada", each "fato_producao", type text),
    Severidade = Table.AddColumn(Base, "Severidade", each "CRITICA", type text),
    Acao = Table.AddColumn(Severidade, "AcaoRecomendada", each
        "Revisar ordem, setor, duracao, quantidade e fonte de meta antes de considerar este lancamento na eficiencia", type text)
in
    Acao
```

Para reconciliacao, agregue as duas fontes por ordem e use juncao completa:

```powerquery
// alertas_reconciliacao
let
    Oficial = Table.Group(Table.SelectRows(fato_producao, each [Ordem] <> null), {"Ordem"},
        {{"QtdOficial", each List.Sum(List.RemoveNulls([Quantidade])), type number}}),
    Sistema = Table.RenameColumns(
        Table.SelectColumns(fato_producao_sistema, {"Ordem", "QtdeProduzidaSistema"}),
        {{"QtdeProduzidaSistema", "QtdSistema"}}),
    Junta = Table.NestedJoin(Oficial, {"Ordem"}, Sistema, {"Ordem"}, "Sistema", JoinKind.FullOuter),
    Expande = Table.ExpandTableColumn(Junta, "Sistema", {"Ordem", "QtdSistema"}, {"OrdemSistema", "QtdSistema"}),
    OrdemFinal = Table.AddColumn(Expande, "OrdemFinal", each if [Ordem] <> null then [Ordem] else [OrdemSistema], type text),
    Tipo = Table.AddColumn(OrdemFinal, "TipoAlerta", each
        if [Ordem] = null then "LANCAMENTO_SEM_ORDEM_NO_CALENDARIO"
        else if [OrdemSistema] = null then "ORDEM_SEM_LANCAMENTO_PRODUCAO"
        else if Number.Abs(([QtdOficial] ?? 0) - ([QtdSistema] ?? 0)) > 0.000001 then "DIVERGENCIA_QTD_PRODUZIDA"
        else null, type text),
    SomenteAlertas = Table.SelectRows(Tipo, each [TipoAlerta] <> null),
    Divergencia = Table.AddColumn(SomenteAlertas, "Divergencia", each ([QtdOficial] ?? 0) - ([QtdSistema] ?? 0), type number),
    Selecionadas = Table.SelectColumns(Divergencia, {"OrdemFinal", "TipoAlerta", "QtdOficial", "QtdSistema", "Divergencia"}),
    Renomeadas = Table.RenameColumns(Selecionadas, {{"OrdemFinal", "Ordem"}})
in
    Renomeadas
```

`fato_alertas` deve ser `Table.Combine` das consultas, alinhando as colunas com `MissingField.UseNull`.

```powerquery
// fato_alertas
let
    Fontes = Table.Combine({
        fato_alertas_cadastro,
        alertas_producao_sem_campos,
        alertas_producao_regras_eficiencia,
        alertas_reconciliacao
    }),
    ColunasObrigatorias = {
        "Data", "TipoAlerta", "BaseAfetada", "Coluna", "Severidade",
        "Ordem", "Item", "Setor", "Maquina", "AcaoRecomendada"
    },
    CompletaColunas = List.Accumulate(
        ColunasObrigatorias,
        Fontes,
        (estado as table, coluna as text) =>
            if Table.HasColumns(estado, coluna) then estado
            else Table.AddColumn(estado, coluna, each null)
    ),
    Selecionadas = Table.SelectColumns(CompletaColunas, ColunasObrigatorias, MissingField.UseNull)
in
    Selecionadas
```

## Dimensoes

### dim_data

```powerquery
let
    Datas = List.RemoveNulls(List.Combine({
        fato_producao[Data], fato_disponibilidade[Data], fato_manutencao_ordem[Data],
        fato_grupos_vigencia[Data], fato_ausencias[Data], fato_dados_mensais[DataMes],
        fato_param_turnos[Data], fato_horas_prod[Data]
    })),
    DataMin = List.Min(Datas),
    DataMax = List.Max(Datas),
    Lista = List.Dates(DataMin, Duration.Days(DataMax - DataMin) + 1, #duration(1,0,0,0)),
    Tabela = Table.FromList(Lista, Splitter.SplitByNothing(), {"Data"}),
    TipoData = Table.TransformColumnTypes(Tabela, {{"Data", type date}}),
    Ano = Table.AddColumn(TipoData, "Ano", each Date.Year([Data]), Int64.Type),
    MesNumero = Table.AddColumn(Ano, "MesNumero", each Date.Month([Data]), Int64.Type),
    Mes = Table.AddColumn(MesNumero, "Mes", each Date.MonthName([Data], "pt-BR"), type text),
    MesAno = Table.AddColumn(Mes, "MesAno", each Date.ToText([Data], "yyyy-MM"), type text),
    SemanaAno = Table.AddColumn(MesAno, "SemanaAno", each Date.WeekOfYear([Data], Day.Monday), Int64.Type),
    SemanaMes = Table.AddColumn(SemanaAno, "SemanaMes", each
        let Dia = Date.Day([Data]) in
            if Dia <= 7 then "Semana 1"
            else if Dia <= 14 then "Semana 2"
            else if Dia <= 21 then "Semana 3"
            else if Dia <= 28 then "Semana 4"
            else "Semana 5", type text),
    OrdemSemanaMes = Table.AddColumn(SemanaMes, "OrdemSemanaMes", each Number.RoundUp(Date.Day([Data]) / 7), Int64.Type),
    DiaSemana = Table.AddColumn(OrdemSemanaMes, "DiaSemana", each Date.DayOfWeekName([Data], "pt-BR"), type text),
    FimSemana = Table.AddColumn(DiaSemana, "FimDeSemana", each Date.DayOfWeek([Data], Day.Monday) >= 5, type logical)
in
    FimSemana
```

### Outras dimensoes

```powerquery
// dim_ordem
Table.Distinct(Table.SelectColumns(fato_ordens, {"Ordem", "StatusOrdem", "Item", "Setor", "DescricaoItem"}))

// dim_item
let
    OrdensRecentes = Table.SelectRows(stg_ordens_aux, each [MAIS_RECENTE] = 1 and fxTexto([ITEM]) <> null),
    OrdensTratadas = Table.TransformColumns(OrdensRecentes, {
        {"ITEM", fxTexto, type text}, {"DESCRICAO", fxTexto, type text},
        {"SETOR_PADRAO", fxChaveTexto, type text}
    }),
    BaseOrdens = Table.Group(OrdensTratadas, {"ITEM"}, {
        {"DescricaoItem", each List.First(List.RemoveNulls([DESCRICAO]), null), type nullable text},
        {"SetorOrdem", each List.First(List.RemoveNulls([SETOR_PADRAO]), null), type nullable text}
    }),
    Renomeada = Table.RenameColumns(BaseOrdens, {{"ITEM", "Item"}}),
    JuntaCadastro = Table.NestedJoin(Renomeada, {"Item"}, stg_item_categoria, {"Item"}, "Cadastro", JoinKind.LeftOuter),
    ExpandeCadastro = Table.ExpandTableColumn(JuntaCadastro, "Cadastro",
        {"TipoItem", "LinhaCategoria"},
        {"TipoItem", "LinhaCategoria"}),
    JuntaDVCP09 = Table.NestedJoin(ExpandeCadastro, {"Item"}, stg_dvcp09_meta, {"Item"}, "DVCP09", JoinKind.LeftOuter),
    ExpandeDVCP09 = Table.ExpandTableColumn(JuntaDVCP09, "DVCP09", {
        "QtdOperacoesAtivas", "TempoHomemAtivo", "TempoMaquinaAtivo",
        "TempoPreparacaoAtivo", "NumHomemDVCP09"
    }),
    SetorFinal = Table.AddColumn(ExpandeDVCP09, "Setor", each [SetorOrdem], type nullable text),
    TempoPessoa = Table.AddColumn(SetorFinal, "TempoPessoa1000", each
        let
            TH = if [TempoHomemAtivo] = null then 0 else [TempoHomemAtivo],
            TM = if [TempoMaquinaAtivo] = null then 0 else [TempoMaquinaAtivo],
            TP = if [TempoPreparacaoAtivo] = null then 0 else [TempoPreparacaoAtivo]
        in
            if TM + TP > 0 then TM + TP
            else if TH + TP > 0 then TH + TP
            else null, type nullable number),
    MetaPessoa = Table.AddColumn(TempoPessoa, "MetaPessoaPecasHora", each
        if [TempoPessoa1000] <> null and [TempoPessoa1000] > 0 then 1000 / [TempoPessoa1000] else null,
        type nullable number),
    TipoFinal = Table.TransformColumns(MetaPessoa, {
        {"TipoItem", each if _ = null or _ = "" then "SEM CATEGORIA CADASTRADA" else _, type text}
    }),
    Selecionadas = Table.SelectColumns(TipoFinal, {
        "Item", "DescricaoItem", "TipoItem", "LinhaCategoria", "Setor", "QtdOperacoesAtivas",
        "TempoPessoa1000", "MetaPessoaPecasHora", "NumHomemDVCP09"
    })
in
    Selecionadas

// dim_turno
#table(type table [Turno=text, Ordem=Int64.Type], {{"1",1},{"2",2},{"3",3},{"HN",4},{"NORMAL",5}})
```

### stg_cad_maquinas

```powerquery
let
    Caminho = pPastaDashboard & "\CALENDARIO_FABRIL_OPERACIONAL.xlsm",
    Fonte = fxLerAba(Caminho, "CAD_MAQUINAS"),
    Cabecalhos = Table.PromoteHeaders(Fonte, [PromoteAllScalars=true]),
    RegistrosReais = Table.SelectRows(Cabecalhos, each fxTexto([MAQUINA]) <> null),
    Textos = Table.TransformColumns(RegistrosReais, {
        {"MAQUINA", fxTexto, type text}, {"SETOR", fxChaveTexto, type text},
        {"ATIVO", fxChaveTexto, type text}, {"TIPO_CAPACIDADE", fxChaveTexto, type text},
        {"EXIGE_MOLDE", fxChaveTexto, type text}, {"OBS", fxTexto, type text}
    }),
    Numeros = Table.TransformColumns(Textos, {
        {"META_PECAS_HORA", each try Number.From(_) otherwise null, type nullable number},
        {"PESSOAS_MINIMAS", each try Number.From(_) otherwise null, type nullable number}
    }),
    Chave = Table.AddColumn(Numeros, "MaquinaChave", each fxChaveTexto([MAQUINA]), type text)
in
    Chave
```

### dim_maquina

```powerquery
let
    Fonte = stg_cad_maquinas,
    JuntaAlias = Table.NestedJoin(Fonte, {"MaquinaChave"}, dim_maquina_alias, {"AliasChave"}, "Alias", JoinKind.LeftOuter),
    ExpandeAlias = Table.ExpandTableColumn(JuntaAlias, "Alias", {"MaquinaPadrao"}, {"MaquinaPadrao"}),
    MaquinaFinal = Table.AddColumn(ExpandeAlias, "MaquinaFinal", each
        if [MaquinaPadrao] <> null then [MaquinaPadrao] else fxChaveTexto([MAQUINA]), type text),
    Selecionadas = Table.SelectColumns(MaquinaFinal, {
        "MaquinaFinal", "SETOR", "ATIVO", "META_PECAS_HORA", "TIPO_CAPACIDADE",
        "EXIGE_MOLDE", "PESSOAS_MINIMAS", "OBS"
    }),
    Renomeadas = Table.RenameColumns(Selecionadas, {
        {"MaquinaFinal", "Maquina"}, {"SETOR", "Setor"}, {"ATIVO", "Ativo"},
        {"META_PECAS_HORA", "MetaPecasHora"}, {"TIPO_CAPACIDADE", "TipoCapacidade"},
        {"EXIGE_MOLDE", "ExigeMolde"}, {"PESSOAS_MINIMAS", "PessoasMinimas"},
        {"OBS", "Observacao"}
    }),
    SemDuplicidade = Table.Distinct(Renomeadas, {"Maquina"})
in
    SemDuplicidade
```

### dim_funcionario

```powerquery
let
    Caminho = pPastaDashboard & "\CALENDARIO_FABRIL_OPERACIONAL.xlsm",
    Fonte = fxLerAba(Caminho, "CAD_FUNCIONARIOS"),
    Cabecalhos = Table.PromoteHeaders(Fonte, [PromoteAllScalars=true]),
    RegistrosReais = Table.SelectRows(Cabecalhos, each fxTexto([MATRICULA]) <> null),
    Tratada = Table.TransformColumns(RegistrosReais, {
        {"MATRICULA", fxTexto, type text}, {"NOME", fxTexto, type text},
        {"SETOR", fxChaveTexto, type text}, {"ATIVO", fxChaveTexto, type text},
        {"OBS", fxTexto, type text}
    }),
    Renomeadas = Table.RenameColumns(Tratada, {
        {"MATRICULA", "Matricula"}, {"NOME", "Nome"}, {"SETOR", "Setor"},
        {"ATIVO", "Ativo"}, {"OBS", "Observacao"}
    }),
    SemDuplicidade = Table.Distinct(Renomeadas, {"Matricula"})
in
    SemDuplicidade
```

### dim_molde

```powerquery
let
    Caminho = pPastaDashboard & "\CALENDARIO_FABRIL_OPERACIONAL.xlsm",
    Fonte = fxLerAba(Caminho, "CAD_MOLDES"),
    Cabecalhos = Table.PromoteHeaders(Fonte, [PromoteAllScalars=true]),
    RegistrosReais = Table.SelectRows(Cabecalhos, each fxTexto([MOLDE]) <> null),
    Textos = Table.TransformColumns(RegistrosReais, {
        {"MOLDE", fxTexto, type text}, {"DESCRICAO", fxTexto, type text},
        {"OBS", fxTexto, type text}
    }),
    Numeros = Table.TransformColumns(Textos, {
        {"CICLO_SEGUNDOS", each try Number.From(_) otherwise null, type nullable number},
        {"CAVIDADES", each try Number.From(_) otherwise null, type nullable number},
        {"FATOR_EFICIENCIA", each try Number.From(_) otherwise null, type nullable number}
    }),
    Renomeadas = Table.RenameColumns(Numeros, {
        {"MOLDE", "Molde"}, {"DESCRICAO", "Descricao"},
        {"CICLO_SEGUNDOS", "CicloSegundos"}, {"CAVIDADES", "Cavidades"},
        {"FATOR_EFICIENCIA", "FatorEficiencia"}, {"OBS", "Observacao"}
    }),
    SemDuplicidade = Table.Distinct(Renomeadas, {"Molde"})
in
    SemDuplicidade
```

## Carga

Desabilite a carga de:

- `stg_ordens_aux`;
- `stg_producao`;
- `stg_item_categoria`;
- `stg_dvcp09_meta`;
- `stg_manutencao_detalhe`;
- `stg_cad_maquinas`;
- `stg_param_turnos`;
- `stg_horas_prod`;
- `dim_setor_alias`;
- `dim_maquina_alias`;
- funcoes `fx*`;
- `fato_alertas_cadastro`;
- `alertas_producao_sem_campos`;
- `alertas_producao_regras_eficiencia`;
- `alertas_reconciliacao`.

Para desabilitar a carga no Editor do Power Query:

1. No painel **Consultas**, clique com o botao direito na consulta.
2. Desmarque **Habilitar carga**.
3. Quando o Power BI solicitar confirmacao, confirme.

A consulta continua sendo executada quando outra consulta depende dela; ela apenas deixa de criar uma tabela visivel no modelo. Nao desabilite a carga das tabelas `fato_*` finais nem das dimensoes `dim_*` finais.

As funcoes `fx*` normalmente ja aparecem como funcoes e nao sao carregadas como tabelas.

Depois de atualizar `dim_item`, a antiga consulta `stg_maquina_item` nao possui mais dependencias e pode ser apagada. Nao apague `stg_dvcp09_meta` nem `stg_item_categoria`; ambas continuam sendo usadas por `dim_item`.

## Formula.Firewall e privacidade

Se o erro continuar depois de separar `stg_manutencao_detalhe`:

1. No Power BI Desktop, abra **Arquivo > Opcoes e configuracoes > Configuracoes da fonte de dados**.
2. Selecione cada arquivo da pasta do dashboard e clique em **Editar permissoes**.
3. Defina o mesmo nivel de privacidade para todos, normalmente **Organizacional**, conforme a politica da empresa.
4. Feche a janela e use **Atualizar visualizacao** no Power Query.

Evite marcar globalmente **Ignorar niveis de privacidade**. Essa opcao deve ser apenas um ultimo recurso para arquivos locais controlados, pois remove uma protecao contra transferencia indesejada de dados entre fontes.

Nao altere nem grave de volta os arquivos Excel. O Power Query deve apenas le-los.

## Adicoes obrigatorias - historico, resumo analise e semanas

As consultas abaixo incorporam as ultimas regras de negocio recebidas em 2026-07-09.

### stg_resumo_analise

Fonte principal para analise critica, disponibilidade planejada, ociosidade e planejamento mensal por recurso.

```powerquery
let
    Caminho = pPastaDashboard & "\CALENDARIO_FABRIL_OPERACIONAL.xlsm",
    Fonte = fxLerAba(Caminho, "RESUMO_ANALISE"),
    Cabecalhos = Table.PromoteHeaders(Fonte, [PromoteAllScalars=true]),
    RegistrosReais = Table.SelectRows(Cabecalhos, each fxTexto([SETOR]) <> null and fxTexto([MAQUINA]) <> null),
    Tipos = Table.TransformColumnTypes(RegistrosReais, {
        {"QTDE PESSOAS SETOR", type number},
        {"HORAS DISPONIVEIS", type number},
        {"HORAS NECESSARIAS", type number},
        {"CAPACIDADE", type number},
        {"QTDE PLANEJADA", type number},
        {"QTDE PRODUZIDA", type number},
        {"SALDO", type number},
        {"PRODUZIDO %", Percentage.Type},
        {"HORAS OCIOSAS", type number},
        {"OCIOSIDADE PECAS", type number},
        {"OCUPACAO %", Percentage.Type}
    }, "pt-BR"),
    Renomeadas = Table.RenameColumns(Tipos, {
        {"SETOR", "Setor"},
        {"MAQUINA", "Maquina"},
        {"QTDE PESSOAS SETOR", "QtdPessoasSetor"},
        {"HORAS DISPONIVEIS", "HorasDisponiveis"},
        {"HORAS NECESSARIAS", "HorasNecessarias"},
        {"CAPACIDADE", "Capacidade"},
        {"QTDE PLANEJADA", "QtdePlanejada"},
        {"QTDE PRODUZIDA", "QtdeProduzidaResumo"},
        {"SALDO", "Saldo"},
        {"PRODUZIDO %", "PercentualProduzido"},
        {"HORAS OCIOSAS", "HorasOciosas"},
        {"OCIOSIDADE PECAS", "OciosidadePecas"},
        {"OCUPACAO %", "OcupacaoPercentual"},
        {"STATUS_RECURSO", "StatusRecurso"},
        {"ALERTA_CRITICO", "AlertaCritico"},
        {"ACAO_RECOMENDADA", "AcaoRecomendada"}
    }, MissingField.Ignore),
    Chaves = Table.TransformColumns(Renomeadas, {
        {"Setor", fxChaveTexto, type text},
        {"Maquina", fxTexto, type text},
        {"StatusRecurso", fxTexto, type text},
        {"AlertaCritico", fxTexto, type text},
        {"AcaoRecomendada", fxTexto, type text}
    }, null, MissingField.Ignore)
in
    Chaves
```

### fato_resumo_analise

```powerquery
let
    Fonte = stg_resumo_analise
in
    Fonte
```

### stg_dados_mensais

Usar somente a aba `PRODUCAO_MESES` da planilha avulsa `DADOS MENSAIS.xlsm`. Nao usar por enquanto a pasta `ARQUIVOS QUE SERAO USADOS`.

```powerquery
let
    Caminho = pPastaDashboard & "\DADOS MENSAIS.xlsm",
    Fonte = fxLerAba(Caminho, "PRODUCAO_MESES"),
    Cabecalhos = Table.PromoteHeaders(Fonte, [PromoteAllScalars=true]),
    RegistrosReais = Table.SelectRows(Cabecalhos, each [DATA] <> null and fxTexto([SETOR]) <> null),
    Tipos = Table.TransformColumnTypes(RegistrosReais, {
        {"DATA", type date},
        {"DIAS PRODUTIVOS", type number},
        {"HORAS PRODUTIVAS", type number},
        {"HORAS EXTRAS", type number},
        {"HORAS TOTAIS", type number},
        {"Nº FUNCIONÁRIOS", type number},
        {"QTDE PLANEJADA", type number},
        {"QTDE PRODUZIDA", type number},
        {"QTDE NÃO PRODUZIDA", type number},
        {"% PRODUZIDO", Percentage.Type},
        {"Meta", Percentage.Type}
    }, "pt-BR"),
    Renomeadas = Table.RenameColumns(Tipos, {
        {"DATA", "DataMes"},
        {"SETOR", "Setor"},
        {"DIAS PRODUTIVOS", "DiasProdutivos"},
        {"HORAS PRODUTIVAS", "HorasProdutivas"},
        {"HORAS EXTRAS", "HorasExtras"},
        {"HORAS TOTAIS", "HorasTotais"},
        {"Nº FUNCIONÁRIOS", "QtdFuncionarios"},
        {"QTDE PLANEJADA", "QtdePlanejada"},
        {"QTDE PRODUZIDA", "QtdeProduzida"},
        {"QTDE NÃO PRODUZIDA", "QtdeNaoProduzida"},
        {"% PRODUZIDO", "PercentualProduzido"},
        {"Meta", "Meta"}
    }, MissingField.Ignore),
    SetorPadrao = Table.TransformColumns(Renomeadas, {{"Setor", fxChaveTexto, type text}}, null, MissingField.Ignore),
    Ano = Table.AddColumn(SetorPadrao, "Ano", each Date.Year([DataMes]), Int64.Type),
    MesNumero = Table.AddColumn(Ano, "MesNumero", each Date.Month([DataMes]), Int64.Type),
    MesAno = Table.AddColumn(MesNumero, "MesAno", each Date.ToText([DataMes], "yyyy-MM"), type text),
    MesNome = Table.AddColumn(MesAno, "MesNome", each Date.ToText([DataMes], "MMM/yy", "pt-BR"), type text)
in
    MesNome
```

### fato_dados_mensais

```powerquery
let
    Fonte = stg_dados_mensais
in
    Fonte
```

### Atualizacao obrigatoria em dim_data

A `dim_data` ja foi reescrita acima com `SemanaMes` e `OrdemSemanaMes` na sequencia correta. Nao cole as etapas isoladas no fim da consulta, porque elas precisam entrar antes de `DiaSemana` e `FimSemana`.

Ponto importante: a lista de datas agora tambem inclui `fato_dados_mensais[DataMes]`, para permitir relacionamento com a base historica mensal.

### Cargas que devem ficar habilitadas

- `fato_resumo_analise`
- `fato_dados_mensais`

### Cargas que podem ficar desabilitadas

- `stg_resumo_analise`
- `stg_dados_mensais`
- `stg_param_turnos`
- `stg_horas_prod`

### Observacao de historico

Apenas `fato_dados_mensais` e a futura carga historica consolidada de `RESUMO_ANALISE` devem ser usadas para comparativos mensais. As demais abas do `CALENDARIO_FABRIL_OPERACIONAL.xlsm` representam principalmente o mes vigente, salvo orientacao futura.

