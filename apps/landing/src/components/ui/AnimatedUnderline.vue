<template>
  <svg
    viewBox="0 0 200 9"
    fill="none"
    aria-hidden="true"
    preserveAspectRatio="none"
    class="pointer-events-none absolute -bottom-2 left-0 h-2.5 w-full overflow-visible"
  >
    <path
      d="M2 7C2 7 64.9-1.4 112 2c47 3.4 86.8 3.5 86.8 3.5"
      stroke="currentColor"
      stroke-width="3"
      stroke-linecap="round"
      class="underline-draw text-primary/80"
    />
  </svg>
</template>

<style scoped>
.underline-draw {
  stroke-dasharray: 200;
  stroke-dashoffset: 200;
  animation: draw 1.1s 0.3s ease-out forwards;
}

@keyframes draw {
  to {
    stroke-dashoffset: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .underline-draw {
    animation: none;
    stroke-dashoffset: 0;
  }
}
</style>
