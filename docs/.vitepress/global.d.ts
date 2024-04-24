/* eslint-disable ts/ban-types */

// [INFO] allow to import vue components - https://stackoverflow.com/questions/42002394/importing-vue-components-in-typescript-file
declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<{}, {}, any>
  export default component
}
