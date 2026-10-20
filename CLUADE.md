# CLAUDE.md

Personal portfolio of Romando Purba (Backend Developer). Astro static site, neo-brutalist design, scroll-driven Three.js scene.

## Working agreement
- We work step by step. Do ONLY the task requested. No extra features, refactors, or files.
- Ask before adding any dependency.
- Small diffs. Show what changed, not a recap.
- Never invent content: no fake metrics, testimonials, clients, or articles. Use only facts in "Owner facts" below. If content is missing, leave a `TODO:` placeholder.

## Commands
```sh
bun install
bun run dev       # localhost:4321
bun run build     # ./dist
bun run preview
bunx astro check
```

## Stack (decided — do not change without asking)
- Astro (static output), pnpm, strict TypeScript
- Tailwind v4 (`@tailwindcss/vite`), tokens in `@theme`
- React ONLY as an island for the 3D scene
- three + @react-three/fiber + @react-three/drei
- GSAP + ScrollTrigger for scroll-driven animation (no anime.js, no second animation lib)
- Lenis (optional, smooth scroll) synced via `lenis.on('scroll', ScrollTrigger.update)`
- MDX content collections for project case studies
- Medium articles via RSS at build time (`https://medium.com/feed/@<user>`), parsed with fast-xml-parser. Excerpt + link only, never full article HTML.
- Deploy: static host (Cloudflare Pages / Vercel) + daily rebuild cron for Medium

## Architecture rules
- Sections are `.astro` components → zero JS by default. Motion lives in one bundled script (`src/scripts/motion.ts`) driven by `data-*` hooks.
- Mascot (`src/components/mascot/`): the only `<Canvas>` on the site, on every page (desktop only, `client:media`, loaded when idle): a fixed, full-viewport, pointer-events-none overlay in CSS-pixel units (orthographic, zoom 1). It never covers content with interactive area except its own hit box; the cursor-grab game blocks clicks only until the user shakes the cursor or presses Escape (10 s timeout). Disabled under reduced motion. Behaviours: wanders anywhere at random, leaving paw prints that fade slowly; stroking → purr → nap; the cursor sometimes becomes a fish it chases and eats (clicks still work); light mode: scratches/doodles (scratch, meow, heart, scribble) on cards or on the page (marks are pointer-events-none and fade); dark mode: carries a flashlight it aims itself (ahead while walking, looks around while resting), the beam inverts the page back to a light look. The R3F wrapper must keep `style={{ pointerEvents: 'none' }}` or the full-screen canvas swallows every click.
- Each HTML section = one animation "chapter" (`data-chapter`).
- All meaningful text lives in HTML, never inside the canvas.

## Design system (neo-brutalism)

### Color tokens: rules
- All colors are CSS variables in OKLCH, shadcn-style semantic naming (`--x` + `--x-foreground`).
- Components use ONLY semantic tokens via Tailwind utilities (`bg-primary`, `text-foreground`, `border-border`).
- NEVER hardcode colors (no hex, no `oklch()`, no `bg-[#...]`, no `text-black`/`text-white`) outside `src/styles/global.css`.
- Rebranding/theming = edit variables only. No component changes.
- Every surface token has a matching `-foreground` with WCAG AA contrast.
- Dark mode = `.dark` class on `<html>` overriding the same variables. No `dark:` per-component overrides unless unavoidable.

## Analytics
- Google Analytics 4, measurement ID from env `PUBLIC_GA_ID`. Never hardcode.
- Load ONLY when `import.meta.env.PROD` and `PUBLIC_GA_ID` is set. Never in dev/preview.
- Load via Partytown (`@astrojs/partytown`, `type="text/partytown"`) → off main thread, must not affect LCP/INP.
- Consent Mode v2: default `denied` for analytics_storage/ad_storage; grant only after user accepts a minimal consent banner.
- Banner: static `.astro`, tiny vanilla script, neo-brutalist style, choice stored in localStorage (try/catch).
- No ads features, no ad_user_data/ad_personalization, `anonymize_ip` default.
- Custom events (later): CTA clicks, outbound links (GitHub/LinkedIn/Medium), project card opens.
- Analytics must never block rendering or break when blocked by ad blockers.

### Tokens (`src/styles/global.css`)
```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

:root {
  --background: oklch(0.982 0.022 89.8);        /* cream */
  --foreground: oklch(0 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0 0 0);
  --primary: oklch(0.917 0.192 101.4);          /* yellow */
  --primary-foreground: oklch(0 0 0);
  --secondary: oklch(0.495 0.285 269.1);        /* blue */
  --secondary-foreground: oklch(1 0 0);
  --accent: oklch(0.901 0.240 129.4);           /* green */
  --accent-foreground: oklch(0 0 0);
  --muted: oklch(0.912 0.026 92.4);
  --muted-foreground: oklch(0.36 0.02 90);
  --destructive: oklch(0.506 0.193 27.7);
  --destructive-foreground: oklch(1 0 0);
  --border: oklch(0 0 0);
  --input: oklch(0 0 0);
  --ring: oklch(0.495 0.285 269.1);

  /* Mascot (Three.js reads these at runtime) */
  --mascot-case: oklch(0.912 0.026 92.4);       /* box head, ears, paws, legs */
  --mascot-body: oklch(1 0 0);                  /* hoodie */
  --mascot-screen: oklch(0 0 0);                /* face screen */

  --radius: 0rem;
  --border-width: 4px;
  --border-width-sm: 2px;
  --shadow-offset: 6px;
  --shadow-offset-sm: 3px;
}

.dark {
  --background: oklch(0.17 0.008 90);
  --foreground: oklch(0.982 0.022 89.8);
  --card: oklch(0.22 0.01 90);
  --card-foreground: oklch(0.982 0.022 89.8);
  --popover: oklch(0.22 0.01 90);
  --popover-foreground: oklch(0.982 0.022 89.8);
  --muted: oklch(0.3 0.012 90);
  --muted-foreground: oklch(0.84 0.02 90);
  --border: oklch(0.982 0.022 89.8);
  --input: oklch(0.982 0.022 89.8);
  --ring: oklch(0.901 0.240 129.4);
  --mascot-case: oklch(0.86 0.02 90);
  --mascot-body: oklch(0.96 0.01 90);
  /* primary/secondary/accent unchanged: brand colors stay constant */
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --radius-lg: var(--radius);
  --radius-md: var(--radius);
  --radius-sm: var(--radius);

  --shadow-brutal: var(--shadow-offset) var(--shadow-offset) 0 0 var(--border);
  --shadow-brutal-sm: var(--shadow-offset-sm) var(--shadow-offset-sm) 0 0 var(--border);

  --font-display: "Space Grotesk Variable", system-ui, sans-serif;
  --font-sans: "Space Grotesk Variable", system-ui, sans-serif;
  --font-mono: "JetBrains Mono Variable", ui-monospace, monospace;
  --font-hand: "Caveat", cursive;
}
```

### Usage
- Card: `bg-card text-card-foreground border-(length:--border-width) border-border shadow-brutal`
- Button primary: `bg-primary text-primary-foreground shadow-brutal-sm active:translate-x-[3px] active:translate-y-[3px] active:shadow-none`
- Focus: `focus-visible:outline-(length:--border-width-sm) focus-visible:outline-ring`
- Shadows always derive from `--border` → flip automatically in dark mode.

### 3D colors
- Read colors from CSS variables at runtime, never hardcode in JS:
  `getComputedStyle(document.documentElement).getPropertyValue('--primary')`
- Convert with `new THREE.Color(value)` (supports `oklch()` via CSS parsing; otherwise resolve through a hidden element's computed `color`).
- Re-read on theme change (observe `class` on `<html>`).

### Other rules (unchanged)
- Radius 0, borders 2px/4px only, hard shadows no blur.
- Fonts: Space Grotesk + JetBrains Mono (variable), Caveat 700 for handwritten accents only; all self-hosted, `font-display: swap`.
- Motion 80–300ms, sharp easing. Fluid type with `clamp()`.
- Visible focus ring, WCAG AA contrast.

## 3D rules
- The only 3D on the site is the mascot: a cat with a box head whose front is a pixel screen face (`src/data/mascot.ts`).
- Look flat: `MeshBasicMaterial`, solid token colors (`--mascot-*`, `--primary`, `--border`), ink side faces, outlines as inverted hulls, a hard offset shadow copy.
- No bloom, blur, gradients, PBR, or organic models. Geometric primitives (boxes) only.
- Orthographic front camera in CSS-pixel units (zoom 1).
- Perf: `dpr={[1, 1.5]}`, desktop only, loaded when the browser is idle; never the LCP element.
- `prefers-reduced-motion`: no idle motion, wandering, fish, scratching, flashlight or grab game.
- No WebGL or mobile: no mascot (it's decorative; nothing to fall back to).

## SEO & GEO
- Per page: title, description, canonical, Open Graph + Twitter card (OG image 1200×630).
- `@astrojs/sitemap`, `robots.txt` (allow GPTBot, ClaudeBot, PerplexityBot).
- JSON-LD `Person` with `sameAs` (GitHub, LinkedIn, Medium).
- `/public/llms.txt` with short factual bio + key links.
- Semantic HTML: one `<h1>`, ordered headings, `<main>`, `<article>`, `<nav>`.
- Write factual, quotable sentences. Avoid vague marketing copy.
- Targets: LCP < 2.5s, CLS ≈ 0.

## Approved site copy (from the final design, Oct 2026)
First-person copy in `src/data/*` and project `teaser` frontmatter was approved by the owner with the final design. It adds these claims on top of the facts below — keep them consistent:
- Open to backend roles.
- Principles: Postgres is usually enough; fewer moving parts; structured logs with request IDs; idempotent jobs and endpoints.
- Exam seat booking: owner designed and built the concurrency-safe seat claiming (NestJS + PostgreSQL).
- Graduation screening: owner wrote the Go worker.
- Maintains backend services for MyUT. First backend job.
- Side projects: Rust + PostgreSQL LISTEN/NOTIFY sync experiment; REST API in Actix Web (both written up on Medium).
- Now (Oct 2026): learning CS degree, distributed systems, Rust; building small Rust + PostgreSQL experiments; reading the PostgreSQL docs.
- Toolbox also includes SQL, PHP, Laravel, Actix Web, CI/CD.

## Owner facts (single source of truth for content)
- Name: Romando Purba
- Role: Backend Developer (Go, NestJS/TypeScript, PostgreSQL)
- Location: Pamulang, South Tangerang, Indonesia
- Email: prb.romando@gmail.com
- Current: Backend Developer, Directorate of Digital Technology (DTD), Universitas Terbuka — Nov 2022–present
- Scale: national university platform serving 800K+ students

### Key work (use for case studies)
1. **Course registration & exam seat booking** — 857K+ registrations. Self-service seat booking by location/date/session. Double-booking prevented via atomic seat claiming (`FOR UPDATE SKIP LOCKED`), 2-hour holds, expired-seat reclaim based on billing status.
2. **Graduation screening service** — evaluates thousands of students per study program each period. Cron workers on a DB job queue to avoid API timeouts. Being redesigned as a Go worker on a Postgres-backed queue: atomic batch claiming, per-student fan-out, lease-based recovery, retries with backoff; interrupted batches resume without reprocessing. Per-host concurrency limits + timeouts for legacy PHP grading servers; decision-critical reads routed to primary to avoid replica lag.
3. **MyUT** — student portal for 800K+ students (academic records, GPA, courses).
4. **Legacy migration** — Laravel → NestJS and Go services within the first year.
5. **Student Record System (SRS)** — staff modules: registration, tutorials (TTM), graduation, certification.
6. **BIMON** — online academic supervision platform for Master's students.
7. **Auth** — Microsoft 365 SSO + RBAC. Integration tests for job claiming/lease behavior; GitLab CI.

### Skills
- Languages: Go, TypeScript, JavaScript, Python, Rust (personal projects)
- Backend: NestJS, Node.js, REST, GraphQL, microservices
- Async: job queues, background workers, cron, retry & backoff
- Databases: PostgreSQL (query optimization, row-level locking, primary/replica), Redis
- DevOps: Git, GitLab CI, Docker, Linux
- Certification: Microsoft Certified: Azure AI Fundamentals

### Education
- B.Sc. Computer Science, Universitas Cakrawala — Mar 2026–2030 (expected)
- Multimedia, SMK Negeri 1 Raya — 2020