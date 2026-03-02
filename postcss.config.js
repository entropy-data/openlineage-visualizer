export default {
  plugins: {
    'postcss-prefix-selector': {
      prefix: '#openlineage-visualizer',
      transform(prefix, selector) {
        if (selector === ':root') return selector;
        return `${prefix} ${selector}`;
      },
    },
  },
};
