# capucho-apps-manager

capacitor plugin to list and get info abotu the installed app in ur device

## Install

```bash
npm install capucho-apps-manager
npx cap sync
```

## API

<docgen-index>

* [`echo(...)`](#echo)
* [`getAppInfo(...)`](#getappinfo)
* [`openApp(...)`](#openapp)
* [`getInstalledApps()`](#getinstalledapps)
* [Interfaces](#interfaces)

</docgen-index>

<docgen-api>
<!--Update the source file JSDoc comments and rerun docgen to update the docs below-->

### echo(...)

```typescript
echo(options: { value: string; }) => any
```

| Param         | Type                            |
| ------------- | ------------------------------- |
| **`options`** | <code>{ value: string; }</code> |

**Returns:** <code>any</code>

--------------------


### getAppInfo(...)

```typescript
getAppInfo(options: { bundleId: string; }) => any
```

Get information about an app by its bundle identifier.

| Param         | Type                               |
| ------------- | ---------------------------------- |
| **`options`** | <code>{ bundleId: string; }</code> |

**Returns:** <code>any</code>

--------------------


### openApp(...)

```typescript
openApp(options: { bundleId: string; }) => any
```

Attempt to open an app by its bundle identifier.

| Param         | Type                               |
| ------------- | ---------------------------------- |
| **`options`** | <code>{ bundleId: string; }</code> |

**Returns:** <code>any</code>

--------------------


### getInstalledApps()

```typescript
getInstalledApps() => any
```

Get a list of all installed apps on the device.
Note: Requires QUERY_ALL_PACKAGES on Android.

**Returns:** <code>any</code>

--------------------


### Interfaces


#### AppInfo

| Prop              | Type                 |
| ----------------- | -------------------- |
| **`bundleId`**    | <code>string</code>  |
| **`isInstalled`** | <code>boolean</code> |
| **`versionName`** | <code>string</code>  |
| **`versionCode`** | <code>number</code>  |

</docgen-api>
