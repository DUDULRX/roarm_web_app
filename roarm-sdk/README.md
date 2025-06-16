# roarm-sdk.js

Control waveshare roarm through browser

## Documentations
<!-- https://deepwiki.com/timqian/bambot/4.1-feetech.js-sdk -->

## Quick start

```bash
# Install the package
npm install roarm-sdk.js
```

```javascript
import { Roarm } from 'roarm-sdk.js';

// request permission to access the USB device and connect to it
// Note: This will prompt the user to select a USB device
await Roarm.connect();

// read servo position
const position = await Roarm.readPosition(1);
console.log(position); // 1122
```
<!-- 
## Example usage:

- Test and config servos: [bambot.org/roarm-sdk.js](https://bambot.org/roarm-sdk.js)
- Simple html + js example: [test.html](https://github.com/DUDULRX/bambot/blob/main/roarm-sdk.js/test.html)
- Control different bots: [bambot.org](https://bambot.org) -->


