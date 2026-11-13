export function coverageLabel(kind:string|undefined,zh:boolean){
 const labels:Record<string,[string,string]>={complete_rows:['完整每日记录已核对','Complete daily records reconciled'],aggregate_verified:['整月汇总已核对，省略日期为零活动','Monthly totals reconciled; omitted dates have zero activity'],reviewed_activity:['整月活动与无活动日期已独立核实','Monthly activity and inactive dates independently verified'],reviewed_zero:['已独立核实整月零使用','Zero usage independently verified'],not_active:['已独立核实账户尚未启用','Account not active during this month, independently verified']};
 return labels[kind||'']?.[zh?0:1]||(zh?'整月活动覆盖尚待核实':'Monthly activity coverage needs verification');
}
export function dailyOriginLabel(origin:string|undefined,zh:boolean){
 const labels:Record<string,[string,string]>={api:['API 原始记录','Original API row'],aggregate_zero:['整月汇总核实为零','Zero verified by monthly totals'],reviewed_no_activity:['经独立复核无活动','No activity independently reviewed'],not_active:['账户尚未启用','Account not active']};
 return labels[origin||'api']?.[zh?0:1]||(zh?'来源待核实':'Source unverified');
}
