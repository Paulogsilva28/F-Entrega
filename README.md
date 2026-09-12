# ⚡ F-Entrega — Gestão Financeira para Entregadores

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/TanStack-Start-FF4154?logo=tanstack&logoColor=white" alt="TanStack Start" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/TailwindCSS-v4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare Workers" />
  <img src="https://img.shields.io/badge/Open_Finance-Pluggy-4F46E5" alt="Pluggy Open Finance" />
</p>

---

## 📌 Sobre o Projeto

O **F-Entrega** é uma plataforma web completa desenvolvida sob medida para motoboys e entregadores de aplicativo (como **99Food** e **Uber**). O sistema resolve um dos maiores desafios da categoria: **controlar com precisão os ganhos brutos e os custos reais da moto (combustível e manutenção) para saber o lucro líquido exato**.

Com conexão direta via **Open Finance (Pluggy API)** e integração por e-mail, o sistema elimina a necessidade de planilhas manuais ao ler e classificar automaticamente repasses bancários e comprovantes de saques.

---

## 🚀 Principais Funcionalidades

### 🏦 Sincronização Bancária Automática (Open Finance via Pluggy)
- Conexão segura com contas bancárias (ex: Nubank) através da API da **Pluggy**.
- Identificação e classificação automática de repasses:
  - **99Food / 99Pay**: Reconhecimento via razão social e códigos COMPE (`769`) e ISPB (`24313102`).
  - **Uber**: Reconhecimento via repasses do Banco Digio (`335`) e ISPB (`27098060`) ou descrição `PARTNERPAY`/`UBER`.
- Associação inteligente de despesas com postos e oficinas através de regras customizáveis cadastradas pelo usuário.
- Prevenção nativa de duplicidade através do identificador único `pluggy_transaction_id`.

### 🏍️ Gestão de Custos da Moto
- Registro categorizado de despesas de **combustível** e **manutenção**.
- Cadastro de regras automáticas para mapear nomes de postos/oficinas direto do extrato.
- **Fechamento de Mês**: Arquivamento dos gastos do ciclo para acompanhamento histórico.
- **Reversão de Fechamento**: Opção de reabrir um mês fechado com apenas um clique caso precise ajustar despesas passadas.

### 📊 Dashboard & Métricas em Tempo Real
- **Saldo Real do Mês**: Visão consolidada de Ganhos 99 + Ganhos Uber menos os Gastos da Moto.
- **Filtros de Data Dinâmicos**:
  - *Este Mês* (Padrão — do dia 1º até o dia atual).
  - *Mês Anterior* (Ciclo fechado anterior).
  - *Últimos 7 dias*, *30 dias*, *3 meses*, *6 meses*, *12 meses* e *Tudo*.
  - *Personalizado* (Seleção livre de data de início e término).

### 📱 Experiência Mobile-First & PWA
- Interface responsiva pensada para uso direto no suporte de celular da moto.
- Pode ser instalado na tela de início do Android ou iOS como um aplicativo nativo.
- Paleta visual moderna de alto contraste (**Amarelo e Azul**) com tema escuro nativo e favicon dinâmico em SVG.

### 🔒 Segurança & Privacidade
- Autenticação robusta via **Supabase Auth** (E-mail/Senha e Google OAuth).
- Isolamento total por **Row Level Security (RLS)** no PostgreSQL — cada usuário enxerga exclusivamente os seus próprios registros.

---

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologia |
| :--- | :--- |
| **Framework Fullstack** | [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router) |
| **Linguagem & Tipagem** | [TypeScript](https://www.typescriptlang.org/) |
| **Biblioteca de Interface** | [React 19](https://react.dev/) |
| **Build & Bundler** | [Vite](https://vitejs.dev/) |
| **Estilização** | [Tailwind CSS v4](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) |
| **Ícones & Notificações** | [Lucide React](https://lucide.dev/) + [Sonner](https://sonner.emilkowal.ski/) |
| **Banco de Dados & Auth** | [Supabase](https://supabase.com/) (PostgreSQL com RLS) |
| **Open Finance API** | [Pluggy.ai](https://pluggy.ai/) |
| **Hospedagem & Serverless** | [Cloudflare Workers / Pages](https://workers.cloudflare.com/) |

---

## 📂 Estrutura do Projeto

```text
├── src/
│   ├── components/ui/        # Componentes visuais reutilizáveis (botões, cards, tabelas, etc.)
│   ├── integrations/
│   │   └── supabase/         # Cliente do Supabase e middleware de autenticação
│   ├── lib/
│   │   ├── gmail-sync.functions.ts   # Server Functions para consulta de saques
│   │   ├── pluggy-sync.functions.ts  # Lógica de integração e matching do Open Finance
│   │   └── utils.ts                  # Funções utilitárias (formatação de moeda BRL, classes)
│   ├── routes/
│   │   ├── __root.tsx        # Shell raiz, cabeçalhos HTML e favicon SVG
│   │   ├── index.tsx         # Landing page institucional
│   │   ├── auth.tsx          # Tela de autenticação e recuperação de senha
│   │   └── dashboard.tsx     # Painel principal financeiro (99Food, Uber, Moto)
│   ├── server/               # Funções de sincronização do lado do servidor
│   └── styles.css            # Configuração de temas e variáveis de cores OKLCH
├── supabase/
│   └── migrations/           # Scripts SQL de schema, tabelas, índices e RLS
├── wrangler.jsonc            # Configuração de deploy da Cloudflare Workers
└── package.json              # Dependências e scripts do projeto
```

---

## 🚦 Como Executar o Projeto Localmente

### 1. Pré-requisitos
- [Node.js](https://nodejs.org/) versão 18 ou superior.
- [npm](https://www.npmjs.com/) ou [pnpm](https://pnpm.io/).
- Uma conta no [Supabase](https://supabase.com/) (gratuita).
- Credenciais da API da [Pluggy](https://pluggy.ai/) (opcional para simulação local).

### 2. Clonar o Repositório
```bash
git clone https://github.com/Paulogsilva28/F-Entrega.git
cd F-Entrega
```

### 3. Instalar Dependências
```bash
npm install
```

### 4. Configurar as Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# Configurações do Supabase
SUPABASE_URL="https://seu-projeto.supabase.co"
SUPABASE_PUBLISHABLE_KEY="sua-chave-anon"
VITE_SUPABASE_URL="https://seu-projeto.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sua-chave-anon"
VITE_SUPABASE_PROJECT_ID="id-do-seu-projeto"

# Configurações da Pluggy (Open Finance)
PLUGGY_CLIENT_ID="seu-client-id-pluggy"
PLUGGY_CLIENT_SECRET="seu-client-secret-pluggy"
PLUGGY_ITEM_ID="id-do-item-conectado"
```

### 5. Configurar o Banco de Dados
Execute os arquivos SQL contidos na pasta `supabase/migrations/` no SQL Editor do seu projeto Supabase para criar as tabelas `moto_expenses`, `food_withdrawals`, `uber_withdrawals`, `estabelecimentos_moto`, `pluggy_sync_logs` e suas respectivas políticas RLS.

### 6. Iniciar o Servidor de Desenvolvimento
```bash
npm run dev
```
O projeto estará acessível em `http://localhost:3000` (ou na porta informada pelo terminal).

---

## 📦 Scripts Disponíveis

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor local de desenvolvimento com Hot Reload |
| `npm run build` | Compila o projeto (cliente e SSR) para produção via Vite |
| `npm run preview` | Executa localmente o build gerado de produção |
| `npm run lint` | Executa a verificação estática de código com ESLint |
| `npm run format` | Formata todo o código-fonte utilizando o Prettier |

---

## ☁️ Deploy

O projeto é otimizado para deploy contínuo via **Cloudflare Workers / Pages**:
1. Conecte o repositório do GitHub ao painel da Cloudflare.
2. Defina as variáveis de ambiente e secrets (`PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, etc.) nas configurações de produção.
3. O comando de build utilizado é:
   ```bash
   npm run build
   ```
4. Diretório de saída estática: `dist/client`.

---

## 📄 Licença

Este projeto é de uso pessoal e educacional. Todos os direitos reservados.

---

<p align="center">
  Desenvolvido com ⚡ para facilitar a vida de quem está na pista todos os dias!
</p>