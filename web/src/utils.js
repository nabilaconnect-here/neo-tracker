export function fmt(n,max=0){ return n==null||Number.isNaN(n)?'—':Number(n).toLocaleString(undefined,{maximumFractionDigits:max}) }
export function riskBand(score){ if(typeof score!=='number') return 'low'; if(score>=70) return 'high'; if(score>=40) return 'med'; return 'low' }
export function bandColor(b){ return b==='high'?'#ef4444':(b==='med'?'#f59e0b':'#10b981') }
