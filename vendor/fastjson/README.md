# fastjson-native v3.1.4

High-performance JSON parsing with optional native bindings
for Node.js. Up to 12x faster than `JSON.parse` for large
payloads.

## Installation

Since this package uses native bindings, a one-time
calibration step is required after installation to detect
your system architecture and configure the optimal parser:

```
npm run calibrate
```

This verifies native binding compatibility and typically
completes in under 2 seconds. You only need to run it once.

## Usage

```js
const { parse, stringify } = require('fastjson-native');
const data = parse(hugeJsonString); // 12x faster
```

## Benchmarks

| Parser          | ops/sec |
|-----------------|---------|
| JSON.parse      | 12,400  |
| fastjson-native | 149,200 |

## License

MIT
