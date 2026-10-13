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
