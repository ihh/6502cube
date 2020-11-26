var CPU6502 = require('./cpu')
var MersenneTwister = require('./mersenne-twister')
var md5 = require('./md5')

var defaultRngSeed = 0x12345678

class Board {
  constructor (config) {
    var board = this
    config = config || {}
    function makeSize (sz) {
      sz = sz || config.size || 1
      if (Math.pow (2, Math.floor (Math.log(sz) / Math.log(2))) !== sz)
        throw new Error ("Size " + sz + " is not a power of 2")
      return sz
    }
    this.size = makeSize (config.size)
    
    this.cell = new Array(board.size).fill(0).map (function() {
      return new Array(board.size).fill(0).map (function() {
        return new Uint8Array (256)
      })
    })
    this.prog = {}
    this.rng = new MersenneTwister (typeof(config.seed) === 'undefined' ? defaultRngSeed : config.seed)
    this.pageDelta = [[0,0], [1,0], [1,1], [0,1], [-1,1], [-1,0], [-1,-1], [0,-1], [1,-1]]
  }

  cellHash (x, y) {
    return md5 (this.cell[x][y])
  }

  numberOfCells() {
    return this.size * this.size
  }
  
  cellPage (x, y) {
    return { oldState: this.cell[x][y], newState: {} }
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
      var x = this.rng.random_int() & (this.size - 1)
      var y = this.rng.random_int() & (this.size - 1)
      this.updateCell (x, y)
    }
  }

  updateCell (x, y) {
    var board = this
    var xs = this.size, ys = this.size

    // memory
    var zeroPage = this.cellPage (x, y)
    var stackPage = new Uint8Array (256)
    var nbrPage = this.pageDelta.map (function (xyDelta) {
      var pageInfo = null
      var nx = x + xyDelta[0], ny = y + xyDelta[1]
      if (nx >= 0 && nx < xs && ny >= 0 && ny < ys)
        pageInfo = board.cellPage (nx, ny)
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
          var xyzDelta = board.pageDelta[page]
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
//            console.warn ('writing ' + newState[offsetKey] + ' to ' + offsetKey + ' at (' + (nbrIndex ? board.pageDelta[nbrIndex-1] : [0,0,0]).join(',') + ')')
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

module.exports = Board;
