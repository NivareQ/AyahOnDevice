import EN from './locales/en.js';
import BN from './locales/bn.js';
const CATALOGS={en:EN,bn:BN};
let locale='en';
export function setLocale(next){locale=CATALOGS[next]?next:'en';document.documentElement.lang=locale;document.documentElement.dataset.uiLanguage=locale;return locale;}
export function getLocale(){return locale;}
export function t(key,params={}){let s=CATALOGS[locale]?.[key]??CATALOGS.en[key]??key;for(const [k,v] of Object.entries(params))s=s.replaceAll(`{${k}}`,String(v));return s;}
export function applyI18n(root=document){
  root.querySelectorAll('[data-i18n]').forEach(el=>{const key=el.dataset.i18n;if(key)el.textContent=t(key);});
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{const key=el.dataset.i18nPlaceholder;if(key)el.setAttribute('placeholder',t(key));});
  root.querySelectorAll('[data-i18n-aria]').forEach(el=>{const key=el.dataset.i18nAria;if(key)el.setAttribute('aria-label',t(key));});
  root.querySelectorAll('[data-i18n-title]').forEach(el=>{const key=el.dataset.i18nTitle;if(key)el.setAttribute('title',t(key));});
  document.documentElement.classList.remove('i18n-pending');
}
