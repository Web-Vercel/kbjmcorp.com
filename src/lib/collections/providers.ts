// Later-stage adapter contracts only. No configured provider and no real network/payment action.
export type VerifiedIncomingTransfer={providerEventId:string;collectionAccountId:string;bankReference:string;amountMinor:string;currency:'CNY';bookedDate:string;evidenceReference:string};
export interface BankStatementProvider {readIncoming(cursor?:string):Promise<{transfers:VerifiedIncomingTransfer[];nextCursor?:string}>;}
export interface OnlineCollectionProvider {
 createPayment(input:{orderId:string;amountMinor:string;currency:'CNY';collectionAccountId:string}):Promise<{providerOrderId:string;checkoutUrl:string}>;
 verifyNotification(rawBody:Uint8Array,headers:Headers):Promise<{eventId:string;providerOrderId:string;status:'settled'|'failed'|'refunded';amountMinor:string;currency:'CNY'}>;
}
export const collectionRollout={manualBankReceipt:'implemented',bankMatching:'suggestions_only',onlinePayment:'not_connected',refundTransfer:'not_connected'} as const;
