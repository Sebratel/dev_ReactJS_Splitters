# Gestão de usuários e permissões — Splitters (Guia TI / Operação)

Este documento explica **como administrar usuários** na plataforma Splitters: **o que cada permissão significa**, **como aplicar perfis (presets)**, **como aprovar solicitações** e **como resolver problemas comuns**.  
Formato pensado para ser enviado ao **NotebookLM** como referência operacional.

---

## 1) Visão geral (o que é auth e o que é permissão)

- **Autenticação (login):** via **Google / Firebase Authentication**.
- **Autorização (o que o usuário pode ver/fazer):** definida por um documento no **Firestore** na coleção:
  - `splitters_users/{uid}` (onde `uid` é o mesmo do Firebase Auth).
- **Conta inativa:** mesmo com permissões, se `isActive=false` o usuário não deve acessar a área logada.

Na prática:
- O usuário faz login (Google).
- O sistema lê o perfil no Firestore (`splitters_users/{uid}`).
- As telas/rotas são liberadas ou bloqueadas conforme os booleanos em `permissions`.

---

## 2) Estrutura do documento de usuário (Firestore)

Coleção: `splitters_users`  
Documento: `splitters_users/{uid}`

Campos relevantes:
- `uid`: id do Firebase Auth.
- `email`: e-mail do usuário (normalizado).
- `displayName`: nome.
- `photoURL`: foto (opcional).
- `isActive`: **habilitado/desabilitado**.
- `permissions`: **objeto com permissões** (ver seção 3).
- `createdAt`, `updatedAt`, `lastLoginAt`: timestamps.

---

## 3) O que significa cada permissão (permissions)

O objeto `permissions` tem **5 flags booleanas**:

| Campo | O que libera na prática |
|------|--------------------------|
| `canViewSplitters` | Acesso ao módulo principal de **Splitters** (lista e detalhes). |
| `canViewMassiva` | Acesso ao módulo **Massivas** (`/massiva`). |
| `canOpenMassiva` | Permite **abrir/registrar** massivas (capacidade operacional dentro do módulo). |
| `canViewIntelligence` | Acesso ao painel **Inteligência** (`/intelligence`). |
| `isAdmin` | Acesso à **Gestão de usuários** (`/usuarios`) e ações administrativas. |

Regras importantes:
- **`canOpenMassiva` não faz sentido sem `canViewMassiva`**. Quando necessário, ajuste ambos.
- O usuário só deve receber o mínimo necessário (princípio do menor privilégio).

---

## 4) Perfis (presets) — papéis prontos para TI aplicar

Ao administrar usuários, a TI escolhe um **papel** (preset) que aplica um “pacote” de permissões.

Presets canônicos (estado atual):

| Nome exibido | Id interno | Splitters | Massivas (ver) | Massivas (abrir) | Inteligência | Admin |
|--------------|-----------|-----------|----------------|------------------|--------------|-------|
| Administrador | `admin` | Sim | Sim | Sim | Sim | Sim |
| Analista de rede | `operador` | Sim | Sim | Sim | Sim | Não |
| Operador (massivas) | `operador_massivas` | Sim | Sim | Sim | Não | Não |
| Leitura | `leitura` | Sim | **Não** | Não | **Não** | Não |

Notas:
- **Leitura** é o perfil mais restrito: **somente Splitters**, sem Massivas e sem Inteligência.
- **Operador (massivas)** é para quem opera ocorrências mas **não** deve ver o painel de Inteligência.
- **Analista de rede** tem acesso ao painel de Inteligência, mas não é admin do sistema.
- **Administrador** é para quem precisa gerir usuários e políticas.

Existe também o estado **Personalizado** quando o conjunto de flags não bate com nenhum preset.

---

## 5) Criação de usuários e “primeiro admin”

- No **primeiro login** do usuário, se não existir `splitters_users/{uid}`, o sistema cria o documento.
- **Primeira conta do projeto:** se a coleção estiver vazia, o primeiro usuário pode receber permissões completas de admin (bootstrap inicial).
- Usuários seguintes entram com permissões restritas (mínimas) e a TI expande conforme necessidade.

---

## 6) Como a TI faz a gestão no dia a dia (UI)

A gestão acontece na página:
- **Gestão de usuários**: `/usuarios` (exige `isAdmin=true`).

Principais operações:

### 6.1) Aplicar papel (preset) para um usuário
- Localize o usuário na lista.
- Troque o campo **Papel** (dropdown) para `Leitura`, `Operador (massivas)`, `Analista de rede` ou `Administrador`.
- O sistema substitui o objeto `permissions` conforme o preset escolhido.

### 6.2) Editar permissões (modo Personalizado)
Use quando precisar ligar/desligar flags individualmente (ex.: exceções).

Boas práticas:
- Evite “misturas” incoerentes (ex.: `canOpenMassiva=true` e `canViewMassiva=false`).
- Documente exceções (internamente) para auditoria.

### 6.3) Ativar/desativar usuário
- Se `isActive=false`: usuário deve ser bloqueado na entrada (mesmo que tenha permissões).
- Use para desligamento, troca de função, etc.

### 6.4) Operações em lote
Quando disponível na UI (seleção múltipla), aplique:
- ativar/desativar
- aplicar papel em lote

Observação de segurança:
- Algumas ações podem impedir alterar o próprio usuário em lote (evita auto-lockout).

---

## 7) Solicitações de acesso (quando um usuário “pede” módulos)

O usuário pode solicitar acesso a módulos. A TI/Admin decide na área `/usuarios`.

Fluxo resumido:
- Usuário pede acesso (ex.: Inteligência, Massivas).
- O pedido entra como **pendente**.
- Admin avalia e aprova/rejeita.

Ao **aprovar**, a TI escolhe um **papel (preset)** e esse preset é gravado no usuário (substituição do objeto `permissions`).

Sugestão prática de decisão:
- Se precisa de Inteligência → `operador` (Analista de rede)
- Se precisa operar massivas sem Inteligência → `operador_massivas`
- Se é apenas Splitters → `leitura`

---

## 8) Glossário rápido para TI

- **Splitters:** módulo principal (lista/detalhes, criticidade, ocupação, clientes ligados, etc.).
- **Massivas:** módulo de ocorrências/abertura/consulta de massivas.
- **Inteligência:** painel analítico (tendências, mapas, saturação, etc.).
- **Admin:** gestão de usuários e políticas internas do app.
- **Ativo/Inativo (`isActive`)**: habilitado ou bloqueado.

---

## 9) Troubleshooting (problemas comuns)

### “Usuário não consegue acessar mesmo com permissões”
Checklist:
- `isActive=true`?
- O usuário fez **logout/login** após mudança? (às vezes precisa revalidar perfil)
- O documento no Firestore realmente tem `permissions` com as flags corretas?

### “Usuário não aparece na lista”
Possíveis causas:
- Nunca logou (documento `splitters_users/{uid}` ainda não foi criado).
- O app está em ambiente diferente (outro projeto Firebase).

### “Liberar acesso para e-mails”
Existe controle de e-mails/domínios permitidos via configuração de ambiente (whitelist). Se o e-mail não estiver permitido, o login pode ser negado mesmo antes de permissões.

---

## 10) Arquivos úteis (referência técnica)

- Presets/roles: `src/features/access/lib/splittersUserRoles.ts`
- Tipos de permissão: `src/features/access/model/access.types.ts`
- Store de auth/perfil: `src/features/access/store/accessAuthStore.ts`
- Rotas e guards: `src/app/router.tsx`, `src/app/auth/PermissionGuard.tsx`
- Referência Firestore: `docs/firestore-access-control.md`

---

## 11) Resumo em uma frase

**O acesso às telas do Splitters é definido por 5 booleans em `splitters_users.permissions`; a TI aplica “papéis” (presets) para conceder/retirar acesso; e `isActive` bloqueia o usuário mesmo que ele tenha permissões.**

