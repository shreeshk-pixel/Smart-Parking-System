// jspdf is loaded from node_modules at runtime (not bundled), which is what its Node build expects.
const nextConfig = {
  experimental: { serverComponentsExternalPackages: ["jspdf", "jspdf-autotable"] },
};
export default nextConfig;
