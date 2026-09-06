import type { MetadataRoute } from "next"
export default function manifest(): MetadataRoute.Manifest { return { name: "Troy Team", short_name: "Troy Team", description: "Training with Coach Ahmed Aly", start_url: "/", display: "standalone", background_color: "#1f2020", theme_color: "#c9a94d", icons: [{ src: "/minilogo-removebg-preview.png", sizes: "512x512", type: "image/png" }] } }
