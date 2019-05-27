#!/usr/bin/env node

/**
 * @license MIT
 * @version 1.1.0
 * @author Leonardo Quevedo
 */

require('colors')
const shell = require('shelljs')
const fs = require('fs-extra')
const path = require('path')
const brotli = require('brotli')
const klawSync = require('klaw-sync')

const { exec } = shell
const { log } = console

const getFileName = filePath => {
  return path.basename(filePath)
}

const gzip = async filePath => {
  log(`Gzipping ${getFileName(filePath)} file...`.yellow)
  await exec(`npx ngzip ${filePath} > ${filePath}.gz`)
}

const brotle = async filePath => {
  log(`Brotling ${getFileName(filePath)} file...`.yellow)
  let brotled = brotli.compress(fs.readFileSync(filePath))
  await fs.writeFileSync(`${filePath}.br`, brotled, { encode: 'UTF-8' })
}

const optimizeJS = async filePath => {
  log(`Optimizing ${getFileName(filePath)} file...`.yellow)
  await exec(
    `npx babel-cli ${filePath} --out-file ${filePath} --presets=@babel/env --compact=true --quiet`
  )
  log(`Uglyfying ${getFileName(filePath)} file...`.yellow)
  await exec(`npx uglifyjs ${filePath} -o ${filePath} --compress --mangle`)
  if (process.env.CAPBOX_PLATFORM === 'pwa') {
    await gzip(filePath)
    await brotle(filePath)
  }
}

const optimizeJSFilesFor = async (buildDir, options) => {
  let files = klawSync(buildDir)
    .map(file => {
      if (file && file.path) return file.path
    })
    .filter(file => {
      const filename = file || ''
      const nameChunks = filename.split('.')
      const extension = nameChunks[nameChunks.length - 1]
      return extension === 'js' && options.blacklist.indexOf(filename) == -1
    })
  return Promise.all(files.map(file => optimizeJS(file)))
}

module.exports = new Promise(async (resolve, reject) => {
  try {
    const rootPath = process.env.CAPACITOR_PROJECT_ROOT
    const capacitorConfig = require(path.join(rootPath, 'capacitor.config.json'))
    const buildDir = path.join(rootPath, capacitorConfig.webDir)
    const blacklist = ['polyfills.js', 'sw-toolbox.js']
    await optimizeJSFilesFor(buildDir, { blacklist })
    resolve()
  } catch (e) {
    reject(e)
  }
})