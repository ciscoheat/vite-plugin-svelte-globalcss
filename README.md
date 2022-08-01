# vite-plugin-svelte-globalcss

A [Sveltekit](https://kit.svelte.dev/) plugin that enables you to include a global css/sass file in your Sveltekit project. Supports hot reloading.

When using a css framework like [Bulma](https://bulma.io/), you configure layout, spacing, typography, etc, by  variables that will be used throughout the project as css classes, for example `is-size-3 has-background-primary-light`. This is largely incompatible with Svelte's component css which is isolated from the rest of the project. 

Furthermore there seems to be no way to include a global css file without jumping through a lot of hoops. The simple solution would be just to add a `<link rel="stylesheet" href="..." />` element in `app.html`. But that has a few drawbacks:

- You can't just link to a stylesheet without having cache problems, so you must regularly bust the cache
- The file you linked to won't be hot reloaded in Sveltekit
- If your file is built with [Sass](https://sass-lang.com/), you must compile it in a separate build step.

This plugin has been created to alleviate these problems.

## Configuration

Unfortunately there are still a few hoops you need to jump through to make it work, but you will be rewarded with a seamless experience; on the dev server you can save your Sass file and it will be hot reloaded, when building for production the css file will be built as a file included in the normal output, referenced with a cache busting filename from [Vite](https://vitejs.dev/). 

There are four things you need to do:

### 1. Adding the plugin

Import and add the plugin to `vite.config.js` with the `fileName` attribute pointing to your css/sass file:

```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import { globalcss } from 'vite-plugin-svelte-globalcss'

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [sveltekit(), globalcss({ fileName: './src/sass/app.scss' })]
}

export default config
```

This will build and compile your file automatically.

### 2. Modifying app.html

In `app.html`, above `%sveltekit.head%`, add another template variable.

```html
%sveltekit.globalcss%
%sveltekit.head%
```

It will be replaced by the stylesheet element.

### 3. Modify the main Svelte component

This code is for the hot reloading functionality. In the "entrypoint" Svelte component or `__layout.svelte`, add this code:

```html
<script lang="ts">
  import { globalcss } from 'vite-plugin-svelte-globalcss/client'
  globalcss()
</script>
```

### 4. Adding a hook

The final part is to rewrite the html response to actually replace the `%sveltekit.globalcss%` variable. If you're not using [SvelteKit hooks](https://kit.svelte.dev/docs/hooks), this is very simple to add. Create a `src/hooks.js` file with the following content:

```javascript
export { handle } from 'vite-plugin-svelte-globalcss/hooks'
```

If you're already using a hooks file, you can import the `transformGlobalcss` function and use it as an option to `handle`:

```javascript
import { transformGlobalcss } from 'vite-plugin-svelte-globalcss/hooks'

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  const response = await resolve(event, {
    transformPageChunk: transformGlobalcss
  });
 
  return response;
}
```

After all this, you can finally enjoy your enhanced Sveltekit project with `npm run dev` or `npm run build`!

## Plugin options

```typescript
{
    fileName : string
    outputFilename? = "global.css"

    // See https://sass-lang.com/documentation/js-api/interfaces/Options
    sassOptions? = sass.Options<"sync">

    // Sveltekit assets directory, outputFilename will be placed here in dev mode.
    assets? = "static"
}
```

## Issues

Creating a plugin like this by understanding the Rollup build process, configuring typescript, figuring out how Rollup/Vite/Svelte interacts, publishing the plugin to NPM with the correct module settings, etc, is honestly quite a lot of work and generally frustrating, so I'm sure this plugin has a lot of issues. Let me know if you find something, or even better, help me out with a PR. Things aren't supposed to be this complicated.
