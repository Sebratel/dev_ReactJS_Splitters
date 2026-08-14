# Padrão Visual — NexaView / Operação Sebratel (dev_ReactJS_Splitters)

Guia portátil do sistema de design para **replicar a identidade visual deste projeto em outros**.
Stack visual: **React 19 + Tailwind CSS v4** (config-no-CSS via `@theme`), `framer-motion`, `lucide-react`, `clsx` + `tailwind-merge` (helper `cn`), Lottie para estados.

> Princípios: estética executiva/premium, fundo creme quente, **âmbar/dourado como cor de marca**, cantos generosos (`2xl`→`4xl`), vidro/sombras suaves, tipografia Inter com labels em maiúsculas espaçadas, movimento discreto com curva única, e acessibilidade (focus rings + `aria-hidden` + `prefers-reduced-motion`).

---

## 1. Setup base (copiar primeiro)

### Dependências
```bash
npm i tailwindcss @tailwindcss/vite clsx tailwind-merge framer-motion lucide-react lottie-react
```

### Helper `cn` — obrigatório (`src/shared/lib/utils.ts`)
```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```
Todo componente combina classes com `cn(...)` para permitir override via prop `className`.

### Tokens de tema — `src/index.css`
Tailwind v4 não usa `tailwind.config`. O tema vive no CSS via `@theme`:

```css
@import "tailwindcss";

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;

  /* Marca */
  --color-primary: #ffb000;            /* âmbar/dourado — cor principal */
  --color-primary-container: #ffc107;
  --color-secondary: #ff8f00;          /* laranja */
  --color-tertiary: #b44a32;           /* terracota/ferrugem */

  /* Superfícies (creme quente, não branco puro) */
  --color-surface: #f4f1e8;                  /* fundo da app */
  --color-surface-container-low: #ebe7db;    /* blocos/empties */
  --color-surface-container-lowest: #ffffff; /* cards */

  /* Texto */
  --color-on-surface: #1a1a1a;
  --color-on-surface-variant: #5d5d5d;
  --color-outline-variant: rgba(0, 0, 0, 0.05);
  --color-inverse-surface: #262626;

  /* Raios extra (além dos default do Tailwind) */
  --radius-3xl: 24px;
  --radius-4xl: 32px;
}

@layer base {
  body { @apply bg-surface text-on-surface font-sans; }
}
```

Os tokens viram utilitários automaticamente: `bg-primary`, `text-on-surface`, `bg-surface-container-low`, `rounded-4xl`, etc. Use **sempre os tokens** (`bg-primary`, `text-on-surface-variant`) em vez de `bg-amber-500` literal — exceto nos estados de status (ver §7), que usam paleta padrão do Tailwind.

---

## 2. Paleta & uso de cor

| Token | Hex | Uso |
|---|---|---|
| `primary` | `#ffb000` | Marca, botões primários, item de menu ativo, ícones de destaque, pills de info |
| `secondary` | `#ff8f00` | Hover de primário, acentos |
| `tertiary` | `#b44a32` | Destaques quentes pontuais |
| `surface` | `#f4f1e8` | Fundo geral da aplicação |
| `surface-container-low` | `#ebe7db` | Empty/loading containers, hover de itens |
| `surface-container-lowest` | `#ffffff` | Cards, painéis |
| `on-surface` | `#1a1a1a` | Texto principal |
| `on-surface-variant` | `#5d5d5d` | Texto secundário (use `/70`, `/50` para hierarquia) |

**Cores de status** (paleta Tailwind, não tokens):
- Sucesso → `emerald` (`border-emerald-200 bg-emerald-50 text-emerald-900`)
- Atenção → `amber` (`border-amber-200 bg-amber-50 text-amber-950`)
- Erro/perigo → `rose`/`red` (`border-rose-200/90 bg-rose-50/95 text-rose-900`)
- Informação → `sky` (`border-sky-300 bg-sky-50 text-sky-950`)

**Aplicação com opacidade** (assinatura do projeto): `bg-primary/10`, `bg-primary/[0.08]`, `border-primary/25`, `text-on-surface-variant/70`.

**Decorações** (heros, headers premium): halos com gradiente + blur enorme, sem capturar clique:
```html
<div class="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-amber-400/15 blur-3xl" aria-hidden></div>
```

---

## 3. Tipografia

- Fonte: **Inter** (`font-sans`). Importar a fonte no `index.html` ou via `@fontsource`.
- **Títulos de página (h1):** `text-2xl font-bold tracking-tight text-on-surface sm:text-[1.65rem]` — marca/logo usa `font-black tracking-tighter`.
- **Seção (h2):** `text-lg font-bold tracking-tight sm:text-xl`.
- **Subtítulo (h3):** `text-sm font-semibold tracking-tight`.
- **Labels/eyebrows (assinatura do projeto):** maiúsculas espaçadas →
  `text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/50`
  (variações de tracking: `tracking-[0.2em]`, `tracking-[0.18em]`, `tracking-wider`).
- **Números/dados:** sempre `tabular-nums` (alinha dígitos). Ex.: valores de KPI, percentuais, protocolos com `font-mono`.
- **Truncamento:** `truncate` (1 linha) e `line-clamp-2` (multi-linha).
- **Pesos:** `font-black` (marca/títulos fortes) › `font-bold` (headings/labels) › `font-semibold` (valores/subhead) › `font-medium` (corpo enfatizado).

---

## 4. Raios, sombras e superfícies

**Escala de raio (consistência é o que dá a "cara"):**
| Raio | Uso |
|---|---|
| `rounded-full` | pills, badges, botões-ação redondos, avatares |
| `rounded-xl` | botões densos, containers de ícone, inputs densos |
| `rounded-2xl` | **cards padrão**, modais, inputs |
| `rounded-3xl` | filtros grandes, empty states, blocos largos |
| `rounded-4xl` | sidebar desktop |

**Sombras (suaves, coloridas, nunca duras):**
- Leve: `shadow-sm` ou `shadow-[0_1px_2px_rgba(15,23,42,0.04)]`
- Hover de card: `shadow-[0_8px_24px_-4px_rgba(15,23,42,0.08)]`
- Elevado/vidro: `shadow-[0_4px_24px_-6px_rgba(15,23,42,0.08)]` → hover `shadow-[0_12px_40px_-12px_rgba(15,23,42,0.15)]`
- Sombra colorida no item ativo: `shadow-lg shadow-primary/20`

**Superfície "vidro/premium"** (home, painéis nobres):
```
border-white/50 bg-white/75 ring-1 ring-stone-200/30 backdrop-blur-md
hover:-translate-y-0.5 hover:border-amber-200/40
```
Use `ring-1 ring-...` para contornos sutis em vez de borda dura.

---

## 5. Componentes-chave (receitas)

### Card de indicador (StatCard)
```
group flex h-full flex-col justify-between rounded-2xl border border-neutral-200/90 bg-white p-4 sm:p-5
shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[box-shadow,transform,border-color] duration-300
hover:shadow-[0_8px_24px_-4px_rgba(15,23,42,0.08)]
```
- Ícone no topo num quadrado `h-11 w-11 rounded-xl bg-neutral-100 ring-1 ring-inset ring-neutral-200/80`, `strokeWidth={1.75}`.
- Variante `elevated` aplica a superfície vidro (§4) e gradiente âmbar no quadrado do ícone.
- Valor: `text-2xl font-semibold tabular-nums tracking-tight text-stone-900`.
- Label abaixo: `text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-600`.
- Trend chip: `rounded-md border border-neutral-200/80 bg-neutral-50 px-2 py-0.5 font-mono text-[11px] tabular-nums` com `↑`/`↓`.

### Cabeçalho de página (AppPageHeader)
Bloco âmbar com selo + título + descrição à esquerda, ação à direita:
```
relative overflow-hidden rounded-2xl border border-amber-200/70
bg-gradient-to-br from-amber-50 via-white to-amber-50/30
shadow-[0_4px_24px_-8px_rgba(180,83,9,0.18)] ring-1 ring-amber-100/80
animate-in fade-in slide-in-from-top-2 duration-300
```
- **Selo (badge):** `inline-flex rounded-full border border-amber-200/80 bg-white/70 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-900/90 backdrop-blur-sm`.
- Halos blur decorativos posicionados em absoluto (§2).

### Sidebar (navegação)
- Desktop: flutuante `xl:left-6 xl:top-6 xl:bottom-6 xl:rounded-4xl xl:w-80 xl:p-8 xl:shadow-xl`, colapsável para `xl:w-24`.
- Mobile (`max-xl:`): drawer `inset-y-0 left-0 w-[min(20rem,90vw)] shadow-2xl` + transform `translate-x-0`/`-translate-x-full`.
- Transição assinatura: `transition-[width,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]`.
- **Item de menu:** `flex min-h-[44px] items-center gap-4 rounded-2xl px-4 py-4 text-sm font-bold transition-all duration-300`.
  - Ativo: `bg-primary text-white shadow-lg shadow-primary/20` (variante perigo: `bg-red-600 ... shadow-red-600/20`).
  - Inativo: `text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface`; ícone fica `text-primary`.
- Logo num quadrado `rounded-2xl bg-primary text-white shadow-lg shadow-primary/30`.

---

## 6. Botões

| Variante | Classe |
|---|---|
| **Primário (ação)** | `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-amber-400 px-4 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm transition hover:bg-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2` |
| **Primário (token)** | `rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-secondary` |
| **Secundário/ghost** | `rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2` |
| **Perigo (sutil)** | `... border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100` |
| **Desabilitado** | `disabled:opacity-50 disabled:cursor-not-allowed` (ou `opacity-60`) |

Regras: **alvo tátil mínimo `min-h-[44px]`**, sempre `transition`, sempre `focus-visible:ring-2 ... ring-offset-2`. Ações principais tendem a `rounded-full`; botões de formulário a `rounded-xl`.

---

## 7. Formulários, inputs & estados de validação

**Input/Select:**
```
rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-sm
placeholder:text-neutral-400
focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20
```
Variante "macia": `rounded-2xl bg-surface px-4 py-3`.

**Label de campo:** `text-xs font-bold uppercase tracking-wider text-on-surface-variant` (ou `text-[10px] ... tracking-widest`).

**Alerta de erro (form):**
```
flex items-start gap-2 rounded-xl border border-rose-200/90 bg-rose-50/95 px-3 py-2.5 text-sm text-rose-900 shadow-sm
```
com ícone `<AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />`.

Stack de formulário: **react-hook-form + zod** (`@hookform/resolvers`).

---

## 8. Badges / chips / status pills

**Base:** `inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider`.

- **Info/marca:** `border-primary/25 bg-primary/10 text-primary` (versão `font-mono` para códigos/IDs).
- **Ativo:** `border-primary/25 bg-primary/[0.09] text-primary`.
- **Inativo:** `border-on-surface-variant/15 bg-on-surface-variant/[0.06] text-on-surface-variant`.
- **Status** (ver §2): emerald / amber / rose / sky.
- Com ícone inline: `lucide` em `size={12} strokeWidth={2}` + `gap-1`.

---

## 9. Overlays — modais, dialogs, drawers

**Backdrop:**
```
fixed inset-0 z-40 bg-neutral-950/25 backdrop-blur-[1px]   /* leve */
fixed inset-0 z-50 bg-neutral-950/40 backdrop-blur-[2px]   /* forte */
```
**Drawer lateral (painel):**
```
relative flex h-full w-full max-w-md flex-col border-l border-neutral-200 bg-white shadow-2xl
animate-in slide-in-from-right duration-300
```
- **Header:** `flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4`; botão fechar `rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900`.
- **Footer (ações):** `flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 px-5 py-4`; quando sticky: `sticky bottom-0 bg-white/95 backdrop-blur shadow-[0_-10px_30px_-20px_rgba(15,23,42,0.2)]`.
- **Overlay global de loading:** `fixed inset-0 z-50 flex items-center justify-center bg-surface/40 backdrop-blur-sm`.

---

## 10. Listas, tabelas e grids

- **Grid responsivo de cards:** `grid gap-4 lg:grid-cols-2 lg:gap-5`.
- **Card de linha (lista):** `rounded-3xl bg-surface-container-lowest p-6 transition hover:scale-[1.01] hover:shadow-2xl hover:shadow-primary/5`.
- **Tabela:** header `bg-neutral-50 uppercase tracking-wide text-neutral-500`; corpo `divide-y divide-neutral-200/70 bg-white`; célula `px-2.5 py-2` (`font-mono` para IDs/protocolos).

---

## 11. Estados (vazio / erro / carregando)

Container comum: `rounded-3xl bg-surface-container-low px-8 py-12 text-center`.

- **EmptyState:** título `text-lg font-bold tracking-tight text-on-surface` + descrição `mt-2 text-sm text-on-surface-variant/80`.
- **LoadingState:** animação **Lottie** num `h-16 w-16` + label `text-sm font-medium text-on-surface-variant tracking-wide`; wrapper com `role="status" aria-live="polite"`.
- JSONs de animação em `src/shared/assets/animations/` (loading, notFound, notClients, warning…) renderizados por um wrapper `LottieAnimation`.
- Skeleton de lista: `animate-in fade-in duration-300`.

---

## 12. Movimento (motion)

**Curva de easing assinatura — use em quase tudo:** `ease-[cubic-bezier(0.22,1,0.36,1)]` (CSS) / `ease: [0.22, 1, 0.36, 1]` (framer-motion).

- **Durações:** micro `200–300ms`; transições de layout `500–700ms`; loops decorativos `10–22s`.
- **Entrada (Tailwind `animate-in`):** `animate-in fade-in slide-in-from-top-2 duration-300` (e `slide-in-from-right` em drawers).
- **framer-motion típico:**
  - fade/slide: `initial={{ opacity: 0, y: 36, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5, ease: [0.22,1,0.36,1] }}`
  - spring (cards interativos): `{ type: 'spring', stiffness: 380, damping: 26, mass: 0.65 }`
  - stagger de lista: `transition={{ staggerChildren: 0.055, delayChildren: 0.08 }}`
- **Keyframes CSS custom** registrados no `@theme` como `--animate-*` (pulse de logo, shake de login, auroras do hero, dots "digitando" da ISA).
- **Acessibilidade:** sempre respeitar `useReducedMotion()` (framer) e `motion-reduce:animate-none` (Tailwind). Padrão: `initial={reduceMotion ? false : {...}}`.

---

## 13. Ícones (lucide-react)

- Tamanhos: `size={20}`/`size={24}` (geral/headers), `size={16}`/`size={12}` (inline/badges).
- `strokeWidth`: `2` padrão; `1.75` para visual mais leve (cards); `2.25` para ênfase.
- Ícone decorativo → `aria-hidden`.
- Container de ícone: `flex h-11 w-11 items-center justify-center rounded-xl border ring-1 ring-inset` com fundo `bg-neutral-100` ou gradiente âmbar.

---

## 14. Responsividade

- **Breakpoint mestre `xl`** separa mobile/desktop: `max-xl:` = drawer mobile; `xl:` = sidebar fixa + layout desktop. Conteúdo desloca `xl:ml-80` (ou `xl:ml-28` colapsado).
- Hook centralizado: `useMediaQuery('(min-width: ${BREAKPOINT_PX.xl}px)')` com constante única `BREAKPOINT_PX` (evita strings mágicas).
- Progressões de espaçamento mobile-first: `px-4 sm:px-6 xl:px-10`, `gap-2 sm:gap-3 lg:gap-5`.
- Safe-area iOS: `pt-[max(0.5rem,env(safe-area-inset-top))]` no header mobile.
- Header mobile fixo com `backdrop-blur-md bg-white/95`.

---

## 15. Checklist para replicar em um projeto novo

1. Instalar deps (§1) e configurar Vite com `@tailwindcss/vite`.
2. Copiar `cn()` para `shared/lib/utils.ts`.
3. Copiar o bloco `@theme` + `@layer base` para `index.css` e importar a fonte Inter.
4. Reusar os componentes: `StatCard`, `AppPageHeader`, `Sidebar`/`RootLayout`, `EmptyState`/`LoadingState`/`ErrorState`, `LottieAnimation`.
5. Seguir as escalas: raios (§4), botões (§6), inputs (§7), badges (§8), overlays (§9).
6. Aplicar a curva de motion única e respeitar `prefers-reduced-motion` (§12).
7. Manter a regra de ouro: **tokens de marca/superfície** + **paleta Tailwind só para status** + **`min-h-[44px]` e focus rings** em tudo clicável.

---

_Referência viva — extraído de `dev_ReactJS_Splitters` (nexaview-web). Ao divergir, o código-fonte (`src/index.css`, `src/shared/ui/`, `src/app/layouts/`) é a verdade._
