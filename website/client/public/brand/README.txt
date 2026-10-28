DISHKY BRAND IMAGES
===================
  logo-mark.png       fork + D icon      header, footer, preloader, example posts
  logo-mark-dark.png  same mark, white fork + D   header/footer on DARK backgrounds
  logo-wordmark-dark.png  wordmark, white + red     header/footer on DARK backgrounds
  logo-wordmark.png   "DishKy" wordmark  header on LIGHT backgrounds only

On a dark background the black letters would be invisible, so the *-dark.png
versions (white fork/letters) are used there.
Overwrite these files with yours using the SAME names, or change the paths in
src/config/brand.js. The logo red is recoloured to the site red (#f33716)
with the CSS filter in brand.filter (set it to "none" to use the original).
Sizing is by height: change h-* on <BrandLockup> in Navbar.js / Footer.js.
