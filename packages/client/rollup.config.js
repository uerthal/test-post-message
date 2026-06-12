import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

const banner = `/*! @maxipublica/auth-sync v${process.env.npm_package_version || '0.1.0'} | MIT */`;

const baseInput = 'src/index.js';

export default [
  {
    input: baseInput,
    output: [
      {
        file: 'dist/auth-sync.umd.js',
        format: 'umd',
        name: 'AuthSync',
        exports: 'named',
        sourcemap: true,
        banner,
      },
      {
        file: 'dist/auth-sync.umd.min.js',
        format: 'umd',
        name: 'AuthSync',
        exports: 'named',
        sourcemap: true,
        plugins: [terser({ format: { comments: /^!/ } })],
        banner,
      },
    ],
    plugins: [resolve()],
  },
  {
    input: baseInput,
    output: [
      {
        file: 'dist/auth-sync.esm.js',
        format: 'esm',
        sourcemap: true,
        banner,
      },
      {
        file: 'dist/auth-sync.esm.min.js',
        format: 'esm',
        sourcemap: true,
        plugins: [terser({ format: { comments: /^!/ } })],
        banner,
      },
    ],
    plugins: [resolve()],
  },
];
