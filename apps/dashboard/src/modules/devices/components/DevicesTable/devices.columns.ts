import type { ColumnDef } from '@tanstack/vue-table'
import type { Device } from '../../types/devices.types'
import { h } from 'vue'
import { Checkbox } from '@/components/ui/checkbox'
import DataTableColumnHeader from '@/components/common/DataTable/components/DataTableColumnHeader.vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Trash2 } from 'lucide-vue-next'
import StreamlineLogosAppleLogoBlock from '~icons/streamline-logos/apple-logo-block'
import StreamlineLogosAndroidLogoBlock from '~icons/streamline-logos/android-logo-block'

export const devicesColumns: ColumnDef<Device>[] = [
  {
    id: 'select',
    header: ({ table }) =>
      h(Checkbox, {
        checked: table.getIsAllPageRowsSelected(),
        'onUpdate:checked': (value: boolean) => table.toggleAllPageRowsSelected(!!value),
        ariaLabel: 'Select all',
      }),
    cell: ({ row }) =>
      h(Checkbox, {
        checked: row.getIsSelected(),
        'onUpdate:checked': (value: boolean) => row.toggleSelected(!!value),
        ariaLabel: 'Select row',
        onClick: (e: Event) => e.stopPropagation(),
      }),
    enableSorting: false,
    enableHiding: false,
    meta: {
      disableDragging: true,
    },
  },
  {
    accessorKey: 'device_id',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Device ID' }),
    cell: ({ row }) =>
      h('div', { class: 'truncate max-w-[150px] font-mono text-xs' }, row.getValue('device_id')),
  },
  {
    accessorKey: 'platform',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Platform' }),
    cell: ({ row }) => {
      const platform = row.getValue('platform') as string
      const platfroms: Record<string, any> = {
        android: StreamlineLogosAndroidLogoBlock,
        ios: StreamlineLogosAppleLogoBlock,
      }
      const Icon = platfroms[platform]

      return h('div', { class: 'flex items-center gap-2' }, [
        h(Icon, { class: 'h-4 w-4 text-muted-foreground' }),
        h('span', platform),
      ])
    },
    meta: {
      filterVariant: 'select',
      faceted: true,
    },
  },
  {
    accessorKey: 'channel',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Channel' }),
    cell: ({ row }) => {
      return h('div', { class: 'flex items-center gap-2' }, [
        h(Badge, { variant: 'outline' }, () => row.getValue('channel') || 'default'),
      ])
    },
    meta: {
      filterVariant: 'select',
      faceted: true,
    },
  },
  {
    accessorKey: 'last_check',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Last Active' }),
    cell: ({ row }) => {
      const dateVal = row.getValue('last_check') as string
      if (!dateVal) return h('span', { class: 'text-muted-foreground text-xs' }, 'Never')
      const date = new Date(dateVal)
      return h('div', date.toLocaleString())
    },
  },
  {
    id: 'actions',
    header: '',
    enableHiding: false,
    cell: ({ row }) => {
      return h(
        DropdownMenu,
        {},
        {
          default: () => [
            h(
              DropdownMenuTrigger,
              { asChild: true, onClick: (e: Event) => e.stopPropagation() },
              {
                default: () =>
                  h(Button, { variant: 'ghost', size: 'icon', class: 'h-8 w-8' }, () => [
                    h(MoreHorizontal, { class: 'h-4 w-4' }),
                    h('span', { class: 'sr-only' }, 'Open menu'),
                  ]),
              },
            ),
            h(
              DropdownMenuContent,
              { align: 'end' },
              {
                default: () => [
                  h(DropdownMenuLabel, {}, () => 'Actions'),
                  h(
                    DropdownMenuItem,
                    {
                      onClick: () => navigator.clipboard.writeText(row.original.device_id),
                    },
                    () => 'Copy Device ID',
                  ),
                  h(DropdownMenuSeparator),
                  h(
                    DropdownMenuItem,
                    {
                      class: 'text-destructive',
                      onClick: (e: any) => {
                        e.stopPropagation()
                      },
                    },
                    () => [h(Trash2, { class: 'mr-2 h-4 w-4' }), 'Delete'],
                  ),
                ],
              },
            ),
          ],
        },
      )
    },
    meta: {
      disableDragging: true,
    },
  },
]
