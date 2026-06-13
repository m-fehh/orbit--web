import createNextIntlPlugin from 'next-intl/plugin';

// i18n sem roteamento por path (a cultura é preferência do usuário, trocável em tela,
// persistida em cookie). O arquivo de request resolve o locale a partir do cookie.
const withNextIntl = createNextIntlPlugin('./src/shared/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Permite consumir a API .NET em dev (https self-signed) sem travar o build.
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'https://localhost:5001/api/v1',
    NEXT_PUBLIC_HUB_URL: process.env.NEXT_PUBLIC_HUB_URL ?? 'https://localhost:5001/hubs/orbit',
  },
};

export default withNextIntl(nextConfig);
