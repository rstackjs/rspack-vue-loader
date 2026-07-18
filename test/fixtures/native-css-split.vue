<template>
  <div>
    <styled-child />
    <empty-child />
  </div>
</template>

<script>
export default {
  components: {
    StyledChild: () =>
      import(
        /* webpackChunkName: "native-styled" */ './native-css-split-child.vue'
      ),
    EmptyChild: () =>
      import(/* webpackChunkName: "native-empty" */ './empty-style.vue'),
  },
}
</script>

<style>
.native-root {
  color: navy;
}
</style>
