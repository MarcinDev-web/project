# collision crate

The crate is compiled to WebAssembly through `wasm-pack` and backs the
`@engine/wasm-collision` package.

## Optional panic hook

Enable the `panic-hook` feature during development to install
`console_error_panic_hook`, which forwards Rust panics to the browser
console with readable stack traces:

```sh
wasm-pack build --target bundler --out-dir ../../packages/wasm-collision/pkg -- --features panic-hook
```

The generated JS glue exports an `init_panic_hook` function. The TypeScript
loader calls it automatically when the feature is present, so no additional
application changes are required beyond compiling with the feature enabled.

