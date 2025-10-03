import { render, screen } from '@testing-library/react'
import React from 'react'
import App from './App'
vi.mock('./api',()=>({ getNeos: async ()=>({ date:'2025-10-02', items:[ {id:'1',name:'A',diameterFt:1000,speedMph:30000,distanceMiles:1000000,hazardous:false,riskScore:30}, {id:'2',name:'B',diameterFt:1500,speedMph:50000,distanceMiles:500000,hazardous:true,riskScore:75}], fetchedAt:new Date().toISOString() }) }))
it('renders title and rows and risk chips', async ()=>{ render(<App/>); expect(await screen.findByText(/Near‑Earth Object Tracker/)).toBeInTheDocument(); expect(await screen.findByText('A')).toBeInTheDocument(); expect(await screen.findByText('B')).toBeInTheDocument(); expect(screen.getAllByText(/Low/)[0]).toBeInTheDocument(); expect(screen.getAllByText(/High/)[0]).toBeInTheDocument() })
