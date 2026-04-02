export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    'nuxt-auth-utils',
    '@nuxtjs/i18n'
  ],

  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  compatibilityDate: '2025-01-15',

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    siteUrl: process.env.SITE_URL || 'http://localhost:3000',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripePriceBusinessId: process.env.STRIPE_PRICE_BUSINESS_ID,
    stripePriceFreelanceId: process.env.STRIPE_PRICE_FREELANCE_ID,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    carDetailsUkKey: process.env.CAR_DETAILS_UK_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    public: {
      stripePublicKey: process.env.STRIPE_PUBLIC_KEY,
      siteUrl: process.env.SITE_URL || 'http://localhost:3000',
      carDetailsNl: process.env.CAR_DETAILS_NL || 'https://opendata.rdw.nl/resource/m9d7-ebf2.json',
      carDetailsUk: process.env.CAR_DETAILS_UK || 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles'
    }
  },

  i18n: {
    locales: [
      { code: 'en', file: 'en.json', name: 'English' },
      { code: 'nl', file: 'nl.json', name: 'Nederlands' },
      { code: 'ro', file: 'ro.json', name: 'Română' },
      { code: 'pl', file: 'pl.json', name: 'Polski' },
      { code: 'hu', file: 'hu.json', name: 'Magyar' },
      { code: 'de', file: 'de.json', name: 'Deutsch' },
      { code: 'bg', file: 'bg.json', name: 'Български' },
      { code: 'tr', file: 'tr.json', name: 'Türkçe' },
      { code: 'fr', file: 'fr.json', name: 'Français' }
    ],
    defaultLocale: 'en',
    strategy: 'no_prefix',
    langDir: '../app/locales/',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      fallbackLocale: 'en'
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
