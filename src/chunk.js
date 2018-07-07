var CPU6502 = require('./cpu')
var MersenneTwister = require('./mersenne-twister')

var defaultRngSeed = 0x12345678

class Chunk {
  constructor (config) {
    var chunk = this
    config = config || {}
    function makeSize (sz) {
      sz = sz || config.size || 1
      if (Math.pow (2, Math.floor (Math.log(sz) / Math.log(2))) !== sz)
        throw new Error ("Size " + sz + " is not a power of 2")
      return sz
    }
    this.xSize = makeSize (config.xSize)
    this.ySize = makeSize (config.ySize)
    this.zSize = makeSize (config.zSize)
    this.cell = new Array(chunk.xSize).fill(0).map (function() {
      return new Array(chunk.ySize).fill(0).map (function() {
        return new Array(chunk.zSize).fill(0).map (function() {
          return new Uint8Array (256)
        })
      })
    })
    this.rng = new MersenneTwister (typeof(config.seed) === 'undefined' ? defaultRngSeed : config.seed)
    this.pageDelta = [[-1,-1,-1], [-1,-1,0], [-1,-1,+1],
                      [-1, 0,-1], [-1, 0,0], [-1, 0,+1],
                      [-1,+1,-1], [-1,+1,0], [-1,+1,+1],
                       
                      [ 0,-1,-1], [ 0,-1,0], [ 0,-1,+1],
                      [ 0, 0,-1], /* zero */ [ 0, 0,+1],
                      [ 0,+1,-1], [ 0,+1,0], [ 0,+1,+1],

                      [+1,-1,-1], [+1,-1,0], [+1,-1,+1],
                      [+1, 0,-1], [+1, 0,0], [+1, 0,+1],
                      [+1,+1,-1], [+1,+1,0], [+1,+1,+1]]
  }

  numberOfCells() {
    return this.xSize * this.ySize * this.zSize
  }
  
  cellPage (x, y, z) {
    return { oldState: this.cell[x][y][z], newState: {} }
  }

  randomStopTime() {
    var r = this.rng.random_int()
    var s = this.rng.random_int()
    var z
    for (z = 0; s & (1 << (32 - z)) === 0; ++z) { }
    var m = (z > 13 ? 13 : z) + 2, p = 1 << m
    return p | (r & (p - 1))
  }

  update() {
    var nUpdates = this.numberOfCells()
    for (var n = 0; n < nUpdates; ++n) {
      var x = this.rng.random_int() & (this.xSize - 1)
      var y = this.rng.random_int() & (this.ySize - 1)
      var z = this.rng.random_int() & (this.zSize - 1)
      this.updateCell (x, y, z)
    }
  }

  updateCell (x, y, z) {
    var chunk = this
    var xs = this.xSize, ys = this.ySize, zs = this.zSize

    // memory
    var zeroPage = this.cellPage (x, y, z)
    var stackPage = new Uint8Array (256)
    var nbrPage = this.pageDelta.map (function (xyzDelta) {
      var pageInfo = null
      var nx = x + xyzDelta[0], ny = y + xyzDelta[1], nz = z + xyzDelta[2]
      if (nx >= 0 && nx < xs && ny >= 0 && ny < ys && nz >= 0 && nz < zs)
        pageInfo = chunk.cellPage (nx, ny, nz)
      return pageInfo
    })
    var himem = 256 * (2 + nbrPage.length)
    var maxCycles = this.randomStopTime()
    
    var timeLSBAddr = 0xFFF6, timeMSBAddr = 0xFFF7, swapAddr = 0xFFF8, randAddr = 0xFFF9
    var minSpecialAddr = 0xFFF6, maxSpecialAddr = 0xFFF9

    // termination status
    var softwareInterrupt = false
    var swapCell = null  // if set to [nx,ny,nz] then swap [x,y,z] with that cell on termination

    // emulator
    var cpu = new CPU6502()

    cpu.read = function (addr) {
      if (addr < himem) {
        var offset = addr & 0xff, page = addr >> 8
        if (page === 1)
          return stackPage[offset]
        else {
          var pageInfo = page ? nbrPage[page - 2] : zeroPage
          if (pageInfo) {
            var newState = pageInfo.newState[offset]
            return typeof(newState) === 'undefined' ? pageInfo.oldState[offset] : newState
          }
        }
      } else if (addr === timeLSBAddr || addr === timeMSBAddr) {
        var cyclesLeft = maxCycles - cpu.cycles
        return (addr === timeLSBAddr ? cyclesLeft : (cyclesLeft >> 8)) & 0xFF
      } else if (addr === randAddr)
        return this.rng.random_int() & 0xFF
      return 0
    }

    cpu.write = function (addr, value) {
//      console.warn ('write ' + value.toString(16) + ' to ' + addr.toString(16))
      if (addr < himem) {
        var offset = addr & 0xff, page = addr >> 8
        if (page === 1)
          stackPage[offset] = value
        else {
          var pageInfo = page ? nbrPage[page - 2] : zeroPage
          if (pageInfo)
            pageInfo.newState[offset] = value
        }
      } else if (addr === swapAddr) {
        if (value >= 2 && value < nbrPage.length) {
          var xyzDelta = chunk.pageDelta[page]
          var nx = x + xyzDelta[0], ny = y + xyzDelta[1], nz = z + xyzDelta[2]
          if (nx >= 0 && nx < xs && ny >= 0 && ny < ys && nz >= 0 && nz < zs) {
            swapCell = [nx, ny, nz]
            softwareInterrupt = true
          }
        }
      }
    }

    cpu.brk = cpu.kil = function() {
      softwareInterrupt = true
    }

    // run
    while (!softwareInterrupt && cpu.cycles < maxCycles)
      cpu.step()

//    console.warn('updated ('+x+','+y+','+z+') softwareInterrupt='+softwareInterrupt+' cycles='+cpu.cycles+' stoptime='+maxCycles)

    // commit
    if (softwareInterrupt) {
      nbrPage.concat([zeroPage]).forEach (function (pageInfo) {
        if (pageInfo) {
          var cell = pageInfo.oldState, newState = pageInfo.newState
          Object.keys(newState).forEach (function (offsetKey, nbrIndex) {
//            console.warn ('writing ' + newState[offsetKey] + ' to ' + offsetKey + ' at (' + (nbrIndex ? chunk.pageDelta[nbrIndex-1] : [0,0,0]).join(',') + ')')
            cell [parseInt (offsetKey)] = newState [offsetKey]
          })
        }
      })
      if (swapCell) {
        var nx = swapCell[0], ny = swapCell[1], nz = swapCell[2]
        var nbrPage = this.cell[nx][ny][nz]
        var centralPage = this.cell[x][y][z]
        this.cell[nx][ny][nz] = centralPage
        this.cell[x][y][z] = nbrPage
      }
    }
  }
}

module.exports = Chunk;
