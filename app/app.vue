<script setup lang="ts">
const route = useRoute()
const nav = [
  { to: '/', label: 'Hoy' },
  { to: '/archivo', label: 'Archivo' },
  { to: '/api', label: 'API' },
]
const isActive = (to: string) => (route.path.replace(/\/+$/, '') || '/') === to
</script>

<template>
  <div class="site">
    <a class="skip" href="#contenido">Saltar al contenido</a>
    <header class="top">
      <div class="wrap top__inner">
        <NuxtLink to="/" class="brand" aria-label="barato.si, portada">
          <span class="brand__name">barato<span class="brand__dot">.</span>si</span>
          <span class="brand__tag">índice diario de rebajas</span>
        </NuxtLink>
        <nav aria-label="Secciones">
          <NuxtLink
            v-for="n in nav" :key="n.to" :to="n.to" class="top__link"
            :aria-current="isActive(n.to) ? 'page' : undefined"
          >{{ n.label }}</NuxtLink>
          <a href="/feed.xml" class="top__link">RSS</a>
        </nav>
      </div>
    </header>

    <main id="contenido">
      <NuxtPage />
    </main>

    <footer class="foot">
      <div class="wrap foot__inner">
        <p class="foot__sign">barato, sí<span class="foot__dot" aria-hidden="true">.</span></p>
        <p class="foot__legal">
          Los precios y la disponibilidad vienen de terceros y pueden cambiar o estar mal. barato.si no vende nada:
          solo ordena lo que otros publican y enlaza a la oferta original.
          «Posible error de precio» es una suposición automática, no una confirmación.
        </p>
        <p class="foot__links">
          <a href="/api/deals.json">deals.json</a>
          <a href="/feed.xml">RSS</a>
          <a href="/llms.txt">llms.txt</a>
          <span>Hecho por <a href="https://chrisdalbano.com" rel="noopener">Chris D'Albano</a></span>
          <span>El dominio barato.si está en venta. <a href="https://chrisdalbano.com" rel="noopener">Escríbeme</a>.</span>
        </p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.site { display: flex; flex-direction: column; min-height: 100dvh; }
main { flex: 1; }
.skip { position: absolute; left: -9999px; top: 0; padding: 8px 12px; background: var(--fg-primary); color: var(--bg-canvas); z-index: 10; }
.skip:focus { left: 8px; top: 8px; }

.top { border-bottom: 1px solid var(--fg-primary); }
.top__inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 64px; }
.brand { display: flex; align-items: baseline; gap: 12px; color: var(--fg-primary); text-decoration: none; }
.brand__name { font-size: 1.375rem; font-weight: 700; letter-spacing: -0.04em; }
.brand__dot { color: var(--accent-lead); }
.brand__tag { font-size: 0.8125rem; color: var(--fg-muted); }
nav { display: flex; gap: clamp(14px, 2.5vw, 28px); }
.top__link { font-size: 0.875rem; font-weight: 500; color: var(--fg-primary); text-decoration: none; padding: 4px 0; border-bottom: 1px solid transparent; }
.top__link:hover { border-bottom-color: var(--fg-primary); }
.top__link[aria-current="page"] { color: var(--accent-lead); border-bottom-color: var(--accent-lead); }

.foot { margin-top: clamp(64px, 8vw, 120px); border-top: 1px solid var(--fg-primary); }
.foot__inner { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px 48px; padding-top: 24px; padding-bottom: 40px; font-size: 0.8125rem; color: var(--fg-secondary); }
.foot p { margin: 0; }
.foot__sign { grid-column: 1 / -1; font-size: clamp(1.75rem, 4vw, 2.75rem); font-weight: 700; letter-spacing: -0.05em; line-height: 1; color: var(--fg-primary); }
.foot__dot { color: var(--accent-lead); }
.foot__legal { max-width: 62ch; }
.foot__links { display: flex; flex-wrap: wrap; gap: 6px 18px; align-content: start; }
.foot a { color: var(--fg-primary); text-underline-offset: 3px; }
.foot a:hover { color: var(--link-fg); }

@media (max-width: 640px) {
  .brand__tag { display: none; }
  .foot__inner { grid-template-columns: 1fr; }
}
</style>
