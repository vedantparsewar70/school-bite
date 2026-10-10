'use client';

export function loadCashfreeSdk(): Promise<any> {
  if (typeof window !== 'undefined' && (window as any).Cashfree) {
    return Promise.resolve((window as any).Cashfree);
  }
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Window not defined'));
    const existingScript = document.querySelector('script[src="https://sdk.cashfree.com/js/v3/cashfree.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve((window as any).Cashfree));
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Cashfree SDK')));
      if ((window as any).Cashfree) return resolve((window as any).Cashfree);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.async = true;
    script.onload = () => {
      if ((window as any).Cashfree) {
        resolve((window as any).Cashfree);
      } else {
        reject(new Error('Cashfree SDK failed to initialize'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Cashfree SDK script'));
    document.body.appendChild(script);
  });
}
