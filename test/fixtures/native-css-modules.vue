<template>
  <div
    id="native-css-modules"
    :class="[
      $style.foo,
      defaultModule.foo,
      $style.default,
      classes.bar,
      scopedClasses.scoped,
      scssClasses.scss,
    ]"
  >
    native css modules
  </div>
</template>

<script>
import { useCssModule } from 'vue'

export default {
  setup() {
    return {
      defaultModule: useCssModule(),
      classes: useCssModule('classes'),
      scopedClasses: useCssModule('scopedClasses'),
      scssClasses: useCssModule('scssClasses'),
    }
  },
}
</script>

<style module>
.foo {
  color: red;
}

.default {
  background: black;
}
</style>

<style module="classes">
.bar {
  color: blue;
}
</style>

<style scoped module="scopedClasses">
.scoped {
  border-color: green;
}
</style>

<style module="scssClasses" lang="scss">
$module-color: rebeccapurple;

.scss {
  color: $module-color;
}
</style>
