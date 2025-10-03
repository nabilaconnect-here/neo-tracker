import '@testing-library/jest-dom/vitest'

// Polyfill ResizeObserver for Recharts' ResponsiveContainer
import { ResizeObserver as RO } from '@juggle/resize-observer'
global.ResizeObserver = RO

// 3) Smooth over any RAF use from chart libs
if (!global.requestAnimationFrame) {
    global.requestAnimationFrame = (cb) => setTimeout(cb, 0)
}