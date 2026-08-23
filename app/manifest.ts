import type { MetadataRoute } from "next"
export default function manifest(): MetadataRoute.Manifest { return { name: "Coach Ahmed Aly Training", short_name: "Coach Ahmed", description: "Athlete training and performance tracking", start_url: "/", display: "standalone", background_color: "#1f2020", theme_color: "#c9a94d", icons: [{ src: "/logo-dark.jpg", sizes: "512x512", type: "image/jpeg" }] } }
