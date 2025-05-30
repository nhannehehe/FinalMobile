import { registerRootComponent } from 'expo';
import { decode as atob, encode as btoa } from 'base-64';
import { TextEncoder, TextDecoder } from 'text-encoding';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately

if (!global.atob) { global.atob = atob; }
if (!global.btoa) { global.btoa = btoa; }
if (!global.TextEncoder) { global.TextEncoder = TextEncoder; }
if (!global.TextDecoder) { global.TextDecoder = TextDecoder; }

registerRootComponent(App);
