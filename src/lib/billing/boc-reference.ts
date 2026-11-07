import {z} from 'zod';
import {rateUnits,roundHalfUp} from './fx';
export const bocUrl='https://www.bankofcanada.ca/valet/observations/FXCNYCAD/json?recent=1';
export function parseBocReference(input:unknown,now=new Date()){
 const parsed=z.object({observations:z.array(z.object({d:z.iso.date(),FXCNYCAD:z.object({v:z.string().regex(/^\d{1,6}(\.\d{1,8})?$/)})})).length(1)}).parse(input);
 const observation=parsed.observations[0];const date=new Date(observation.d+'T00:00:00Z');
 const age=(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())-date.getTime())/86400000;
 if(age<0||age>7)throw new Error('Stale or future reference');
 const units=roundHalfUp(10000000000000000n,rateUnits(observation.FXCNYCAD.v));
 const rate=`${units/100000000n}.${(units%100000000n).toString().padStart(8,'0')}`;
 rateUnits(rate);
 return {rate,date:observation.d,source:'Bank of Canada',series:'FXCNYCAD',originalCnyCad:observation.FXCNYCAD.v,fetchedAt:now.toISOString()};
}
