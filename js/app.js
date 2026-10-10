/* Shared runtime context: data (state), screen state (ui) and device environment (env). */
export const app = {
  state: null,
  ui: {tab: 'pantry', onboardingStep: 0, sheet: null, sheetMore: false, search: '', showGone: false, recipeId: null, persons: 2, recipeForm: false, draft: null, recipeFilters: [], recipeSearch: '', pasteText: '', showShopDone: false, shopPick: null,
    receiptText: '', receipt: null, receiptEdit: null, receiptDuplicate: null, receiptBusy: false, receiptHow: false, confirm: null, pendingImport: null},
  env: {
    persisted: null,
    standalone: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
    installEvent: null,
    registration: null,
    isIOS: /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  },
};
export const $ = s => document.querySelector(s);
