const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";

const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["*.monkeycode-ai.live"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
