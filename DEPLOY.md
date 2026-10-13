# 🚀 Publicar o OpenBeats

São **três passos**: subir o código para o GitHub → publicar a API no Render → publicar o site no
Expo. No fim ficas com um link para partilhar.

---

## Passo 0 — Confirmar o estado local

Nesta pasta (`musicapp/`) já existe um repositório git com tudo preparado:

```powershell
git log --oneline
```

---

## Passo 1 — Subir o código para o GitHub

O Render precisa de um repositório no GitHub para construir a API.

1. Cria um repositório novo (privado ou público) em <https://github.com/new>.
   - **Não** marques "Add a README" (já temos um).
   - Sugestão de nome: `openbeats`

2. Liga o repositório local e envia o código:

```powershell
cd C:\Users\Diddy\musicapp
git remote add origin https://github.com/O-TEU-UTILIZADOR/openbeats.git
git branch -M main
git push -u origin main
```

Se pedir credenciais, usa um **Personal Access Token** como palavra-passe
(<https://github.com/settings/tokens> → *Generate new token (classic)* → marca `repo`).

---

## Passo 2 — Publicar a API no Render

O ficheiro `render.yaml` já descreve tudo; o Render lê-o automaticamente.

1. Cria conta em <https://render.com> (podes entrar com o GitHub).
2. No painel: **New +** → **Blueprint**.
3. Escolhe o repositório `openbeats` → **Connect**.
4. O Render mostra o serviço `openbeats-api`. Confirma com **Apply** / **Create**.
5. Espera pelo primeiro deploy (~2–4 minutos, tem de instalar as dependências Python).
6. Copia o URL do serviço, algo como:

   ```
   https://openbeats-api.onrender.com
   ```

7. Confirma que está tudo bem:

   ```
   https://openbeats-api.onrender.com/api/health
   ```

   Deves ver `{"status":"ok","app":"OpenBeats API",...}`.

   E a biblioteca:

   ```
   https://openbeats-api.onrender.com/api/tracks/stats
   ```

   Deves ver `"tracks":129`.

> 💡 O primeiro pedido a uma instância gratuita pode demorar ~30 s (ela "acorda").

---

## Passo 3 — Publicar o site no Expo (EAS Hosting)

Substitui o URL pelo teu:

```powershell
cd C:\Users\Diddy\musicapp\app

# 1. Liga o projeto ao EAS (só é preciso uma vez)
npx eas-cli@latest init

# 2. Constrói o site já com o endereço da API "cozido" dentro
$env:EXPO_PUBLIC_API_URL="https://openbeats-api.onrender.com"
npx expo export --platform web

# 3. Publica
npx eas-cli@latest deploy
```

No fim o EAS imprime um URL do tipo:

```
https://openbeats.expo.app
```

Para o tornar o endereço definitivo (alias de produção):

```powershell
npx eas-cli@latest deploy --prod
```

**Esse é o link que partilhas.** Quem o abrir no browser vê a biblioteca completa e pode ouvir,
criar playlists e enviar músicas.

---

## Passo 4 — (Opcional) App instalável para Android / iOS

```powershell
cd C:\Users\Diddy\musicapp\app
npx eas-cli@latest build --platform android --profile preview   # gera um .apk
npx eas-cli@latest build --platform ios --profile production    # requer conta Apple
```

---

## Alterar a API mais tarde (sem recompilar)

Se o URL da API mudar, abre o site → **⚙️ (canto superior direito do ecrã inicial)** → cola o novo
endereço → **Test** → **Save**. Fica guardado no dispositivo e a biblioteca recarrega.

Isto é útil para testes, mas atenções: a alteração é **por dispositivo**. Para todos os visitantes
novos, reconstrói com o `EXPO_PUBLIC_API_URL` correto (Passo 3).

---

## Passo 5 — (Recomendado) Armazenamento permanente

No plano gratuito do Render o disco é **efémero**: cada deploy apagaria os uploads. A solução
gratuita e permanente é guardar tudo numa **base de dados Postgres do Supabase** — com **uma só
credencial**, porque o áudio e as capas ficam dentro da própria base de dados.

### 5.1 Criar o projeto no Supabase

1. Cria conta em <https://supabase.com> (grátis, sem cartão) → **New project**
2. Escolhe um nome e uma **password de base de dados** → **guarda-a**
3. Espera ~2 minutos

### 5.2 Obter a linha de ligação

1. No projeto, clica no botão verde **`Connect`** (topo da página)
2. Escolhe **`Session pooler`** e o formato **`URI`**
3. Copia a linha e **substitui `[YOUR-PASSWORD]`** pela password do passo 1

Fica com este aspecto (porta **5432** = session pooler, que funciona a partir do Render):

```
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

> ⚠️ Usa a **Session pooler**, não a "Direct connection": a ligação direta só tem IPv6 e o Render
> não consegue alcançá-la. O código também já deteta e corrige a *transaction pooler* (porta 6543).

### 5.3 Aplicar no Render

O `DATABASE_URL` **não** está declarado no `render.yaml` de propósito: uma chave listada nesse ficheiro
é *gerida pelo Blueprint*, e o Render descarta os valores escritos à mão para chaves geridas. Por isso
ela define-se no painel:

1. Dashboard do Render → o serviço **`openbeats-api`** → **`Environment`**
2. Clica em **`Edit`** (topo direito da secção *Environment Variables*)
3. **`+ Add Environment Variable`**
4. **KEY:** `DATABASE_URL` · **VALUE:** a linha do passo 5.2
5. **`Save Changes`** → o Render faz o deploy

Confirma no log de arranque:

```
Database : postgresql+psycopg://postgres...
Files    : database
```

A partir daí **os uploads sobrevivem a todos os deploys**.

### 5.4 Confirmar

```
https://openbeats-api.onrender.com/api/health
→ {"status":"ok","storage":"postgres","files":"database"}
```

Ou, dentro do app, em **⚙️ Definições → STORAGE**: deve aparecer a verde
*"Uploads are stored permanently"*.

### 5.5 Espaço

O plano gratuito do Supabase dá **500 MB** — cerca de **50 músicas** de 10 MB. Se precisares de mais,
há duas saídas:

- **Supabase Storage** (1 GB, servido por CDN): descomenta as variáveis `SUPABASE_*` no `render.yaml`
  e define-as no Render. O código passa a usá-lo automaticamente.
- Plano pago do Supabase.

### 5.6 Apagar o catálogo de demonstração

O `SEED_DEMO` já vem a `false`, por isso os deploys novos arrancam vazios. Para limpar uma base de
dados que já tenha as 129 faixas (sem tocar nos teus uploads):

```powershell
curl -X POST https://openbeats-api.onrender.com/api/tracks/purge-demo
```

---

## Resolução de problemas

**"Can't reach the library" no site**
- Abre `https://a-tua-api.onrender.com/api/health` no browser. Se não responder, o serviço está a
  arrancar (Render free adormece) ou o deploy falhou (vê os *Logs* no painel do Render).
- Confirma que `EXPO_PUBLIC_API_URL` foi definido **antes** de `npx expo export`.

**A biblioteca aparece vazia no Render**
- Abre o URL `/api/tracks/stats`. Se der `0`, o *seed* falhou: vê os logs do Render — deves
  encontrar `Seeded 129 tracks…`. Se viste `Demo catalogue not found`, o ficheiro
  `api/app/demo_catalog.json` não foi enviado para o GitHub (confirma com `git ls-files api/app`).

**Uma música não toca, mas as outras sim**
- O áudio de demonstração é servido a partir do Internet Archive. Um ficheiro pode falhar
  temporariamente; a API tenta 3 vezes antes de desistir. Recarrega a página.

**Os uploads desaparecem depois de um deploy**
- Esperado no plano gratuito (disco efémero). Descomenta o bloco `disk:` no `render.yaml` depois de
  passar para um plano pago.

**O `eas deploy` reclama de projeto não ligado**
- Corre `npx eas-cli@latest init` dentro de `app/` e volta a tentar.

---

## Verificar os limites antes de aceitar um deploy no Render

| Variável | Valor por omissão | Para que serve |
| --- | --- | --- |
| `DATA_DIR` | `/data` | Onde ficam o SQLite e os MP3 enviados |
| `SEED_DEMO` | `true` | Inserir o catálogo de demonstração no primeiro arranque |
| `MAX_UPLOAD_MB` | `200` | Tamanho máximo de um upload |
| `CORS_ORIGINS` | `*` | Origens permitidas (o app é público, por isso `*`) |
| `DATABASE_URL` | *(vazio)* | Se definido, usa Postgres em vez de SQLite |
