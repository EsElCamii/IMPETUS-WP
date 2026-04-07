(function (root, factory) {
  const seo = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = seo;
  }

  root.SiteSEO = seo;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const baseUrl = "https://impetus-wp.vercel.app";
  const normalizedBaseUrl = String(baseUrl).replace(/\/+$/, "");
  const siteName = "IMPETUS Casa Tostadora de Cafe";
  const defaultTitle =
    "Cafe de especialidad en Veracruz | IMPETUS Casa Tostadora de Cafe";
  const defaultDescription =
    "Compra cafe de especialidad tostado en el Heroico Puerto de Veracruz. IMPETUS reune lotes de Ixhuatlan, Chocaman, Totutla, Cosautlan y Zongolica para filtro y espresso.";
  const socialImagePath = "/images/bg-hero-131.png";
  const logoPath = "/images/image-3-145.png";

  const organization = {
    "@type": "CafeOrCoffeeShop",
    name: siteName,
    alternateName: "IMPETUS",
    url: `${normalizedBaseUrl}/`,
    logo: `${normalizedBaseUrl}${logoPath}`,
    image: `${normalizedBaseUrl}${socialImagePath}`,
    email: "ventas@impetus.mx",
    telephone: "+52 55 2755 6037",
    description: defaultDescription,
    priceRange: "$$",
    servesCuisine: "Coffee",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Fernando de Magallanes 661, Fracc. Reforma",
      addressLocality: "Veracruz",
      addressRegion: "Veracruz",
      postalCode: "91919",
      addressCountry: "MX",
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "sales",
        email: "ventas@impetus.mx",
        telephone: "+52 55 2755 6037",
        areaServed: "MX",
        availableLanguage: ["es", "en"],
      },
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "ventas@impetus.mx",
        telephone: "+52 229 935 9974",
        areaServed: "MX",
        availableLanguage: ["es"],
      },
    ],
  };

  const staticPages = [
    {
      path: "/",
      title: defaultTitle,
      description: defaultDescription,
      changefreq: "weekly",
      priority: "1.0",
    },
    {
      path: "/catalogo.html",
      title: "Catalogo de cafe de especialidad en Veracruz | IMPETUS",
      description:
        "Explora el catalogo de IMPETUS con cafes de especialidad de Veracruz, perfiles para Brew Bar y espresso, y opciones de molienda antes de pagar.",
      changefreq: "weekly",
      priority: "0.9",
    },
    {
      path: "/nosotros.html",
      title: "Nosotros | IMPETUS Casa Tostadora de Cafe en Veracruz",
      description:
        "Conoce IMPETUS, casa tostadora de cafe en el Heroico Puerto de Veracruz, enfocada en origen, comercio directo y lotes de especialidad.",
      changefreq: "monthly",
      priority: "0.8",
    },
    {
      path: "/contacto.html",
      title: "Contacto | IMPETUS Casa Tostadora de Cafe",
      description:
        "Ponte en contacto con IMPETUS para ventas, taller, correo y direccion en Veracruz.",
      changefreq: "monthly",
      priority: "0.7",
    },
    {
      path: "/sucursales.html",
      title: "Sucursales de cafe en Veracruz | IMPETUS",
      description:
        "Ubica las sucursales de IMPETUS en Veracruz y Boca del Rio: Costa de Oro, Reforma, Riviera y Casa Tostadora.",
      changefreq: "monthly",
      priority: "0.7",
    },
  ];

  function absoluteUrl(path) {
    if (!path) {
      return normalizedBaseUrl;
    }

    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    return `${normalizedBaseUrl}/${String(path).replace(/^\/+/, "")}`;
  }

  function pageUrl(path) {
    if (!path || path === "/") {
      return `${normalizedBaseUrl}/`;
    }

    return absoluteUrl(path);
  }

  function productUrl(id) {
    return `${absoluteUrl("product.html")}?id=${encodeURIComponent(id)}`;
  }

  function upsertMeta(attribute, key, content) {
    if (typeof document === "undefined") {
      return null;
    }

    let element = document.head.querySelector(`meta[${attribute}="${key}"]`);

    if (!element) {
      element = document.createElement("meta");
      element.setAttribute(attribute, key);
      document.head.appendChild(element);
    }

    element.setAttribute("content", content);
    return element;
  }

  function setCanonical(url) {
    if (typeof document === "undefined") {
      return null;
    }

    let element = document.head.querySelector('link[rel="canonical"]');

    if (!element) {
      element = document.createElement("link");
      element.setAttribute("rel", "canonical");
      document.head.appendChild(element);
    }

    element.setAttribute("href", url);
    return element;
  }

  function setJsonLd(id, data) {
    if (typeof document === "undefined") {
      return null;
    }

    let element = document.getElementById(id);

    if (!element) {
      element = document.createElement("script");
      element.id = id;
      element.type = "application/ld+json";
      document.head.appendChild(element);
    }

    element.textContent = JSON.stringify(data);
    return element;
  }

  function setPageMeta({
    title,
    description,
    url,
    image,
    type = "website",
    robots = "index,follow,max-image-preview:large",
  }) {
    if (typeof document === "undefined") {
      return;
    }

    const resolvedTitle = title || defaultTitle;
    const resolvedDescription = description || defaultDescription;
    const resolvedUrl = url || `${normalizedBaseUrl}/`;
    const resolvedImage = image || absoluteUrl(socialImagePath);

    document.title = resolvedTitle;
    upsertMeta("name", "description", resolvedDescription);
    upsertMeta("name", "robots", robots);
    upsertMeta("property", "og:locale", "es_MX");
    upsertMeta("property", "og:site_name", siteName);
    upsertMeta("property", "og:type", type);
    upsertMeta("property", "og:title", resolvedTitle);
    upsertMeta("property", "og:description", resolvedDescription);
    upsertMeta("property", "og:url", resolvedUrl);
    upsertMeta("property", "og:image", resolvedImage);
    upsertMeta("property", "og:image:alt", resolvedTitle);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", resolvedTitle);
    upsertMeta("name", "twitter:description", resolvedDescription);
    upsertMeta("name", "twitter:image", resolvedImage);
    setCanonical(resolvedUrl);
  }

  return {
    baseUrl: normalizedBaseUrl,
    defaultTitle,
    defaultDescription,
    socialImage: absoluteUrl(socialImagePath),
    logoUrl: absoluteUrl(logoPath),
    organization,
    staticPages,
    absoluteUrl,
    pageUrl,
    productUrl,
    setPageMeta,
    setJsonLd,
  };
});
