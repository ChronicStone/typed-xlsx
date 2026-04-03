export default defineNuxtConfig({
  extends: ["./layer"],
  modules: ["motion-v/nuxt"],
  vue: {
    runtimeCompiler: true,
  },
});
