// @ts-ignore
import type { Plugin } from "vite"

import sass, { Options } from "sass"
import fs from "fs-extra"
import path from 'path'
import debug from 'debug'

interface Config {
    fileName : string
    debugToStdout? : boolean
    outputFilename? : string
    sassOptions? : Options<"sync">
    assets? : string
}

const pluginName = 'globalcss'
const templateParameter = `%sveltekit.${pluginName}%`

export const globalcss = ({
    fileName, 
    outputFilename = 'global.css', 
    debugToStdout = false, 
    sassOptions = {},
    assets = 'static'
} : Config) => {
    
    sassOptions = Object.assign({
        loadPaths: [path.dirname(fileName)], 
        style: "compressed" 
    }, sassOptions)

    const d = debug(pluginName)
    if(debugToStdout) d.log = console.info.bind(console)
    
    d('Plugin loaded.')
    
    //const svelteHtmlChunk = '/build/index.js'
    const devOutputFile = path.join(assets, outputFilename)
    
    const isSass = () => fileName.endsWith('.scss') || fileName.endsWith('.sass')    
    const devSassOptions = () => Object.assign({}, sassOptions, {style: "expanded"})

    const buildCss = async (dev : boolean) => {
        const options = dev
            ? devSassOptions()
            : sassOptions
            
        return isSass() 
            ? sass.compile(fileName, options).css 
            : fs.readFile(fileName)
    }
        
    const writeHotBuild = async (fileContent : string) => {
        d('Hot compiling sass file.')
        return fs.outputFile(
            devOutputFile, 
            isSass()
                ? sass.compileString(fileContent, devSassOptions()).css
                : fileContent
        )
    }
        
    const writeDevBuildIfModified = async () => {
        try {
            const [source, dest] = await Promise.all([fs.stat(fileName), fs.stat(devOutputFile)])
            if(source.mtimeMs < dest.mtimeMs) {
                d('Compiled file is newer, no recompilation.')
                return Promise.resolve()
            }
        } catch(err) {
            // One of the files doesn't exist, so recompile.
        }
        
        d('Compiling sass file for dev server.')        
        const css = await buildCss(true)
        return fs.outputFile(devOutputFile, css)
    }

    let refId : string = ''

    return {
        name: 'globalcss',
        
        async buildStart(options) {
            if(this.meta.watchMode) {
                try {
                    await writeDevBuildIfModified()
                } catch(err) {
                    d('Sass compile error!')
                    this.warn(err as any)
                }
            } else {
                const content = await buildCss(false)
                refId = this.emitFile({
                    type: 'asset',
                    name: outputFilename,
                    source: content
                })    
            }
        },
        
        renderChunk(code, chunk, options) {
            // Svelte components won't contain the template parameter.
            if(chunk.facadeModuleId?.endsWith('.svelte')) return null
            if(code.indexOf(templateParameter) === -1) return null

            d('Replacing template in ' + chunk.fileName)

            return code.replace(
                templateParameter,
                `<link rel=\\"stylesheet\\" type=\\"text/css\\" href=\\"${this.getFileName(refId)}\\" />`
            )
        },

        writeBundle(options, bundle) {
            if(options.dir)
                fs.remove(path.join(options.dir, outputFilename))
        },
       
        handleHotUpdate(ctx) {
            if(path.relative(ctx.file, fileName) === '') {
                ;(ctx.read() as Promise<string>).then(s => {
                    writeHotBuild(s).then(() => {
                        d('Sending update event to client.')
                        ctx.server.ws.send('globalcss:update')
                    }).catch(err => {
                        ctx.server.ws.send('globalcss:error', err)
                    })
                })
            }
        } 
    } as Plugin
}
