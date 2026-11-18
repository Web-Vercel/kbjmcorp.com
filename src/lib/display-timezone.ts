/** Display label only; stored timezone identifiers remain unchanged. */
export function displayTimezone(value:string|null|undefined,zh:boolean){
 return value==='UTC'?(zh?'协调世界时（全球统一计时）':'Coordinated Universal Time'):value||'';
}
