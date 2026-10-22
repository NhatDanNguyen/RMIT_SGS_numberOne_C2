import { build } from 'esbuild';
import {mkdirSync} from 'node:fs';
mkdirSync('.local',{recursive:true});
await build({entryPoints:['node_modules/@tideorg/js/dist/Models/Policy.js'],outfile:'.local/tide-models.mjs',bundle:true,platform:'node',format:'esm',target:'node22',legalComments:'inline'});
