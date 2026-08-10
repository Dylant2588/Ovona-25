import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ovona",
    short_name: "Ovona",
    description: "Your daily nutrition and meal-planning companion.",
    start_url: "/meals",
    display: "standalone",
    background_color: "#0c1020",
    theme_color: "#0c1020",
  };
}
