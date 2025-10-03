import { describe, it, expect } from 'vitest'
import { riskScore } from '../src/risk.js'
describe('riskScore', ()=>{
  it('is within 0..100', ()=>{
    expect(riskScore({diameterFt:0,speedMph:0,distanceMiles:1e7})).toBeGreaterThanOrEqual(0)
    expect(riskScore({diameterFt:1e5,speedMph:1e6,distanceMiles:1})).toBeLessThanOrEqual(100)
  })
})
