// Every file in this folder named <module-slug>.js is that module's own, fully bespoke page.
// It is picked up automatically and loaded on demand.
const files = import.meta.glob("./*.js");
const registry = {};
Object.keys(files).forEach((k) => {
  const slug = k.replace("./", "").replace(".js", "");
  if (slug !== "index") registry[slug] = files[k];
});
export default registry;
