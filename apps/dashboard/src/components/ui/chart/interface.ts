export interface Data {
  [key: string]: any
}

export type Direction = 'horizontal' | 'vertical'

// export type ChartConfig = {
//   [k: string]: {
//     label?: string
//     icon?: any
//     color?: string
//   }
// }

export type ChartStyle = Record<string, string | number>
