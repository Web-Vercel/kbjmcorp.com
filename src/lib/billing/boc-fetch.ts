import 'server-only';
import {bocUrl,parseBocReference} from './boc-reference';
export async function fetchBocReference(){
 const response=await fetch(bocUrl,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
 if(!response.ok||!response.body)throw new Error('Reference unavailable');
 const reader=response.body.getReader();const chunks:Uint8Array[]=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>65536)throw new Error('Response too large');chunks.push(value);}}finally{await reader.cancel();}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return parseBocReference(JSON.parse(new TextDecoder().decode(bytes)));
}
