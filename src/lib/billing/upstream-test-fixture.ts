// A plainly fictional PDF, never a bank receipt. Shared bytes for download and SHA-256.
export const upstreamTestPrefix='TEST-UPSTREAM-';
export const upstreamTestNotice='FICTIONAL TEST ONLY - NO BANK TRANSFER';
export function upstreamTestPdf(reference:string,date:string,amount:string):string {
 const lines=['FICTIONAL TEST ONLY','NO BANK TRANSFER / NOT PROOF OF PAYMENT',`Reference: ${reference}`,`Simulated receipt date: ${date}`,`Simulated allocation: CAD ${amount}`,'For the dedicated fictional acceptance company only.'];
 const stream='BT /F1 14 Tf 50 760 Td '+lines.map((s,i)=>(i?'0 -30 Td ':'')+`(${s.replace(/[()\\]/g,'\\$&')}) Tj`).join('\n')+' ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
 let pdf='%PDF-1.4\n';const offsets=[0];objects.forEach((s,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${s}\nendobj\n`;});const xref=pdf.length;pdf+=`xref\n0 6\n0000000000 65535 f \n`+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return pdf;
}
