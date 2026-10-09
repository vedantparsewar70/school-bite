/**
 * School-Bite - Business Details & Compliance Configuration
 * 
 * Verified public-facing business and operational details for School-Bite:
 * - Brand: School-Bite
 * - School: S.B. Patil School (Ravet, Pune)
 * - Service: School meal pre-ordering platform for parents and students
 * - Food fulfilment: Prepared and provided by S.B. Patil School canteen
 */

export interface BusinessConfig {
  brandName: string;
  legalEntityName: string;
  proprietorName: string;
  schoolName: string;
  tagline: string;
  shortDescription: string;
  websiteUrl: string;
  supportEmail: string;
  supportPhone: string;
  whatsAppSupport: string;
  supportAvailability: string;
  businessAddress: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  cancellationCutoffTime: string;
  refundProcessingDays: string;
  paymentGatewayPartner: string;
}

export const BUSINESS_CONFIG: BusinessConfig = {
  // Brand identity shown across the portal
  brandName: 'School-Bite',

  // Registered legal business entity name matching Cashfree Payments KYC
  // Options verified with Cashfree: 'BRIGHT CATERING' / 'BRIGHT DESIGNERS' / 'NEW BRIGHT XEROX'
  legalEntityName: 'BRIGHT CATERING',

  // Registered legal proprietor name matching Cashfree Payments KYC
  proprietorName: 'GANESH GOPAL UDAS',

  // Operating school
  schoolName: 'S.B. Patil School',

  // Accurate service description
  tagline: 'School Meal Pre-Ordering Platform',
  shortDescription:
    'School-Bite is a school meal pre-ordering platform operated by BRIGHT CATERING that allows parents to select meals for their child and make online payments through the website. Meals are prepared and provided by the S.B. Patil School canteen.',

  // Website URL
  websiteUrl: 'https://schoolbite.in',

  // Customer support contact details matching Cashfree KYC
  // Registered KYC email: 'gayatriparsewar@gmail.com' (Alternative: 'vedantparsewar70@gmail.com')
  supportEmail: 'gayatriparsewar@gmail.com',
  // Registered KYC phone: '+91 99220 28988' (Alternative: '+91 90289 77988')
  supportPhone: '+91 99220 28988',
  whatsAppSupport: 'Available',
  supportAvailability: 'Monday to Sunday',

  // Public Operating Address: Operating location of S.B. Patil School & canteen
  businessAddress: {
    line1: 'S.B. Patil School',
    line2: 'Ravet',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '412101',
    country: 'India',
  },

  // Operational cutoff and policy parameters
  cancellationCutoffTime: '08:30 AM on meal date',
  refundProcessingDays: '5 to 7 business days',
  paymentGatewayPartner: 'Cashfree Payments',
};

/**
 * Returns formatted physical address string for S.B. Patil School
 */
export function getFormattedAddress(): string {
  const { line1, line2, city, state, pincode, country } = BUSINESS_CONFIG.businessAddress;
  return `${line1}, ${line2 ? line2 + ', ' : ''}${city}, ${state} - ${pincode}, ${country}`;
}

/**
 * Returns formatted legal entity string for compliance notices
 */
export function getLegalOperatorString(): string {
  if (BUSINESS_CONFIG.proprietorName && BUSINESS_CONFIG.legalEntityName) {
    return `${BUSINESS_CONFIG.legalEntityName} (Proprietor: ${BUSINESS_CONFIG.proprietorName})`;
  }
  return BUSINESS_CONFIG.legalEntityName || BUSINESS_CONFIG.brandName;
}
