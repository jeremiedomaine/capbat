/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  outputFileTracingIncludes: {
    "/api/invoices/[id]/pdf": ["./public/fonts/**/*", "./public/logo-domaine.png"],
  },
}

export default nextConfig
