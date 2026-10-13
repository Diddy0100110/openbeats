# 🎧 OpenBeats

Um leitor de música completo: app em **React Native (Expo)**, API em **Python (FastAPI)** e base de
dados **SQLite**. O site fica hospedado no **Expo (EAS Hosting)** e há uma **API pública** à parte —
basta partilhar o link e qualquer pessoa consegue ouvir, criar playlists e enviar as suas músicas.

```
                                    ┌──────────────────────────────┐
   link partilhado                  │  Expo (EAS Hosting)          │
   https://openbeats.expo.app  ───► │  app React Native → web      │
                                    └───────────────┬──────────────┘
                                                    │  fetch / <audio>
                                                    ▼
                                    ┌──────────────────────────────┐
                                    │  API Python (FastAPI)        │
                                    │  render.com                  │
                                    │  ┌────────┐  ┌────────────┐  │
                                    │  │ SQLite │  │ MP3 files  │  │
                                    │  └────────┘  └────────────┘  │
                                    └───────────────┬──────────────┘
                                                    │  proxy com HTTP Range
                                                    ▼
                                          Internet Archive (domínio público)
```

## Funcionalidades

**Reprodução**
- Fila de reprodução nativa (`expo-audio`), próximo/anterior, gapless
- Shuffle, repetir (desligado / tudo / uma faixa)
- Barra de progresso com *seek* por toque e arrasto
- Velocidade de reprodução (0,75× a 2×), volume, silenciar
- Mini-player flutuante sempre visível
- Stream com **HTTP Range**, por isso o *seek* funciona mesmo em faixas remotas

**Biblioteca**
- 129 faixas de demonstração (domínio público / Creative Commons)
- Pesquisa por título, artista, álbum ou género
- Filtro por género e vistas de **Songs / Artists / Albums**
- **Upload de MP3** (com leitura de tags ID3 e capa embutida)
- Estatísticas da biblioteca

**Playlists e pessoal**
- Playlists partilhadas (criar, renomear, apagar, adicionar/remover, reordenar)
- Favoritos e "tocadas recentemente" guardados **no teu dispositivo**
- Capas geradas automaticamente a partir do nome do álbum
- Tema claro/escuro seguindo o sistema
- Ecrã de **Definições** para apontar o app a outro servidor sem recompilar

## Estrutura

```
musicapp/
├── api/                        # API Python
│   ├── app/
│   │   ├── main.py             # aplicação FastAPI
│   │   ├── models.py           # tabelas SQLAlchemy
│   │   ├── schemas.py          # modelos Pydantic
│   │   ├── routers/            # tracks, playlists, stream
│   │   ├── streaming.py        # entrega de áudio com Range + proxy
│   │   ├── seed.py             # biblioteca de demonstração
│   │   └── demo_catalog.json   # catálogo gerado (129 faixas)
│   ├── tools/build_demo_catalog.py
│   ├── requirements.txt
│   └── Dockerfile
├── app/                        # App Expo (React Native + web)
│   └── src/
│       ├── app/                # rotas (expo-router)
│       ├── components/         # UI reutilizável
│       ├── state/              # player, biblioteca, favoritos, sheets
│       ├── api/                # cliente HTTP tipado
│       ├── hooks/  lib/        # utilitários
│       └── constants/theme.ts  # design tokens
├── render.yaml                 # blueprint do Render (API)
└── DEPLOY.md                   # como publicar
```

## Correr localmente

Precisas de **Node.js 20+** e **Python 3.12+**.

### 1. API

```powershell
cd api
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Na primeira arranque a base de dados é criada e as 129 faixas de demonstração são inseridas
(a barra `SEED_DEMO=false` desliga isto).

- Documentação interativa: <http://127.0.0.1:8000/docs>
- Saúde: <http://127.0.0.1:8000/api/health>

### 2. App

```powershell
cd app
npm install
npx expo start
```

`w` abre no browser. O app descobre o endereço da API automaticamente em desenvolvimento; para
apontar para outro servidor cria `app/.env`:

```env
EXPO_PUBLIC_API_URL=https://a-tua-api.onrender.com
```

> É também possível mudar o servidor dentro do próprio app, em **Definições** (ícone ⚙️ no ecrã
> inicial). Isto fica guardado no dispositivo e não exige recompilar.

## Publicar

Vê **[DEPLOY.md](./DEPLOY.md)**. Em resumo:

1. **API** → Render (a partir de um repositório GitHub), fica com um URL tipo
   `https://openbeats-api.onrender.com`
2. **App web** → `npx expo export --platform web` + `eas deploy`, fica com um URL tipo
   `https://openbeats.expo.app`
3. Partilha o link do Expo 🎉

## API — principais endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/api/health` | Estado do serviço |
| `GET` | `/api/tracks` | Listar/pesquisar (`q`, `artist`, `album`, `genre`, `sort`, `limit`, `offset`) |
| `GET` | `/api/tracks/{id}` | Detalhe de uma faixa |
| `GET` | `/api/tracks/facets` | Artistas / álbuns / géneros com contagens |
| `GET` | `/api/tracks/stats` | Totais da biblioteca |
| `POST` | `/api/tracks/upload` | Upload de áudio (multipart) |
| `PATCH` | `/api/tracks/{id}` | Editar metadados |
| `DELETE` | `/api/tracks/{id}` | Apagar faixa (e ficheiro) |
| `GET` | `/api/stream/{id}` | Áudio com suporte a `Range` (o app usa sempre este endereço) |
| `GET` | `/api/playlists` | Playlists |
| `POST` | `/api/playlists/{id}/tracks` | Adicionar faixa |
| `PUT` | `/api/playlists/{id}/order` | Reordenar |

## Regenerar o catálogo de demonstração

O catálogo vive em `api/app/demo_catalog.json` e é gerado por um script:

```powershell
cd api
.\.venv\Scripts\python.exe tools\build_demo_catalog.py            # com validação dos URLs
.\.venv\Scripts\python.exe tools\build_demo_catalog.py --skip-validate
```

O script retira metadados do Internet Archive, corrige erros de codificação presentes na fonte,
estima/associa durações e verifica que todos os ficheiros de áudio respondem.

## Créditos e licenças

As faixas de demonstração são de **domínio público** ou **Creative Commons**:

- **Kevin MacLeod** (incompetech.com) — CC BY 3.0 — a atribuição aparece no ecrã "A tocar"
- **Musopen Kickstarter Project** — domínio público

Se enviares as tuas próprias músicas, és responsável por teres os direitos para o fazer.

## Notas / limitações conhecidas

- No plano **gratuito** do Render o sistema de ficheiros é efémero: uploads e a base SQLite são
  reiniciados a cada deploy. Para os preservar, adiciona um *disk* (ver `render.yaml`).
- O Render free "adormece" após ~15 min de inatividade; o primeiro pedido demora alguns segundos.
- O Expo Hosting corre em Cloudflare Workers (só JavaScript), por isso a API Python tem de viver
  noutro sítio — é a única razão para os dois serviços separados.
- Reprodução em segundo plano em **Android** precisa de controlos de ecrã de bloqueio
  (`setActiveForLockScreen`), que ainda não existem na API de playlists do `expo-audio` no SDK 57;
  o áudio continua, mas o sistema pode pará-lo após ~3 minutos em segundo plano. Na web e no iOS
  não há limitação.
