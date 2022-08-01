import { browser } from "$app/env"

interface Config {
  cssFile? : string
}

const defaults = {
  cssFile: 'global.css'
}

export const globalcss = ({cssFile = defaults.cssFile} : Config = defaults) => {
  if(!browser) return
  injectCssTransition()

  const allGlobalLinks = () => Array.from(
    document.querySelectorAll(`head link[href*="${cssFile}?"]`)
  ) as HTMLLinkElement[]

  const latestStylesheet = () => {
    const links = allGlobalLinks()
    if(links.length == 0) return null
    else return links.reduce((prev, link) => {
      return link.href > prev.href ? link : prev
    })
  }
  
  const removeAllButLatest = (latest : HTMLLinkElement) => {
    allGlobalLinks().forEach(link => {
      if(link != latest) link.remove()
    })
  }

  const refreshGlobalcss = function () {
    const link = latestStylesheet()
    if(!link) throw new Error("Global stylesheet link not found in head. Use %sveltekit.globalcss% as a template variable.")
    
    document.documentElement.classList.add('livejs-loading')

    const newLink = document.createElement("link")  
    newLink.setAttribute("rel", "stylesheet")
    newLink.setAttribute("type", "text/css")
    newLink.setAttribute("href", link.href.replace(/\?\d+$/, '?' + Date.now()))

    link.parentNode?.insertBefore(newLink, link.nextSibling)

    removeoldLinkElements(newLink)
  }

  // removes the old stylesheet rules only once the new one has finished loading
  const removeoldLinkElements = function (link : HTMLLinkElement) {
      // if this sheet has any cssRules, delete the old link
      const html = document.documentElement
      const rules = link.sheet?.cssRules

      if (rules && rules.length >= 0) {
        removeAllButLatest(link)
        setTimeout(() => html.classList.remove('livejs-loading'), 100)
      } else {
        setTimeout(() => removeoldLinkElements(link), 50);
      }
  }

  // @ts-ignore
  if(import.meta.hot) {
    // @ts-ignore
    import.meta.hot.on('globalcss:update', refreshGlobalcss)
  }
  else {
    console.warn('globalcss: Vite HMR not enabled, auto stylesheet reloading will not work.')
  }
}

const injectCssTransition = () => {
  const head = document.getElementsByTagName("head")[0],  
    style = document.createElement("style") as HTMLStyleElement,
    rule = "transition: all .3s ease-out;",
    css = [".livejs-loading * { ", rule, " -webkit-", rule, "-moz-", rule, "-o-", rule, "}"].join('')

  style.setAttribute("type", "text/css")
  style.appendChild(document.createTextNode(css))

  head.appendChild(style)
}
