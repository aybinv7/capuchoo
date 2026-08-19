import { cva } from 'class-variance-authority'

export const chartVariants = cva('w-full h-96', {
  variants: {
    type: {
      line: 'h-80 lg:h-96',
      bar: 'h-80 lg:h-96',
      area: 'h-80 lg:h-96',
      radial: 'h-60 lg:h-80',
      pie: 'h-60 lg:h-80',
    },
  },
  defaultVariants: {
    type: 'line',
  },
})