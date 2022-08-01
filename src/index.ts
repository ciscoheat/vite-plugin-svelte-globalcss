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
    
    sassOptions = Object.assign({
        loadPaths: [path.dirname(fileName)], 
        style: "compressed" 
    }, sassOptions)

    const templateParameter = `%sveltekit.${pluginName}%`
    const devOutputFile = path.join(assets, outputFilename)
    const devSassOptions = Object.assign({}, sassOptions, {style: "expanded"})

    const d = debug(pluginName)
    if(debugToStdout) d.log = console.info.bind(console)

    d('Plugin started.')
       
    const buildCss = async (mode : "dev" | "build") => {
        const options = mode == "dev" ? devSassOptions : sassOptions
        return sass.compile(fileName, options).css
    }
        
    const writeHotString = async (fileContent : string) => {
        d('Compiling dev output file from string.')
        return fs.outputFile(
            devOutputFile,
            sass.compileString(fileContent, devSassOptions).css
        )
    }

    const writeHotFile = async () => {
        d('Compiling dev output file.')
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

            return code.replace(
                templateParameter,
                `<link rel=\\"stylesheet\\" type=\\"text/css\\" href=\\"${this.getFileName(refId)}\\" />`
            )
        },

        writeBundle(options, bundle) {
            if(!options.dir) return

            const filename = path.join(options.dir, outputFilename)
            d(`Removing dev css file "${filename}" from bundle.`)
            
            fs.remove(filename)
        },
       
        async handleHotUpdate(ctx : HmrContext) {
            const sendUpdateEvent = () => {
                d('Sending update event to client.')
                ctx.server.ws.send('globalcss:update')
            }

            const isSourceFile = () => path.relative(fileName, ctx.file) === ''
            const isDevOutputFile = () => path.relative(devOutputFile, ctx.file) === ''
            const isCssFile = () => ['.css', '.sass', '.scss'].some(ext => ctx.file.endsWith(ext))
        
            try {
                //d('handleHotUpdate: ' + ctx.file)

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
