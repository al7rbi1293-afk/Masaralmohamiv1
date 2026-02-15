/**
 * UTM parameter capture and storage utilities.
 * Reads UTM params from URL and persists in localStorage.
 */

const UTM_STORAGE_KEY = 'masar_utm';

type UtmParams = {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
};

/**
 * Capture UTM params from the current URL and store in localStorage.
 * Call this on marketing pages (e.g., in a useEffect).
 */
export function captureUtm() {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const source = url.searchParams.get('utm_source');
    const medium = url.searchParams.get('utm_medium');
    const campaign = url.searchParams.get('utm_campaign');
    const term = url.searchParams.get('utm_term');
    const content = url.searchParams.get('utm_content');

    // Only store if at least utm_source is present
    if (!source) return;

    const utm: UtmParams = {
        source: source || undefined,
        medium: medium || undefined,
        campaign: campaign || undefined,
        term: term || undefined,
        content: content || undefined,
    };

    try {
        localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
    } catch {
        // localStorage not available
    }
}

/**
 * Get stored UTM params from localStorage.
 * Returns null if none stored.
 */
export function getStoredUtm(): UtmParams | null {
    if (typeof window === 'undefined') return null;

    try {
        const raw = localStorage.getItem(UTM_STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as UtmParams;
    } catch {
        return null;
    }
}

/**
 * Clear stored UTM params (e.g., after successful conversion).
 */
export function clearStoredUtm() {
    if (typeof window === 'undefined') return;

    try {
        localStorage.removeItem(UTM_STORAGE_KEY);
    } catch {
        // localStorage not available
    }
}
