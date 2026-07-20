# Automação do Calendário Fabril

O módulo VBA real não faz parte desta publicação porque contém identificadores
operacionais incorporados em regras legadas. Esta documentação apresenta as
responsabilidades técnicas sem expor esses valores.

## Responsabilidades

- importar relatórios mensais para abas de staging;
- preservar cadastros manuais e relações já existentes;
- normalizar códigos de item, máquina, molde e setor;
- atualizar o planejamento mensal e os resumos de capacidade;
- registrar divergências para revisão humana;
- aplicar formatação, validações e proteção das abas;
- manter rotinas de carga idempotentes.

## Princípio de preservação

As rotinas que atualizam cadastros semiautomáticos seguem uma estratégia
incremental:

```text
1. Ler as relações existentes.
2. Construir uma chave de negócio estável.
3. Identificar apenas relações novas ou divergentes.
4. Acrescentar novos registros ao final da tabela.
5. Não apagar registros manuais já cadastrados.
6. Em uma segunda execução, não incluir duplicidades.
```

## Organização recomendada

```text
modConfiguracao
modImportacao
modNormalizacao
modPlanejamento
modCadastros
modValidacao
modFormatacao
```

## Validação

Antes de instalar uma nova versão no arquivo operacional:

1. executar em uma cópia temporária;
2. confirmar preservação das linhas existentes;
3. executar novamente e validar idempotência;
4. comparar totais e chaves de negócio;
5. importar o módulo validado no arquivo principal sem executar cargas de risco.
