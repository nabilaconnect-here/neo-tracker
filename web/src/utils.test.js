import { describe, it, expect } from 'vitest'
import { riskBand, fmt, bandColor } from './utils'
describe('utils',()=>{
  it('classifies risk bands',()=>{ expect(riskBand(10)).toBe('low'); expect(riskBand(40)).toBe('med'); expect(riskBand(70)).toBe('high') })
  it('formats numbers',()=>{ expect(fmt(1000)).toBe('1,000'); expect(fmt(null)).toBe('—') })
  it('maps colors',()=>{ expect(bandColor('low')).toMatch(/#/); expect(bandColor('med')).toMatch(/#/); expect(bandColor('high')).toMatch(/#/) })
})
