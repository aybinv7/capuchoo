import type { ColumnDef } from '@tanstack/vue-table'
import { h } from 'vue'
import StreamlineLogosAppleLogoBlock from '~icons/streamline-logos/apple-logo-block'
import StreamlineLogosAndroidLogoBlock from '~icons/streamline-logos/android-logo-block'
import {
  Smartphone,
  Trash2,
  MoreHorizontal,
  PinOff,
  Pin,
  Eye,
  Edit,
  Copy,
  ChevronUp,
  ChevronDown,
  Globe,
  Zap,
} from 'lucide-vue-next'
import UpdatesBundlesTableDataTableColumnHeader from './DataTable/UpdatesBundlesTableDataTableColumnHeader.vue'

import type { UpdateOrBundle } from '../../types/updates-bundles.types'
import type { CheckboxCheckedState } from 'reka-ui'

export const updatesBundlesColumns: ColumnDef<UpdateOrBundle>[] = [
  // Selection Column
  {
    id: 'select',
    header: ({ table }) =>
      h(Checkbox, {
        modelValue:
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate'),
        'onUpdate:modelValue': (value: CheckboxCheckedState) =>
          table.toggleAllPageRowsSelected(!!value),
        ariaLabel: 'Select all',
      }),
    cell: ({ row }) =>
      h(Checkbox, {
        modelValue: row.getIsSelected(),
        'onUpdate:modelValue': (value: CheckboxCheckedState) => row.toggleSelected(!!value),
        ariaLabel: `Select ${row.original.id}`,
        onClick: (e: Event) => e.stopPropagation(), // Prevent row click
      }),
    enableSorting: false,
    enableHiding: false,
    enablePinning: true,
    enableGrouping: false,
    enableResizing: false,
    size: 40,
    minSize: 40,
    maxSize: 40,
    meta: {
      disableDragging: true, // Prevent dragging of select column
    },
  },
  // Type Column
  {
    accessorKey: 'type',
    header: ({ column }) => h(UpdatesBundlesTableDataTableColumnHeader, { column, title: 'Type' }),
    cell: ({ row, table }) => {
      const type = row.original.type
      return h(
        Badge,
        {
          variant: type === 'native' ? 'default' : 'secondary',
        },
        () => (type === 'native' ? 'Native' : 'Bundle'),
      )
    },
    enableSorting: true,
    enableHiding: true,
    meta: {
      filterVariant: 'select',
      faceted: true,
    },
  },
  // App ID Column
  {
    accessorKey: 'app_bundle_id',
    header: ({ column }) =>
      h(UpdatesBundlesTableDataTableColumnHeader, { column, title: 'Bundle ID' }),
    cell: ({ row, table }) => {
      const appId = (row.original as any).app_bundle_id
      return h(
        'div',
        { class: 'font-mono text-[10px] text-muted-foreground' },
        appId || row.original.app_id,
      )
    },
    enableSorting: true,
    enableHiding: true,
    size: 150,
  },
  // Version Column
  {
    accessorKey: 'version_name',
    header: ({ column }) =>
      h(UpdatesBundlesTableDataTableColumnHeader, { column, title: 'Version' }),
    cell: ({ row, table }) => {
      const type = row.original.type
      return h('div', { class: 'flex items-center' }, [
        h(type === 'native' ? Smartphone : Globe, {
          class: `w-5 h-5 mr-2`,
        }),
        h('span', { class: 'font-medium' }, row.original.version_name),

        // Latest Badge (Recent Upload)
        (row.original as any).is_latest &&
          h(
            Badge,
            {
              variant: 'secondary',
              class:
                'ml-2 text-[10px] uppercase h-5 px-1.5 bg-blue-50 text-blue-700 border-blue-200 font-bold',
            },
            () => 'Latest',
          ),

        // Live Badges (Assigned to Channel)
        ...(row.original.is_active_for || []).map((channel) =>
          h(
            Badge,
            {
              variant: 'outline',
              class:
                'ml-2 text-[10px] uppercase h-5 px-1.5 bg-green-50 text-green-700 border-green-200 font-bold',
            },
            () => `Live on ${channel}`,
          ),
        ),
      ])
    },
    enableSorting: true,
    enableHiding: true,
    enableColumnFilter: true,
    enableGlobalFilter: true,
    filterFn: 'auto',
    size: 120,
  },

  // Version Code Column (for native updates only)
  {
    accessorKey: 'version_code',
    header: ({ column }) => h(UpdatesBundlesTableDataTableColumnHeader, { column, title: 'Code' }),
    cell: ({ row, table }) => {
      const versionCode = row.original.version_code
      return h('div', { class: 'font-mono' }, versionCode ? versionCode.toString() : '—')
    },
    enableSorting: true,
    enableHiding: true,
    enableColumnFilter: true,
    filterFn: 'inNumberRange',
    size: 80,
    meta: {
      filterVariant: 'range',
    },
  },

  // Min Native Version Column (for OTA bundles only)
  {
    accessorKey: 'min_native_version',
    header: ({ column }) =>
      h(UpdatesBundlesTableDataTableColumnHeader, { column, title: 'Min Native' }),
    cell: ({ row, table }) => {
      const minNative = row.original.min_native_version
      if (!minNative || row.original.type === 'native') {
        return h('div', { class: 'text-muted-foreground' }, '—')
      }
      return h('div', { class: 'font-mono' }, `v${minNative}`)
    },
    enableSorting: true,
    enableHiding: true,
    enableColumnFilter: true,
    filterFn: 'inNumberRange',
    size: 100,
    meta: {
      filterVariant: 'range',
    },
  },

  {
    accessorKey: 'platform',
    header: ({ column }) =>
      h(UpdatesBundlesTableDataTableColumnHeader, { column, title: 'Platform' }),
    cell: ({ row, table }) => {
      const platform = row.getValue('platform') as string
      const platfroms: Record<string, any> = {
        android: StreamlineLogosAndroidLogoBlock,
        apple: StreamlineLogosAppleLogoBlock,
      }
      const Icon = platfroms[platform]

      return h('div', { class: 'flex items-center gap-2' }, [
        h(Icon, { class: 'h-4 w-4 text-muted-foreground' }),
        h('span', platform),
      ])
    },
    enableSorting: true,
    enableHiding: true,
    enableGrouping: true,
    enableColumnFilter: true,
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
    size: 90,
    maxSize: 500,

    meta: {
      filterVariant: 'select',
      faceted: true,
    },
  },

  // Channel Column
  {
    accessorKey: 'channel',
    header: ({ column }) =>
      h(UpdatesBundlesTableDataTableColumnHeader, { column, title: 'Channel' }),
    cell: ({ row, table }) => {
      const channel = row.original.channel
      const variantMap: Record<'prod' | 'staging' | 'dev', 'default' | 'secondary' | 'outline'> = {
        prod: 'default',
        staging: 'secondary',
        dev: 'outline',
      }

      return h(
        Badge,
        {
          variant: variantMap[channel],
        },
        () => channel.charAt(0).toUpperCase() + channel.slice(1),
      )
    },
    enableSorting: true,
    enableHiding: true,
    enableColumnFilter: true,
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
    size: 100,
    meta: {
      filterVariant: 'select',
      faceted: true,
    },
  },

  // File Size Column (for native updates only)
  {
    accessorKey: 'file_size_bytes',
    header: ({ column }) => h(UpdatesBundlesTableDataTableColumnHeader, { column, title: 'Size' }),
    cell: ({ row, table }) => {
      const fileSize = row.original.file_size_bytes
      if (!fileSize) return h('div', '—')

      // Format file size
      let size = fileSize
      let unit = 'B'
      if (size >= 1024 * 1024) {
        size = parseFloat((size / (1024 * 1024)).toFixed(2))
        unit = 'MB'
      } else if (size >= 1024) {
        size = parseFloat((size / 1024).toFixed(1))
        unit = 'KB'
      }

      return h('div', {}, `${size} ${unit}`)
    },
    enableSorting: true,
    enableHiding: true,
    enableColumnFilter: true,
    filterFn: 'inNumberRange',
    size: 80,
    meta: {
      filterVariant: 'range',
    },
  },

  // Created At Column
  {
    accessorKey: 'created_at',
    header: ({ column }) => h(UpdatesBundlesTableDataTableColumnHeader, { column, title: 'Date' }),
    cell: ({ row, table }) => {
      const date = new Date(row.original.created_at)
      return h('div', {}, date.toLocaleDateString())
    },
    enableSorting: true,
    enableHiding: true,
    enableColumnFilter: false, // Date filters not needed for this table
    size: 120,
  },

  // Active Status Column
  {
    accessorKey: 'active',
    header: ({ column }) =>
      h(UpdatesBundlesTableDataTableColumnHeader, { column, title: 'Status' }),
    cell: ({ row, table }) => {
      const active = row.original.active
      return h(
        Badge,
        {
          variant: active ? 'default' : 'destructive',
        },
        () => (active ? 'Active' : 'Inactive'),
      )
    },
    enableSorting: true,
    enableHiding: true,
    enableColumnFilter: true,
    filterFn: (row, id, value) => {
      if (value === 'all') return true
      return row.getValue(id) === (value === 'true')
    },
    size: 100,
    meta: {
      filterVariant: 'select',
    },
  },

  // Required Column
  {
    accessorKey: 'required',
    header: ({ column }) =>
      h(UpdatesBundlesTableDataTableColumnHeader, { column, title: 'Required' }),
    cell: ({ row, table }) => {
      const required = row.original.required
      return h(
        Badge,
        {
          variant: required ? 'default' : 'outline',
        },
        () => (required ? 'Yes' : 'No'),
      )
    },
    enableSorting: true,
    enableHiding: true,
    enableColumnFilter: true,
    filterFn: (row, id, value) => {
      if (value === 'all') return true
      return row.getValue(id) === (value === 'true')
    },
    size: 100,
    meta: {
      filterVariant: 'select',
    },
  },

  // Actions Column
  {
    id: 'actions',
    header: '',
    cell: ({ row, table }) => {
      const item = row.original
      const router = useRouter()

      return h('div', { class: 'flex items-center gap-2' }, [
        // Quick actions
        h(
          Button,
          {
            variant: 'ghost',
            size: 'icon',
            class: 'h-8 w-8',
            onClick: (e: Event) => {
              e.stopPropagation()
              row.pin(row.getIsPinned() === 'top' ? 'bottom' : 'top')
            },
          },
          () => h(row.getIsPinned() ? PinOff : Pin, { class: 'h-4 w-4' }),
        ),

        h(
          Button,
          {
            variant: 'ghost',
            size: 'icon',
            class: 'h-8 w-8 text-yellow-500 hover:text-yellow-600',
            onClick: (e: Event) => {
              e.stopPropagation()
              const meta = table.options.meta as any
              if (meta?.triggerPromote) {
                meta.triggerPromote(item.id)
              }
            },
          },
          () => h(Zap, { class: 'h-4 w-4' }),
        ),

        // Dropdown menu
        h(
          DropdownMenu,
          {},
          {
            default: () => [
              h(
                DropdownMenuTrigger,
                { asChild: true },
                {
                  default: () =>
                    h(
                      Button,
                      {
                        variant: 'ghost',
                        size: 'icon',
                        class: 'h-8 w-8',
                        onClick: (e: Event) => e.stopPropagation(),
                      },
                      () => [
                        h(MoreHorizontal, { class: 'h-4 w-4' }),
                        h('span', { class: 'sr-only' }, 'Open menu'),
                      ],
                    ),
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
                        onClick: () => router.push(`/updates-bundles/${item.id}`),
                      },
                      () => [h(Eye, { class: 'h-4 w-4 mr-2' }), 'View'],
                    ),
                    h(
                      DropdownMenuItem,
                      {
                        onClick: () => router.push(`/updates-bundles/${item.id}/edit`),
                      },
                      () => [h(Edit, { class: 'h-4 w-4 mr-2' }), 'Edit'],
                    ),
                    h(
                      DropdownMenuItem,
                      {
                        onClick: () => {
                          navigator.clipboard.writeText(item.id.toString())
                        },
                      },
                      () => [h(Copy, { class: 'h-4 w-4 mr-2' }), 'Copy ID'],
                    ),
                    h(DropdownMenuSeparator),
                    h(
                      DropdownMenuItem,
                      {
                        onClick: () => row.toggleExpanded(),
                      },
                      () => [
                        h(row.getIsExpanded() ? ChevronUp : ChevronDown, {
                          class: 'h-4 w-4 mr-2',
                        }),
                        row.getIsExpanded() ? 'Collapse' : 'Expand',
                      ],
                    ),
                    h(DropdownMenuSeparator),
                    h(
                      DropdownMenuItem,
                      {
                        class: 'text-red-600',
                        onClick: () => {
                          // Emit delete event
                          console.log('Delete item:', item.id)
                        },
                      },
                      () => [h(Trash2, { class: 'h-4 w-4 mr-2' }), 'Delete'],
                    ),
                  ],
                },
              ),
            ],
          },
        ),
      ])
    },
    enableHiding: false,
    enablePinning: true,
    size: 100,
    minSize: 100,
    maxSize: 500,
    meta: {
      disableDragging: true,
    },
  },
]
