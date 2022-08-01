import { dev } from '$app/env'
import { assets } from '$app/paths'
// @ts-ignore
import type { RequestEvent } from '@sveltejs/kit'
// @ts-ignore
import type { Handle } from '@sveltejs/kit'

type Resolve = Parameters<Handle>[0]['resolve']

const templateVar = '%sveltekit.globalcss%'
const cssFile = 'global.css'

export const handle = ({event, resolve} : {event: RequestEvent, resolve: Resolve}) => 
  handleGlobalcss(event, resolve)

export const handleGlobalcss = (event: RequestEvent, resolve: Resolve) =>
  resolve(event, { transformPageChunk: transformGlobalcss }) as Promise<Response>

export function transformGlobalcss({ html } : {html : string}) {
  if(!dev || html.indexOf(templateVar) === -1) return html

  const timestamp = Date.now()
  return html.replace(templateVar, `<link rel="stylesheet" href="${assets}/${cssFile}?${timestamp}">`)
}