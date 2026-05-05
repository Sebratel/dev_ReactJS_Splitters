# Gestão de permissões de usuários — Splitters (guia para operação e TI)

Este documento descreve **como o controle de acesso funciona na prática** e **como administradores devem operar** perfis e solicitações. Serve como fonte única para treinar documentação interna (ex.: ingestão no NotebookLM).

---

## 1. Visão geral do modelo

- **Autenticação:** Firebase Authentication (Google). Não há senha guardada no Firestore do projeto Splitters.
- **Autorização (autorização de telas):** perfil por usuário no Firestore, coleção **`splitters_users`**, documento **`splitters_users/{uid}`** (mesmo `uid` do Firebase Auth).
- **Rotas protegidas:** algumas URLs só carregam se o campo correspondente em `permissions` for verdadeiro (ver secção 3).

Operações como chamadas ao **BFF / gateway** podem depender também do token OAuth/Google configurado na plataforma; este documento foca nas **permissões da app Splitters** gravadas no Firestore.

---

## 2. Estrutura de permissões no documento do usuário

No campo **`permissions`** (objeto) são guardados **cinco booleanos**:

| Campo | Significado na app |
|-------|---------------------|
| `canViewSplitters` | Acesso à navegação e fluxos principais de **Splitters** (lista e detalhes). |
| `canViewMassiva` | Acesso ao **módulo Massivas** (rota `/massiva`). |
| `canOpenMassiva` | Pode **abrir/registrar** ocorrências de massiva (além de apenas visualizar, quando aplicável). |
| `canViewIntelligence` | Acesso ao **Painel da rede / Inteligência** (rota `/intelligence`). |
| `isAdmin` | **Gestão de usuários** (`/usuarios`): lista usuários, altera presets ou permissões customizadas, aprova pedidos de acesso. |

Outros campos úteis no mesmo documento: **`email`**, **`displayName`**, **`isActive`** (conta desativada bloqueia uso mesmo com permissões), timestamps **`createdAt`**, **`updatedAt`**, **`lastLoginAt`**.

Referência técnica da forma do documento: `docs/firestore-access-control.md`.

---

## 3. O que cada tela exige (roteamento)

- **Dashboard** (`/`): acesso ao utilizador autenticado com conta ativa (sem permissão extra específica neste nível).
- **Splitters** (`/splitters`, `/splitters/:code`): assume-se **`canViewSplitters`** verdadeiro no preset padrão de novos utilizadores.
- **Massivas** (`/massiva`): exige **`canViewMassiva`**.
- **Inteligência** (`/intelligence`): exige **`canViewIntelligence`**.
- **Usuários** (`/usuarios`): exige **`isAdmin`**.

O menu lateral só lista Inteligência e Massivas quando o perfil tem a permissão correspondente.

---

## 4. Papéis pré-definidos (presets)

Administradores aplicam um **pacote** de permissões de uma vez. Os presets canônicos no código são:

| Nome exibido | Identificador interno | Splitters | Massivas (ver) | Massivas (abrir) | Inteligência | Admin sistema |
|--------------|------------------------|-----------|----------------|-----------------|---------------|----------------|
| **Administrador** | `admin` | Sim | Sim | Sim | Sim | Sim |
| **Analista de rede** | `operador` | Sim | Sim | Sim | Sim | Não |
| **Operador (massivas)** | `operador_massivas` | Sim | Sim | Sim | **Não** | Não |
| **Leitura** | `leitura` | Sim | Sim | **Não** | Sim | Não |

- **Analista de rede** (`operador`): perfil “amplo operacional” com painel da rede (inteligência), mas **sem** gestão de usuários.
- **Operador (massivas)** (`operador_massivas`): igual ao analista em Splitters + Massivas **com abertura**, mas **sem** rota de Inteligência — usa-se quando o colaborador **não** deve ver mapas/painéis da rede.

**Personalizado:** quando as permissões não coincidem com nenhum pacote acima (liga/desliga manual por campo). Na gestão de usuários aparece como “Personalizado”.

Implementação de presets: `src/features/access/lib/splittersUserRoles.ts`.

---

## 5. Novos utilizadores e primeiro administrador

- Ao fazer login pela primeira vez, o sistema cria (se não existir) o documento em **`splitters_users/{uid}`**.
- **Primeira conta no projeto:** se a coleção de usuários estiver **vazia**, esse primeiro utilizador recebe permissões de **administrador completas**.
- Contas seguintes recebem o preset **padrão restrito** (apenas o necessário para dashboard/Splitters, conforme `defaultSplittersPermissions` em código).

---

## 6. Solicitação de acesso pelo próprio utilizador

### Quem vê o FAB (“ISA”) / solicitar módulos

- Utilizadores **autenticados**, **não administradores**, com **`uid`** válido veem o botão flutuante para pedir acesso a módulos que lhes faltam.
- Administradores **não** usam esse fluxo para si próprios no mesmo critério (aprovações são tratadas na gestão de usuários).

### O que pode ser pedido (módulos na solicitação)

Os pedidos referem-se a telas, não ao nome interno do papel:

| Id interno | Significado |
|------------|-------------|
| `massiva_view` | Acesso à área de **Massivas** (visualização). |
| `massiva_open` | Permissão para **abrir/registrar** massivas. |
| `intelligence` | Acesso ao **Painel da rede / Inteligência**. |

*(Gestão de usuários como módulo pedível não é exposta desta forma ao utilizador final.)*

### Armazenamento das solicitações

- Coleção típica: **`splitters_access_requests`** (detalhes em código Firestore do projeto).
- Estado **`pending`**: aguardando decisão; **`approved`** / **`rejected`** após análise.

---

## 7. Como o administrador aprova um pedido

Na página **Gestão de usuários** (`/usuarios`), secção de **solicitações pendentes**:

1. O administrador escolhe o **papel ao aprovar** (preset).
2. Ao confirmar **Aprovar**, o sistema grava no utilizador o **`permissions`** correspondente ao preset escolhido (**substituição do objeto de permissões**, não merge campo a campo com o pedido).
3. Há **sugestão automática** do papel no formulário de aprovação:
   - Se o pedido incluir **`intelligence`** → sugere **Analista de rede** (`operador`).
   - Se incluir **`massiva_open`** mas **não** incluir **`intelligence`** → sugere **Operador (massivas)** (`operador_massivas`).
   - Caso contrário → sugere **Leitura**.
4. O administrador pode **alterar manualmente** o papel antes de aprovar (por exemplo, conceder Analista de rede mesmo quando o pedido só citava massivas).

### Mensagens ao utilizador

- Pedidos **recusados** podem levar **nota do administrador** visível ao solicitante.

---

## 8. Alteração direta de permissões (sem pedido)

Na **Gestão de usuários**:

- **Lista / cartões / tabela:** seleção rápida do **papel** (preset) ou abertura do painel **Editar usuário**.
- **Edição detalhada:** modo **Personalizado** permite ligar/desligar cada um dos cinco booleanos (`canViewSplitters`, `canViewMassiva`, `canOpenMassiva`, `canViewIntelligence`, `isAdmin`).
- **Ativar / Desativar conta:** `isActive` — utilizador inativo não deve conseguir usar a app normalmente após login (mensagem de conta inativa).
- **Regra comum:** não remover **`canViewMassiva`** e manter **`canOpenMassiva`** verdadeiro sem critério; na UI de edição o fluxo tende a desabilitar “abrir massiva” se não houver visualização de massivas.

Operações em **lote** (vários selecionados): ativar, desativar, aplicar preset **Leitura**, **Analista de rede**, **Operador (massivas)** ou **Administrador** (conforme botões disponíveis).

**Limitação:** um administrador não deve alterar o **próprio** papel por alguns atalhos de segurança; usar outra conta admin.

---

## 9. Boas práticas para TI

1. **Princípio do menor privilégio:** usar **Operador (massivas)** quando o trabalho for só massivas; reservar **Analista de rede** para quem precisa do painel de inteligência.
2. **Admin:** conceder só a quem precisa gerir usuários e políticas de acesso.
3. **Auditoria:** usar `updatedAt` / histórico Firestore (se configurado) para rastrear mudanças em documentos sensíveis.
4. **Consistência:** após mudar permissões, o utilizador pode precisar **atualizar perfil** ou **novo login** se houver cache de sessão — em caso de dúvida, pedir novo login.

---

## 10. Ficheiros de código úteis para manutenção

| Área | Caminho |
|------|---------|
| Presets e nomes exibidos | `src/features/access/lib/splittersUserRoles.ts` |
| Tipos de permissão | `src/features/access/model/access.types.ts` |
| Pedidos de módulos (labels e opções) | `src/features/access/model/accessRequestModules.ts` |
| Store / login / perfil | `src/features/access/store/accessAuthStore.ts` |
| API usuários Firestore | `src/features/access/api/firestoreUsers.ts` |
| API pedidos de acesso | `src/features/access/api/firestoreAccessRequests.ts` |
| UI gestão de usuários | `src/pages/UsersManagementPage.tsx`, `src/features/access/ui/UsersManagementWorkspace.tsx` |
| Aprovação de pedidos | `src/features/access/ui/AccessRequestsAdminPanel.tsx` |
| FAB solicitação (dashboard) | `src/features/access/ui/DashboardAccessRequestSection.tsx` |
| Rotas e guards | `src/app/router.tsx`, `src/app/auth/PermissionGuard.tsx` |

---

## 11. Resumo em uma frase

**Quem pode ver o quê** é decidido pelos **cinco booleanos** em `splitters_users.permissions`; **presets** aplicam pacotes prontos; **pedidos de acesso** são analisados em **`/usuarios`** e, ao aprovar, aplicam o preset escolhido pelo administrador (com sugestões automáticas baseadas nos módulos pedidos).
