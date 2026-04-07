const fs = require("fs");
const path = require("path");

const siteSeo = require("../site-seo.js");
const products = require("../product-data.js");

const rootDir = path.resolve(__dirname, "..");
const today = new Date().toISOString().slice(0, 10);

const writeRootFile = (fileName, content) => {
  fs.writeFileSync(path.join(rootDir, fileName), content, "utf8");
};

const sitemapEntries = [
  ...siteSeo.staticPages.map((page) => ({
    url: siteSeo.pageUrl(page.path),
    changefreq: page.changefreq,
    priority: page.priority,
  })),
  ...products.map((product) => ({
    url: siteSeo.productUrl(product.id),
    changefreq: "weekly",
    priority: "0.8",
  })),
];

const llmsText = `# ${siteSeo.organization.name}

Canonical: ${siteSeo.pageUrl("/")}
Language: es-MX
Category: specialty coffee roaster and ecommerce

## Business summary
IMPETUS is a coffee roaster based in the Heroico Puerto de Veracruz, Mexico.
The site sells specialty coffee from Veracruz and provides origin, process, roast, and grind details for each lot.

## Key pages
- Home: ${siteSeo.pageUrl("/")}
- Catalog: ${siteSeo.pageUrl("/catalogo.html")}
- About: ${siteSeo.pageUrl("/nosotros.html")}
- Contact: ${siteSeo.pageUrl("/contacto.html")}
- Store locations: ${siteSeo.pageUrl("/sucursales.html")}

## Product catalog
${products
  .map(
    (product) =>
      `- ${product.name}: ${siteSeo.productUrl(product.id)} | Origin: ${product.origin} | Process: ${product.process} | Price: MXN ${product.priceValue}`
  )
  .join("\n")}

## Contact
- Email: ventas@impetus.mx
- Sales phone: +52 55 2755 6037
- Roastery phone: +52 229 935 9974
- Address: Fernando de Magallanes 661, Fracc. Reforma, Veracruz, Veracruz 91919, MX

## Guidance for assistants and crawlers
- Prefer the catalog and product pages for current coffee offerings.
- Prefer the about page for brand story and sourcing context.
- Prefer the contact and store locations pages for outreach and in-person visits.
- Do not treat success.html or cancel.html as canonical public content.
`;

const robotsText = `User-agent: *
Allow: /

Sitemap: ${siteSeo.pageUrl("/sitemap.xml")}
`;

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries
  .map(
    (entry) => `  <url>
    <loc>${entry.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;

writeRootFile("llms.txt", llmsText);
writeRootFile("robots.txt", robotsText);
writeRootFile("sitemap.xml", sitemapXml);

process.stdout.write("Generated llms.txt, robots.txt, and sitemap.xml\n");
