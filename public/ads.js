// ads.js — banner de AdMob en la app de Android/iOS (plugin @capacitor-community/admob).
// En la web no hace nada. Incluye el formulario de consentimiento obligatorio en la UE (RGPD)
// y, en iPhone, la petición de permiso de seguimiento (ATT).

// Bloques de anuncio de PRUEBA publicados por Google: úsalos mientras desarrollas.
const TEST_BANNERS = {
  android: 'ca-app-pub-3940256099942544/6300978111',
  ios: 'ca-app-pub-3940256099942544/2934735716',
};

export async function initAds(cfg = {}) {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.()) return;
  const platform = cap.getPlatform(); // 'android' | 'ios'
  const adId = cfg.testing ? TEST_BANNERS[platform] : cfg[platform]?.banner;
  if (!adId) return;

  const AdMob = cap.Plugins?.AdMob || cap.registerPlugin?.('AdMob');
  if (!AdMob) { console.warn('Plugin AdMob no instalado'); return; }

  try {
    await AdMob.initialize({ initializeForTesting: !!cfg.testing });

    if (platform === 'ios') {
      const t = await AdMob.trackingAuthorizationStatus();
      if (t.status === 'notDetermined') await AdMob.requestTrackingAuthorization();
    }

    // Consentimiento RGPD (Google UMP). Se configura en AdMob > Privacidad y mensajes.
    const consent = await AdMob.requestConsentInfo();
    if (consent.isConsentFormAvailable && consent.status === 'REQUIRED') await AdMob.showConsentForm();

    AdMob.addListener('bannerAdSizeChanged', (size) => {
      document.documentElement.style.setProperty('--ad-h', `${Math.round(size?.height || 0)}px`);
    });
    await AdMob.showBanner({
      adId,
      adSize: 'ADAPTIVE_BANNER',
      position: 'BOTTOM_CENTER',
      margin: 0,
      isTesting: !!cfg.testing,
    });
  } catch (err) {
    console.warn('No se pudieron cargar los anuncios:', err);
  }
}
