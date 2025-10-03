const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export function riskScore({diameterFt,speedMph,distanceMiles}){
  if(diameterFt==null||speedMph==null||distanceMiles==null) return 0;
  const size=clamp(diameterFt/2000,0,1);
  const speed=clamp(speedMph/60000,0,1);
  const proximity=clamp(10000000/(distanceMiles+1),0,1);
  return Math.round((size*0.4+speed*0.25+proximity*0.35)*100);
}
