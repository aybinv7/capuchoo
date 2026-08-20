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
echo(options: { value: string; }) => Promise<{ value: string; }>
```

| Param         | Type                            |
| ------------- | ------------------------------- |
| **`options`** | <code>{ value: string; }</code> |

**Returns:** <code>Promise&lt;{ value: string; }&gt;</code>

--------------------


### getAppInfo(...)

```typescript
getAppInfo(options: { bundleId: string; }) => Promise<AppInfo>
```

Get information about an app by its bundle identifier.

| Param         | Type                               |
| ------------- | ---------------------------------- |
| **`options`** | <code>{ bundleId: string; }</code> |

**Returns:** <code>Promise&lt;<a href="#appinfo">AppInfo</a>&gt;</code>

--------------------


### openApp(...)

```typescript
openApp(options: { bundleId: string; }) => Promise<{ completed: boolean; }>
```

Attempt to open an app by its bundle identifier.

| Param         | Type                               |
| ------------- | ---------------------------------- |
| **`options`** | <code>{ bundleId: string; }</code> |

**Returns:** <code>Promise&lt;{ completed: boolean; }&gt;</code>

--------------------


### getInstalledApps()

```typescript
getInstalledApps() => Promise<{ apps: AppInfo[]; }>
```

Get a list of all installed apps on the device.
Note: Requires QUERY_ALL_PACKAGES on Android.

**Returns:** <code>Promise&lt;{ apps: AppInfo[]; }&gt;</code>

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
