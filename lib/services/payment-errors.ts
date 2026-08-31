/**
 * Hybrid payment error handling module.
 *
 * Translates raw Stripe decline codes and error types into clean, user-facing
 * messages while filtering out any technical information that should not reach
 * the customer. Each entry carries:
 *  - category : internal classification used for analytics / logging
 *  - title    : short, visible heading in the UI
 *  - message  : actionable sentence for the customer
 *  - suggestion : what the customer should try next
 */

export type PaymentErrorCategory =
  | "CARD_DECLINED"
  | "EXPIRED_CARD"
  | "INVALID_CVC"
  | "INSUFFICIENT_FUNDS"
  | "FRAUD_BLOCKED"
  | "AUTHENTICATION_REQUIRED"
  | "CARD_VELOCITY"
  | "INVALID_CARD"
  | "BANK_ERROR"
  | "SYSTEM_ERROR";

export type PaymentErrorInfo = {
  category: PaymentErrorCategory;
  title: string;
  message: string;
  suggestion: string;
  /** Whether this error is recoverable by the user (i.e. can try again) */
  recoverable: boolean;
};

/** Stripe decline_code → human-readable info */
const DECLINE_CODE_MAP: Record<string, PaymentErrorInfo> = {
  insufficient_funds: {
    category: "INSUFFICIENT_FUNDS",
    title: "Insufficient Funds",
    message: "Your card has insufficient funds to complete this payment.",
    suggestion: "Please use a different card or try Cash on Delivery.",
    recoverable: true,
  },
  card_declined: {
    category: "CARD_DECLINED",
    title: "Card Declined",
    message: "Your card was declined by your bank.",
    suggestion: "Please contact your bank or use a different payment method.",
    recoverable: true,
  },
  expired_card: {
    category: "EXPIRED_CARD",
    title: "Card Expired",
    message: "Your card has expired.",
    suggestion: "Please use a card with a valid expiry date.",
    recoverable: true,
  },
  incorrect_cvc: {
    category: "INVALID_CVC",
    title: "Incorrect Security Code",
    message: "The security code (CVC/CVV) you entered is incorrect.",
    suggestion: "Please check the 3-digit code on the back of your card and try again.",
    recoverable: true,
  },
  incorrect_zip: {
    category: "INVALID_CARD",
    title: "Incorrect Billing Postcode",
    message: "The postcode/ZIP you entered does not match your card's billing address.",
    suggestion: "Please check your billing postcode and try again.",
    recoverable: true,
  },
  incorrect_number: {
    category: "INVALID_CARD",
    title: "Incorrect Card Number",
    message: "The card number you entered is incorrect.",
    suggestion: "Please double-check your card number and try again.",
    recoverable: true,
  },
  invalid_cvc: {
    category: "INVALID_CVC",
    title: "Invalid Security Code",
    message: "The security code you entered is not valid.",
    suggestion: "Please check the CVC/CVV on your card and try again.",
    recoverable: true,
  },
  invalid_expiry_month: {
    category: "INVALID_CARD",
    title: "Invalid Expiry Month",
    message: "The expiry month on your card is invalid.",
    suggestion: "Please check your card details and try again.",
    recoverable: true,
  },
  invalid_expiry_year: {
    category: "INVALID_CARD",
    title: "Invalid Expiry Year",
    message: "The expiry year on your card is invalid.",
    suggestion: "Please check your card details and try again.",
    recoverable: true,
  },
  invalid_number: {
    category: "INVALID_CARD",
    title: "Invalid Card Number",
    message: "Your card number is not valid.",
    suggestion: "Please check your card number and try again.",
    recoverable: true,
  },
  do_not_honor: {
    category: "CARD_DECLINED",
    title: "Card Declined",
    message: "Your bank declined the transaction.",
    suggestion: "Please contact your bank or try a different card.",
    recoverable: true,
  },
  do_not_try_again: {
    category: "FRAUD_BLOCKED",
    title: "Payment Not Authorized",
    message: "Your bank has blocked this transaction and requested you not retry.",
    suggestion: "Please contact your bank directly or use a different payment method.",
    recoverable: false,
  },
  fraudulent: {
    category: "FRAUD_BLOCKED",
    title: "Transaction Blocked",
    message: "This transaction was flagged and blocked for security reasons.",
    suggestion: "Please use a different payment method or contact support.",
    recoverable: false,
  },
  lost_card: {
    category: "FRAUD_BLOCKED",
    title: "Card Reported Lost",
    message: "Your card has been reported as lost and cannot be used.",
    suggestion: "Please use a different card or contact your bank.",
    recoverable: false,
  },
  stolen_card: {
    category: "FRAUD_BLOCKED",
    title: "Card Reported Stolen",
    message: "Your card has been reported as stolen and cannot be used.",
    suggestion: "Please use a different card or contact your bank.",
    recoverable: false,
  },
  pickup_card: {
    category: "FRAUD_BLOCKED",
    title: "Card Cannot Be Used",
    message: "Your bank has flagged this card and it cannot be used.",
    suggestion: "Please contact your bank or use a different payment method.",
    recoverable: false,
  },
  restricted_card: {
    category: "CARD_DECLINED",
    title: "Card Restricted",
    message: "Your card is restricted and cannot be used for this transaction.",
    suggestion: "Please contact your bank to lift the restriction or use a different card.",
    recoverable: true,
  },
  card_velocity_exceeded: {
    category: "CARD_VELOCITY",
    title: "Too Many Attempts",
    message: "Your card has been declined due to too many recent transaction attempts.",
    suggestion: "Please wait a while before trying again or use a different payment method.",
    recoverable: true,
  },
  transaction_not_allowed: {
    category: "CARD_DECLINED",
    title: "Transaction Not Allowed",
    message: "Your bank does not allow this type of transaction.",
    suggestion: "Please contact your bank or try a different card.",
    recoverable: true,
  },
  currency_not_supported: {
    category: "CARD_DECLINED",
    title: "Currency Not Supported",
    message: "Your card does not support the currency used for this transaction.",
    suggestion: "Please use a card that supports this currency.",
    recoverable: true,
  },
  authentication_required: {
    category: "AUTHENTICATION_REQUIRED",
    title: "Authentication Required",
    message: "Your bank requires additional authentication to complete this payment.",
    suggestion: "Please complete the authentication request from your bank.",
    recoverable: true,
  },
  processing_error: {
    category: "BANK_ERROR",
    title: "Bank Processing Error",
    message: "Your bank encountered an error processing this transaction.",
    suggestion: "Please try again in a moment or contact your bank.",
    recoverable: true,
  },
  issuer_not_available: {
    category: "BANK_ERROR",
    title: "Bank Unavailable",
    message: "Your bank is currently unavailable.",
    suggestion: "Please try again later or use a different payment method.",
    recoverable: true,
  },
  reenter_transaction: {
    category: "BANK_ERROR",
    title: "Please Re-enter Card Details",
    message: "Your bank requests that this transaction be re-entered.",
    suggestion: "Please re-enter your card details and try again.",
    recoverable: true,
  },
  try_again_later: {
    category: "BANK_ERROR",
    title: "Temporary Bank Error",
    message: "Your bank is temporarily unavailable.",
    suggestion: "Please try again in a few minutes.",
    recoverable: true,
  },
};

/** Stripe error.code → info (for cases where decline_code isn't set) */
const ERROR_CODE_MAP: Record<string, PaymentErrorInfo> = {
  card_declined: {
    category: "CARD_DECLINED",
    title: "Card Declined",
    message: "Your card was declined.",
    suggestion: "Please try a different card or use Cash on Delivery.",
    recoverable: true,
  },
  expired_card: {
    category: "EXPIRED_CARD",
    title: "Card Expired",
    message: "Your card has expired.",
    suggestion: "Please use a card with a valid expiry date.",
    recoverable: true,
  },
  incorrect_cvc: {
    category: "INVALID_CVC",
    title: "Incorrect Security Code",
    message: "The CVC/CVV you entered is incorrect.",
    suggestion: "Please check the code on the back of your card.",
    recoverable: true,
  },
  payment_method_not_available: {
    category: "SYSTEM_ERROR",
    title: "Payment Method Unavailable",
    message: "This payment method is currently unavailable.",
    suggestion: "Please try a different payment method.",
    recoverable: true,
  },
};

const FALLBACK_ERROR: PaymentErrorInfo = {
  category: "SYSTEM_ERROR",
  title: "Payment Failed",
  message: "Your payment could not be processed at this time.",
  suggestion:
    "Please try again or use a different payment method. If the issue persists, contact support.",
  recoverable: true,
};

/**
 * Convert a Stripe error (or any unknown error) into a safe, user-friendly
 * PaymentErrorInfo object. Never leaks raw error messages to the client.
 */
export function mapStripeError(err: unknown): PaymentErrorInfo {
  if (!err || typeof err !== "object") return FALLBACK_ERROR;

  const e = err as {
    type?: string;
    code?: string;
    decline_code?: string;
    message?: string;
  };

  // Priority 1: decline_code (most specific)
  if (e.decline_code && DECLINE_CODE_MAP[e.decline_code]) {
    return DECLINE_CODE_MAP[e.decline_code];
  }

  // Priority 2: error code
  if (e.code && ERROR_CODE_MAP[e.code]) {
    return ERROR_CODE_MAP[e.code];
  }

  // Priority 3: error type fallbacks
  if (e.type === "StripeCardError") {
    return {
      category: "CARD_DECLINED",
      title: "Card Declined",
      message: "Your card was declined.",
      suggestion: "Please check your card details or use a different payment method.",
      recoverable: true,
    };
  }

  if (e.type === "StripeRateLimitError") {
    return {
      category: "SYSTEM_ERROR",
      title: "Too Many Requests",
      message: "We are experiencing high traffic. Please try again shortly.",
      suggestion: "Wait a moment and try again.",
      recoverable: true,
    };
  }

  if (e.type === "StripeConnectionError" || e.type === "StripeAPIError") {
    return {
      category: "SYSTEM_ERROR",
      title: "Service Temporarily Unavailable",
      message: "Our payment service is temporarily unavailable.",
      suggestion: "Please try again in a moment or use Cash on Delivery.",
      recoverable: true,
    };
  }

  return FALLBACK_ERROR;
}

/**
 * Map a Stripe PaymentIntent's last_payment_error to a PaymentErrorInfo.
 */
export function mapPaymentIntentError(paymentIntent: {
  last_payment_error?: {
    decline_code?: string | null;
    code?: string | null;
    type?: string;
  } | null;
}): PaymentErrorInfo {
  const e = paymentIntent.last_payment_error;
  if (!e) return FALLBACK_ERROR;

  if (e.decline_code && DECLINE_CODE_MAP[e.decline_code]) {
    return DECLINE_CODE_MAP[e.decline_code];
  }
  if (e.code && ERROR_CODE_MAP[e.code]) {
    return ERROR_CODE_MAP[e.code];
  }

  return FALLBACK_ERROR;
}
