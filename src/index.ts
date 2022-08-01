// @ts-ignore
import type { HmrContext, Plugin } from "vite"

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

export const globalcss = ({
    fileName, 
    outputFilename = 'global.css', 
    debugToStdout = false, 
    sassOptions = {},
    assets = 'static'
} : Config) => {
    const fileDir = path.dirname(fileName)

    sassOptions = Object.assign({
        loadPaths: [fileDir], 
        style: "compressed" 
    }, sassOptions)
    
    const d = debug(pluginName)
    if(debugToStdout) d.log = console.info.bind(console)

    d('Plugin started.')
       
    const templateParameter = `%sveltekit.${pluginName}%`
    const devOutputFile = path.join(assets, outputFilename)
    const devSassOptions = () => Object.assign({}, sassOptions, {style: "expanded"})

    const buildCss = async (mode : "dev" | "build") => {
        const options = mode == "dev" ? devSassOptions() : sassOptions
        return sass.compile(fileName, options).css
    }
        
    const writeHotString = async (fileContent : string) => {
        d('Hot compiling directly from fileName.')
        return fs.outputFile(
            devOutputFile,
            sass.compileString(fileContent, devSassOptions()).css
        )
    }

    const writeHotFile = async () => {
        d('Hot compiling from related file.')
        const css = await buildCss("dev")
        return fs.outputFile(devOutputFile, css)
    }

    let refId : string = ''

    return {
        name: 'globalcss',
        
        async buildStart(options) {
            if(this.meta.watchMode) {
                try {
                    await writeHotFile()
                } catch(err) {
                    d('Sass compile error!')
                    this.warn(err as any)
                }
            } else {
                const content = await buildCss("build")
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
            if(options.dir) {
                const filename = path.join(options.dir, outputFilename)
                fs.remove(filename)
                d(`Removed dev css file "${filename}" from bundle.`)
            }
        },
       
        async handleHotUpdate(ctx : HmrContext) {
            const sendUpdateEvent = () => {
                d('Sending update event to client.')
                ctx.server.ws.send('globalcss:update')
            }

            const isSourceFile = () => path.relative(fileName, ctx.file) === ''
            const isDevOutputFile = () => path.relative(devOutputFile, ctx.file) === ''
            const isCssFile = () => ['.css', '.sass', '.scss'].find(ext => ctx.file.endsWith(ext))
        
            try {
                d('handleHotUpdate: ' + ctx.file)

                if(isSourceFile()) {
                    const s : string = await ctx.read()
                    await writeHotString(s)
                    await sendUpdateEvent()
                } else if(!isDevOutputFile() && isCssFile()) {
                    setImmediate(async () => {
                        await writeHotFile()
                        await sendUpdateEvent()
                    })
                }
            } catch(err) {
                if(err) {
                    console.warn(err)
                    ctx.server.ws.send('globalcss:error', err)
                }
            }
        } 
    } as Plugin
}
