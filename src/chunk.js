var CPU6502 = require('./cpu')

class Chunk {
  constructor (config) {
    config = config || {}
    this.xSize = config.xSize || config.size || 1
    this.ySize = config.ySize || config.size || 1
    this.zSize = config.zSize || config.size || 1
    this.state = new Array(this.xSize).fill(0).map (function() {
      return new Array(this.ySize).fill(0).map (function() {
        return new Array(this.zSize).fill(0).map (function() {
          return new Uint8Array (256)
        })
      })
    })
  }
}

module.exports = Chunk;
