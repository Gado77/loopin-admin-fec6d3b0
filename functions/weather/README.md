# Weather API - Loopin TV

## Configuração

### 1. Variável de Ambiente (.dev.vars)

Crie um arquivo `.dev.vars` na raiz do projeto:

```
OPENWEATHER_API_KEY=sua_chave_aqui
```

### 2. Obter chave da OpenWeather

1. Acesse https://openweathermap.org/api
2. Crie uma conta (gratuito)
3. Copie sua API Key

### 3. Deploy da Edge Function

```bash
# Instale as dependências
npm install

# Deploy da function de clima
npx wrangler deploy functions/weather/index.ts --name loopin-weather
```

### 4. Testar

Acesse:
```
https://loopin-admin.seusubdomain.workers.dev/weather?city=São+José+dos+Pinhais,BR
```

## Cidades Disponíveis

As cidades estão definidas em `src/routes/_app.dynamic-content.tsx`:

- São José dos Pinhais, BR (padrão)
- São Paulo, SP
- Rio de Janeiro, RJ
- Belo Horizonte, MG
- Brasília, DF
- Salvador, BA
- Fortaleza, CE
- Recife, PE
- Porto Alegre, RS
- Curitiba, PR
- Manaus, AM
- Natal, RN
- João Pessoa, PB
- Florianópolis, SC
- Cuiabá, MT
- Goiânia, GO

## Adicionar mais cidades

Edite o array `BRAZILIAN_CITIES` em `src/routes/_app.dynamic-content.tsx`:

```tsx
const BRAZILIAN_CITIES = [
  { value: "Sua Cidade, BR", label: "Sua Cidade - UF" },
  // ...
];
```