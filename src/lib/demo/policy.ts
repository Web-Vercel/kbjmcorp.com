// Demo capabilities never include real business or administration rights.
export const demoCookie='zhidian_demo_session';
export const trainingTracks=['sales','ad_operations','finance_preparer','finance_reviewer'] as const;
export type TrainingTrack=typeof trainingTracks[number];
export const demoCapabilities={
 investor:{read:true,editFictional:false,switchReadOnlyViews:true,training:false,realBusiness:false,manageAccess:false},
 client:{read:true,editFictional:true,switchReadOnlyViews:false,training:false,realBusiness:false,manageAccess:false},
 training:{read:true,editFictional:true,switchReadOnlyViews:false,training:true,realBusiness:false,manageAccess:false},
 // Compatibility for already-issued sales demo invitations.
 sales:{read:true,editFictional:true,switchReadOnlyViews:false,training:true,realBusiness:false,manageAccess:false},
} as const;
