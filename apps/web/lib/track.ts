/**
 * Client-side analytics event tracking helper.
 * Wraps GA4 gtag() and Meta Pixel fbq() calls.
 */

type EventParams = Record<string, string | number | boolean | undefined>;

declare global {
    interface Window {
        gtag?: (...args: unknown[]) => void;
        fbq?: (...args: unknown[]) => void;
    }
}

/**
 * Track a custom event in GA4 and optionally Meta Pixel.
 *
 * Supported events:
 * - landing_cta_click
 * - lead_submit
 * - signup_started
 * - signup_completed
 * - first_client_created
 * - first_matter_created
 */
export function trackEvent(name: string, params?: EventParams) {
    // GA4
    if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', name, params);
    }

    // Meta Pixel — map to standard events where reasonable
    if (typeof window !== 'undefined' && window.fbq) {
        if (name === 'lead_submit') {
            window.fbq('track', 'Lead', params);
        } else if (name === 'signup_completed') {
            window.fbq('track', 'CompleteRegistration', params);
        } else {
            window.fbq('trackCustom', name, params);
        }
    }
}
