Redesign of every page except the landing page. Built from the original DISHKY-PRODUCT-v4 upload.
Unzip over website/client (same paths). Palette: brand red #f33716, white, black only.

Changed : src/App.js (wraps each page except Home in a skin), src/main.js (imports skins.css),
          src/pages/ModulePage.js, src/components/Modules/ModuleTitle.js
New     : src/styles/skins.css (17 design skins), src/components/ui/PaletteGuard.js,
          src/components/Modules/PageFrames.js (9 page structures), PageHeroes.js (8 heroes), PageBlocks.js (18 sections),
          src/data/moduleRecipes.js (per-module: frame, skin, hero, title animation, sections)
Home.js and all shared components are untouched.
