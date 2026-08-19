<template>
  <Transition
    name="page"
    enter-from-class="opacity-0 translate-x-4"
    enter-active-class="transition-all duration-300 ease-out"
    enter-to-class="opacity-10 translate-x-0"
    leave-from-class="opacity-100 translate-x-0"
    leave-active-class="transition-all duration-300 ease-in"
    leave-to-class="opacity-0 -translate-x-4"
    mode="out-in"
    appear
  >
    <slot />
  </Transition>
</template>
