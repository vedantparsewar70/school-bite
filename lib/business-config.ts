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
  tradeNames: string[];
  registeredBusinessNames: string;
  proprietorName: string;
  schoolName: string;
  tagline: string;
  shortDescription: string;
  websiteUrl: string;
  supportEmail: string;
  supportPhone: string;
  supportPhoneRaw: string;
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
  // Verified business names: 'BRIGHT CATERING', 'BRIGHT DESIGNERS', 'NEW BRIGHT XEROX'
  legalEntityName: 'BRIGHT CATERING',
  tradeNames: ['BRIGHT CATERING', 'BRIGHT DESIGNERS', 'NEW BRIGHT XEROX'],
  registeredBusinessNames: 'BRIGHT CATERING / BRIGHT DESIGNERS / NEW BRIGHT XEROX',

  // Registered legal proprietor name matching Cashfree Payments KYC
  proprietorName: 'GANESH GOPAL UDAS',

  // Operating school
  schoolName: 'S.B. Patil School',

  // Accurate service description
  tagline: 'School Meal Pre-Ordering Platform',
  shortDescription:
    'School-Bite is an online school meal pre-ordering platform operated by BRIGHT CATERING (Registered Business/Trade Names: BRIGHT DESIGNERS / NEW BRIGHT XEROX / BRIGHT CATERING; Proprietor: GANESH GOPAL UDAS) that allows parents to select nutritious meals for their children attending S.B. Patil School and make online payments securely. Meals are prepared and provided directly by the S.B. Patil School canteen.',

  // Website URL matching Cashfree application review URL
  websiteUrl: 'https://school-bite.vercel.app',

  // Customer support contact details matching Cashfree KYC
  supportEmail: 'gayatriparsewar@gmail.com',
  supportPhone: '+91 99220 28988',
  supportPhoneRaw: '9922028988',
  whatsAppSupport: 'Available',
  supportAvailability: 'Monday to Sunday, 08:00 AM – 06:00 PM IST',

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
  return `${BUSINESS_CONFIG.legalEntityName} / BRIGHT DESIGNERS / NEW BRIGHT XEROX (Proprietor: ${BUSINESS_CONFIG.proprietorName})`;
}
