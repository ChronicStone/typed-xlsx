export default defineNuxtPlugin({
  name: "twoslash-popper-ids",
  enforce: "post",
  setup(nuxtApp) {
    let nextId = 0;

    function patchFloatingComponent(name: string) {
      const component = nuxtApp.vueApp.component(name) as
        | {
            components?: {
              Popper?: {
                extends?: {
                  data?: () => Record<string, unknown>;
                  __typedXlsxPatchedIds?: boolean;
                };
              };
            };
          }
        | undefined;

      const popper = component?.components?.Popper?.extends;

      if (!popper || popper.__typedXlsxPatchedIds) {
        return;
      }

      const originalData = popper.data;

      popper.data = function patchedPopperData() {
        const state = (originalData?.call(this) ?? {}) as Record<string, unknown>;
        state.randomId = `popper_typed_xlsx_${nextId++}`;
        return state;
      };

      popper.__typedXlsxPatchedIds = true;
    }

    patchFloatingComponent("VMenu");
    patchFloatingComponent("VDropdown");
    patchFloatingComponent("VTooltip");
  },
});
