import * as WebBrowser from 'expo-web-browser';
import { buildPublicWebUrl } from './api';

async function openPublicPage(path: string) {
  return WebBrowser.openBrowserAsync(buildPublicWebUrl(path), {
    dismissButtonStyle: 'close',
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    showTitle: true,
  });
}

export function getPrivacyPolicyUrl() {
  return buildPublicWebUrl('/privacy');
}

export function getTermsUrl() {
  return buildPublicWebUrl('/terms');
}

export function getSupportUrl() {
  return buildPublicWebUrl('/contact');
}

export async function openPrivacyPolicy() {
  return openPublicPage('/privacy');
}

export async function openTermsOfService() {
  return openPublicPage('/terms');
}

export async function openSupportPage() {
  return openPublicPage('/contact');
}
