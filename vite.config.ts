import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
import {tideDpopPlugin} from '@tidecloak/js/vite';
export default defineConfig(({mode})=>{
 const env=loadEnv(mode,process.cwd(),'');
 return {plugins:[tideDpopPlugin({config:{'auth-server-url':env.TIDECLOAK_URL||'http://localhost:8080',realm:env.TIDECLOAK_REALM||'cobid',resource:env.TIDECLOAK_CLIENT_ID||'cobid-web'}}),react()],server:{host:'127.0.0.1',port:5173,strictPort:true,proxy:{'/api':'http://127.0.0.1:3001'}},build:{outDir:'dist',target:'es2022'}};
});
