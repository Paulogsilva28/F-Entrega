## Visão geral

O app vai virar um aplicativo Android/iOS instalável (Capacitor envelopa o React atual) e ganhar a infra necessária pra rodar com muitos usuários reais: cada um conecta o próprio Gmail, login com Google, página pública e cache de IA.

Vou entregar em **4 fases** pra não quebrar nada e você ir testando incrementalmente.

---

## Fase 1 — Escalabilidade multi-usuário (BLOQUEANTE)

Hoje **o Gmail é compartilhado** (conector Lovable lê só a SUA conta). Se outro usuário entrar, vai ver os SEUS dados de Gmail. Sem corrigir isso, o app não é escalável.

### 1.1 OAuth Gmail por usuário (você precisa configurar)

A integração Lovable de Gmail é única por workspace. Pra cada usuário conectar o próprio Gmail, **você precisa criar credenciais OAuth próprias no Google Cloud Console**:

1. Criar projeto no [Google Cloud Console](https://console.cloud.google.com/)
2. Ativar Gmail API
3. Configurar tela de consentimento OAuth (modo Externo)
4. Criar credencial **OAuth 2.0 Client ID** (tipo "Web Application")
5. Adicionar `https://SEU_DOMINIO/api/public/oauth/gmail/callback` como redirect URI
6. Me passar `GOOGLE_OAUTH_CLIENT_ID` e `GOOGLE_OAUTH_CLIENT_SECRET` via secret

Vou implementar:
- Tabela `gmail_connections` (user_id, refresh_token criptografado, email, scopes, created_at) com RLS.
- Rota `/api/public/oauth/gmail/callback` — recebe code, troca por tokens, salva refresh_token.
- Server fn `connectGmail` — gera URL de autorização OAuth.
- Server fn `disconnectGmail`.
- Refatorar `src/server/gmail-sync.server.ts` pra usar o refresh_token do usuário (em vez do connector). Renovação automática de access_token.
- Atualizar cron `/api/public/hooks/sync-gmail` pra iterar só usuários com `gmail_connections` ativa.
- Tela "Conectar Gmail" no dashboard com botão grande quando não conectado.

### 1.2 Login com Google

- Chamar `configure_social_auth(["google"])` (usa OAuth gerenciado da Lovable Cloud, não precisa de credencial extra).
- Botão "Entrar com Google" em `/auth` usando `lovable.auth.signInWithOAuth("google")`.

### 1.3 Reset de senha

- Botão "Esqueci minha senha" em `/auth`.
- Rota pública `/reset-password` com formulário pra nova senha.

---

## Fase 2 — Landing & Onboarding

### 2.1 Landing page pública (`/`)

Substituir o redirect atual por uma landing real:
- Hero: "Acompanhe seus ganhos 99Food e gastos da moto em um só lugar"
- Como funciona (3 passos: cadastra → conecta Gmail → vê insights)
- Print do dashboard
- CTAs "Começar grátis" e "Entrar"
- Footer com privacidade/termos

Usuário logado é redirecionado automaticamente pra `/dashboard`.

### 2.2 Onboarding no primeiro acesso

- Coluna `onboarding_completed` em uma tabela `user_profiles` (nova).
- Tela `/onboarding` com 3 steps: boas-vindas → conectar Gmail → tour rápido do dashboard.
- Loader do dashboard redireciona pra `/onboarding` se não completou.

---

## Fase 3 — App mobile nativo (Capacitor)

Capacitor empacota o app web atual como APK/IPA. **Importante:** o build do APK/IPA precisa ser feito localmente na sua máquina (Android Studio / Xcode) — Lovable não compila binário nativo. Vou deixar tudo configurado pra você só rodar os comandos.

### Setup
- `bun add @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios`
- `capacitor.config.ts` com appId `com.seuapp.painel99`, server apontando pro published URL (live reload) ou bundle estático
- Comandos no README: `bunx cap add android`, `bunx cap sync`, `bunx cap open android`

### Ajustes pra mobile
- Meta `apple-mobile-web-app-capable` + `theme-color` no `__root.tsx`
- Ícone do app (1024×1024) + splash screen — gero com imagegen
- Safe areas (notch) com CSS `env(safe-area-inset-*)`
- Garantir que OAuth funcione no in-app browser (Capacitor Browser plugin)
- Touch targets ≥44px revisados no dashboard

### Publicação
- Documentar passos pra Play Store (Internal Testing → Production)
- Documentar TestFlight pra iOS (precisa Apple Developer $99/ano)

---

## Fase 4 — Performance & custos

### 4.1 IA com rate limit
- Tabela `ai_usage` (user_id, month, calls_count) — limite de 30 regenerações/mês de insights por usuário no plano free.
- Cache de 24h já existe — adicionar feedback "próxima atualização disponível em X horas".

### 4.2 Queries
- Índices em `food_withdrawals(user_id, withdrawal_date desc)`, `uber_withdrawals(user_id, withdrawal_date desc)`, `moto_expenses(user_id, is_archived)`.
- Paginação na lista de saques (hoje carrega tudo).

### 4.3 Sync inteligente
- Cron atual sincroniza TODOS usuários — adicionar coluna `last_sync_at` em `gmail_connections` e pular quem sincronizou < 6h.

---

## Detalhes técnicos

**Stack mantida:** TanStack Start + Supabase + Lovable AI Gateway. Nada de framework novo.

**Segurança Gmail tokens:**
- Refresh tokens armazenados na tabela `gmail_connections` com RLS estrita (`auth.uid() = user_id`).
- Acesso via `supabaseAdmin` apenas dentro de server functions (nunca frontend).
- Não criptografar em coluna (RLS + service_role já protege; criptografia em repouso fica por conta do Postgres).

**Custo IA:** Lovable AI Gateway cobra por chamada. Cache 24h + limite 30/mês mantém custo previsível mesmo com muitos usuários.

**Capacitor + OAuth:** OAuth do Google funciona dentro do app via deep link `com.seuapp.painel99://oauth/callback` configurado no `AndroidManifest.xml`.

---

## Fora do escopo

- Notificações push (deixar pra depois — exige Firebase setup)
- Pagamento/assinatura premium
- App React Native (Capacitor é mais simples e reaproveita 100% do código)
- Suporte offline completo (PWA cache strategies)

---

## Ordem de execução sugerida

```text
1. Fase 1.2 Login Google           ← rápido, ganho imediato
2. Fase 1.3 Reset de senha          ← essencial pra usuários reais
3. Fase 2.1 Landing                 ← parar de redirecionar do "/"
4. Fase 1.1 Gmail OAuth por usuário ← maior trabalho, requer seus secrets do Google Cloud
5. Fase 2.2 Onboarding              ← depende do Gmail OAuth
6. Fase 4 Performance               ← otimizações antes de empacotar
7. Fase 3 Capacitor                 ← último, com tudo estável
```

**Quer que eu comece pela Fase 1.2 + 1.3 + 2.1?** São as menos arriscadas e te dão um app já pronto pra outros usuários web testarem. Depois partimos pro Gmail OAuth (que precisa você criar a credencial no Google Cloud antes).
