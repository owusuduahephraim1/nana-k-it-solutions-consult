window.NANAK_CONFIG = {
  apiBaseUrl: "https://nana-k-it-solutions-consult-api.edusentia-enterprise-neon.workers.dev",
  siteUrl: "https://owusuduahephraim1.github.io/nana-k-it-solutions-consult",
  neonAuthUrl: "https://ep-square-mountain-b56mr71c.neonauth.c-7.us-east-2.aws.neon.tech/neondb/auth",
  businessName: "Nana K IT Solutions Consult",
  email: "nduah385@gmail.com",
  phoneDisplay: "+233 24 024 0898",
  phoneHref: "+233240240898",
  whatsappNumber: "233508282330",
  whatsappSecondaryNumber: "233240240898",
  location: "Santeo near Cedar Estate; Koforidua Asokore near Methodist JHS Junction Barrier, Eastern Region, Ghana",
  workingHours: "Monday to Friday, 8:00 AM to 5:00 PM",
  remoteSupportFileUrl: "",
  googleAnalyticsId: "G-XXXXXXXXXX",
  turnstileSiteKey: "0x4AAAAAAFWx04AEskoZCBMj",
  social: {
    facebook: "https://web.facebook.com/syrresa/directory_links",
    linkedin: "https://www.linkedin.com/in/ephraim-owusu-duah-720385335",
    twitter: "",
    instagram: ""
  }
};

(() => {
  const seoScript = document.createElement('script');
  seoScript.src = 'assets/js/seo.js';
  seoScript.defer = true;
  document.head.appendChild(seoScript);

  const turnstileScript = document.createElement('script');
  turnstileScript.src = 'assets/js/turnstile.js';
  turnstileScript.defer = true;
  document.head.appendChild(turnstileScript);
})();
