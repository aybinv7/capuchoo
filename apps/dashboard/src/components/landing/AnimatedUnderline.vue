<template>
  <svg
    viewBox="0 0 200 9"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="w-full h-auto absolute -bottom-2 left-0 right-0 z-[-1] overflow-visible"
  >
    <path
      d="M2.00025 6.99997C2.00025 6.99997 64.9194 -1.3826 111.968 1.99951C159.017 5.38166 198.819 5.50029 198.819 5.50029"
      stroke="url(#paint0_linear)"
      stroke-width="3"
      stroke-linecap="round"
      class="animate-draw"
    />
    <defs>
      <linearGradient
        id="paint0_linear"
        x1="2"
        y1="5"
        x2="200"
        y2="5"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="#EAB308" />
        <stop offset="1" stop-color="#CA8A04" />
      </linearGradient>
    </defs>
  </svg>
</template>

<style scoped>
.animate-draw {
  stroke-dasharray: 200;
  stroke-dashoffset: 200;
  animation: draw 1s ease-out forwards;
}

@keyframes draw {
  to {
    stroke-dashoffset: 0;
  }
}
</style>
