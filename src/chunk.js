var CPU6502 = require('./cpu')

class Chunk {
  constructor (config) {
    config = config || {}
    this.xSize = config.xSize || config.size || 1
    this.ySize = config.ySize || config.size || 1
    this.zSize = config.zSize || config.size || 1
    // More to go here
  }
}

module.exports = Chunk;
