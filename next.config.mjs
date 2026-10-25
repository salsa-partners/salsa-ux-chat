/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  serverExternalPackages: ["playwright-core", "@browserbasehq/sdk", "exceljs"],
  // playwright-core lee archivos propios (browsers.json) que el rastreo automático de Vercel no incluye:
  // sin esto, cualquier ruta que lo cargue falla con "Cannot find module .../browsers.json".
  outputFileTracingIncludes: {
    "/api/chat": ["./node_modules/playwright-core/**/*"],
    "/api/admin": ["./node_modules/playwright-core/**/*"],
  },
};
