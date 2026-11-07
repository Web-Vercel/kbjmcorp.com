import {staffReadiness} from './lib/staff-readiness.mjs';
const report=staffReadiness(process.env);
console.log(JSON.stringify(report,null,2));
console.log('Local configuration metadata only. No passwords, keys, Auth attempts, SMS, or business writes were sent. Configured does not mean hosted verification passed.');
if(!report.staff_config_ready)process.exitCode=1;
